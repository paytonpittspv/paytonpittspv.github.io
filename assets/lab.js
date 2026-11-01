/* Small chart helper shared by the Vault Calculator, Testing Day Sheet and Jump Tracker.
   Draws a smooth curve with a soft area fill, optional detail line, baseline, band, markers and a peak label. */
(function () {
  let n = 0;
  const f = v => Math.round(v * 10) / 10;

  // Monotone cubic interpolation, so the curve never overshoots the data.
  function smooth(P) {
    if (P.length < 2) return '';
    if (P.length === 2) return `M${f(P[0][0])},${f(P[0][1])}L${f(P[1][0])},${f(P[1][1])}`;
    const k = P.length, dx = [], dy = [], m = [], t = [];
    for (let i = 0; i < k - 1; i++) { dx[i] = P[i + 1][0] - P[i][0]; dy[i] = P[i + 1][1] - P[i][1]; m[i] = dy[i] / (dx[i] || 1e-9); }
    t[0] = m[0]; t[k - 1] = m[k - 2];
    for (let i = 1; i < k - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < k - 1; i++) {
      if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const q = 3 / Math.sqrt(s); t[i] = q * a * m[i]; t[i + 1] = q * b * m[i]; }
    }
    let d = `M${f(P[0][0])},${f(P[0][1])}`;
    for (let i = 0; i < k - 1; i++) {
      const h = dx[i] / 3;
      d += `C${f(P[i][0] + h)},${f(P[i][1] + h * t[i])} ${f(P[i + 1][0] - h)},${f(P[i + 1][1] - h * t[i + 1])} ${f(P[i + 1][0])},${f(P[i + 1][1])}`;
    }
    return d;
  }

  function tip(x, y, label, W, above = true) {
    const w = label.length * 7.4 + 22, h = 28;
    let tx = Math.min(Math.max(x - w / 2, 2), W - w - 2);
    const ty = above ? y - h - 12 : y + 12;
    return `<g class="tip"><rect x="${f(tx)}" y="${f(ty)}" width="${f(w)}" height="${h}" rx="7"/><text x="${f(tx + w / 2)}" y="${f(ty + 18.5)}" text-anchor="middle">${label}</text></g>`;
  }

  /* o = { W, H, pts:[{x,y}], x0, x1, y0, y1, xTicks:[{v,t}], yGrid:[v], xTitle, detail:true,
           base:[{x,y}], band:{a,b,t}, marks:[{x,t}], peak:{x,y,t}, dots:[{x,y,c,t}], area:true } */
  function area(o) {
    const id = 'lg' + (++n), W = o.W, H = o.H, P = { l: o.padL ?? 8, r: o.padR ?? 8, t: 46, b: o.xTitle ? 46 : 28 };
    const X = x => P.l + (x - o.x0) / (o.x1 - o.x0) * (W - P.l - P.r);
    const Y = y => P.t + (o.y1 - y) / (o.y1 - o.y0) * (H - P.t - P.b);
    const pts = o.pts.map(p => [X(p.x), Y(p.y)]);
    const yb = H - P.b;
    let s = `<svg class="lab-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || 'Chart'}"><defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--chart-1)" stop-opacity=".28"/><stop offset="1" stop-color="var(--chart-1)" stop-opacity=".03"/></linearGradient></defs>`;
    (o.yGrid || []).forEach(v => { s += `<line x1="${P.l}" x2="${W - P.r}" y1="${f(Y(v))}" y2="${f(Y(v))}" stroke="var(--line)"/>`; if (o.yLabels) s += `<text x="${P.l}" y="${f(Y(v) - 5)}">${o.yLabels(v)}</text>`; });
    (o.xTicks || []).forEach(tk => {
      if (tk.grid !== false) s += `<line x1="${f(X(tk.v))}" x2="${f(X(tk.v))}" y1="${P.t - 20}" y2="${yb}" stroke="var(--line)"/>`;
      s += `<text x="${f(X(tk.v))}" y="${yb + 20}" text-anchor="${tk.anchor || 'middle'}">${tk.t}</text>`;
    });
    if (o.xTitle) s += `<text x="${P.l}" y="${H - 4}">${o.xTitle}</text>`;
    if (o.band) {
      s += `<rect x="${f(X(o.band.a))}" y="${P.t - 20}" width="${f(X(o.band.b) - X(o.band.a))}" height="${yb - P.t + 20}" fill="var(--accent-soft)" opacity=".7"/>`;
      [o.band.a, o.band.b].forEach(v => s += `<line x1="${f(X(v))}" x2="${f(X(v))}" y1="${P.t - 20}" y2="${yb}" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="4 4"/>`);
      if (o.band.t) s += `<text x="${f((X(o.band.a) + X(o.band.b)) / 2)}" y="${yb - 12}" text-anchor="middle" style="fill:var(--accent);font-weight:600;font-size:13px">${o.band.t}</text>`;
    }
    const line = smooth(pts);
    if (pts.length > 1 && o.area !== false) s += `<path d="${line}L${f(pts[pts.length - 1][0])},${yb}L${f(pts[0][0])},${yb}Z" fill="url(#${id})"/>`;
    if (o.detail && pts.length > 1) {
      // a faint "raw" line that wobbles around the smooth one, like frame-by-frame readings
      const D = [];
      for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < 4; j++) {
        const a = pts[i], b = pts[i + 1], q = j / 4;
        D.push([a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q + Math.sin((i * 4 + j) * 1.9) * 3.2]);
      }
      D.push(pts[pts.length - 1]);
      s += `<path d="${smooth(D)}" fill="none" stroke="var(--detail)" stroke-width="1.6"/>`;
    }
    if (o.base && o.base.length > 1) s += `<path d="${smooth(o.base.map(p => [X(p.x), Y(p.y)]))}" fill="none" stroke="var(--chart-3)" stroke-width="2" stroke-dasharray="6 5"/>`;
    if (pts.length > 1) s += `<path d="${line}" fill="none" stroke="var(--chart-1)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    (o.marks || []).forEach(mk => {
      s += `<line x1="${f(X(mk.x))}" x2="${f(X(mk.x))}" y1="${P.t - 20}" y2="${yb}" stroke="${mk.c || 'var(--accent)'}" stroke-width="1.6" stroke-dasharray="3 4"/>`;
      if (mk.t) s += `<text x="${f(X(mk.x))}" y="${P.t - 26}" text-anchor="${mk.anchor || 'middle'}" style="fill:${mk.c || 'var(--accent)'};font-weight:600">${mk.t}</text>`;
    });
    (o.dots || []).forEach(d => {
      s += `<circle cx="${f(X(d.x))}" cy="${f(Y(d.y))}" r="${d.r || 4.5}" fill="var(--surface)" stroke="${d.c || 'var(--chart-1)'}" stroke-width="2.5"><title>${d.t || ''}</title></circle>`;
      if (d.lbl) s += `<text x="${f(X(d.x))}" y="${f(Y(d.y) - 11)}" text-anchor="${d.anchor || 'middle'}" style="fill:var(--text);font-weight:600">${d.lbl}</text>`;
    });
    if (o.peak) {
      const px = X(o.peak.x), py = Y(o.peak.y);
      s += `<circle cx="${f(px)}" cy="${f(py)}" r="7.5" fill="var(--surface)" stroke="var(--chart-1)" stroke-width="3"/>`;
      s += tip(px, py, o.peak.t, W, py - P.t > 8 || true);
    }
    return s + '</svg>';
  }

  window.Lab = { area, smooth };
})();
