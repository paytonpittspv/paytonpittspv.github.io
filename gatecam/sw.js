// GateCamLive offline support: keeps a copy of the app on the device so it opens with no signal.
const VERSION='gcl-2026-11-01b';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-512.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!=='gcl-fonts').map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// the page: try the network briefly (to pick up updates), fall back to the saved copy straight away
function pageRequest(req){
  return new Promise(resolve=>{
    let done=false;
    const fromCache=()=>caches.match('./index.html').then(r=>{ if(!done&&r){ done=true; resolve(r); } });
    const timer=setTimeout(fromCache,2500);
    fetch(req).then(res=>{
      if(res&&res.ok){ const copy=res.clone(); caches.open(VERSION).then(c=>c.put('./index.html',copy)); }
      clearTimeout(timer); if(!done){ done=true; resolve(res); }
    }).catch(()=>{ clearTimeout(timer); caches.match('./index.html').then(r=>{ if(!done){ done=true; resolve(r||Response.error()); } }); });
  });
}
self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET') return;
  if(req.mode==='navigate'){ e.respondWith(pageRequest(req)); return; }
  // fonts: use the saved copy, refresh it in the background when online
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open('gcl-fonts').then(c=>c.match(req).then(hit=>{
      const net=fetch(req).then(res=>{ if(res&&(res.ok||res.type==='opaque')) c.put(req,res.clone()); return res; }).catch(()=>hit);
      return hit||net;
    })));
    return;
  }
  // icons and other files from this site: saved copy first
  if(url.origin===self.location.origin){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{ if(res&&res.ok){ const copy=res.clone(); caches.open(VERSION).then(c=>c.put(req,copy)); } return res; })));
  }
});
