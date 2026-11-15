/* ml-interactive.js — small interactive figures for the SPM 405 and SPH 508 notes sites.
 * Plain JavaScript and <canvas>, no libraries. Each widget is a <div class="ml-widget" data-widget="name">
 * written by the {{< interactive name >}} shortcode. Colours follow the light/dark theme.
 * Written for these courses by Charles Ndung'u Ndegwa's course sites.
 */
(function () {
  "use strict";

  // ------------------------------------------------------------------ helpers
  const dark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const C = () => dark()
    ? { ink: "#e6e8ea", muted: "#9aa0a6", grid: "#34373b", a: "#8f91f5", b: "#f2af5f", r: "#e0736c", g: "#79d897", fillA: "rgba(143,145,245,0.22)", fillB: "rgba(242,175,95,0.22)", bg: "#1b1c1e" }
    : { ink: "#1c1d1f", muted: "#6b6b66", grid: "#e2e2dd", a: "#3538cd", b: "#b3690f", r: "#c2352f", g: "#2f8f4e", fillA: "rgba(53,56,205,0.14)", fillB: "rgba(179,105,15,0.16)", bg: "#fdfdfc" };

  function rng(seed) {                         // small deterministic generator, so every reader sees the same data
    let s = seed >>> 0;
    const u = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
    u.normal = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
    return u;
  }

  function el(tag, attrs, parent, text) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function slider(box, label, min, max, step, value, fmt, onInput) {
    const row = el("label", { class: "mlw-row" }, box);
    el("span", { class: "mlw-label" }, row, label);
    const s = el("input", { type: "range", min, max, step, value }, row);
    const v = el("span", { class: "mlw-value" }, row);
    const show = () => { v.textContent = fmt(+s.value); };
    s.addEventListener("input", () => { show(); onInput(+s.value); });
    show();
    return s;
  }

  function button(box, text, onClick) {
    const b = el("button", { type: "button", class: "mlw-button" }, box, text);
    b.addEventListener("click", onClick);
    return b;
  }

  // a canvas with data coordinates
  function plot(box, xr, yr, opts) {
    opts = opts || {};
    const cv = el("canvas", { class: "mlw-canvas" }, box);
    const ratio = opts.ratio || 0.62;
    const P = { cv, xr, yr, pad: { l: 46, r: 14, t: 12, b: 36 } };
    P.resize = () => {
      const w = Math.min(box.clientWidth || 640, opts.maxWidth || 760), h = Math.round(w * ratio);
      const d = window.devicePixelRatio || 1;
      cv.width = w * d; cv.height = h * d; cv.style.width = w + "px"; cv.style.height = h + "px";
      P.w = w; P.h = h; P.ctx = cv.getContext("2d"); P.ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    P.X = (x) => P.pad.l + (x - P.xr[0]) / (P.xr[1] - P.xr[0]) * (P.w - P.pad.l - P.pad.r);
    P.Y = (y) => P.h - P.pad.b - (y - P.yr[0]) / (P.yr[1] - P.yr[0]) * (P.h - P.pad.t - P.pad.b);
    P.invX = (px) => P.xr[0] + (px - P.pad.l) / (P.w - P.pad.l - P.pad.r) * (P.xr[1] - P.xr[0]);
    P.invY = (py) => P.yr[0] + (P.h - P.pad.b - py) / (P.h - P.pad.t - P.pad.b) * (P.yr[1] - P.yr[0]);
    P.clear = () => { P.ctx.clearRect(0, 0, P.w, P.h); };
    P.axes = (xlabel, ylabel, xt, yt) => {
      const c = P.ctx, k = C();
      c.strokeStyle = k.muted; c.fillStyle = k.muted; c.lineWidth = 1; c.font = "12px sans-serif";
      c.beginPath(); c.moveTo(P.pad.l, P.pad.t); c.lineTo(P.pad.l, P.h - P.pad.b); c.lineTo(P.w - P.pad.r, P.h - P.pad.b); c.stroke();
      c.textAlign = "center"; c.textBaseline = "top";
      (xt || []).forEach((t) => { c.fillText(fmtNum(t), P.X(t), P.h - P.pad.b + 4); });
      c.textAlign = "right"; c.textBaseline = "middle";
      (yt || []).forEach((t) => { c.fillText(fmtNum(t), P.pad.l - 5, P.Y(t)); });
      c.fillStyle = k.ink; c.textAlign = "center"; c.textBaseline = "bottom";
      if (xlabel) c.fillText(xlabel, (P.pad.l + P.w - P.pad.r) / 2, P.h - 2);
      if (ylabel) { c.save(); c.translate(12, (P.pad.t + P.h - P.pad.b) / 2); c.rotate(-Math.PI / 2); c.textBaseline = "middle"; c.fillText(ylabel, 0, 0); c.restore(); }
    };
    P.dot = (x, y, col, r) => { const c = P.ctx; c.fillStyle = col; c.beginPath(); c.arc(P.X(x), P.Y(y), r || 3.5, 0, 2 * Math.PI); c.fill(); };
    P.line = (pts, col, w, dash) => {
      const c = P.ctx; c.strokeStyle = col; c.lineWidth = w || 2; c.setLineDash(dash || []);
      c.beginPath(); pts.forEach(([x, y], i) => { const px = P.X(x), py = P.Y(Math.max(P.yr[0] - 1e3, Math.min(P.yr[1] + 1e3, y))); i ? c.lineTo(px, py) : c.moveTo(px, py); });
      c.stroke(); c.setLineDash([]);
    };
    P.text = (s, x, y, col, align) => { const c = P.ctx; c.fillStyle = col || C().ink; c.font = "13px sans-serif"; c.textAlign = align || "left"; c.textBaseline = "middle"; c.fillText(s, x, y); };
    P.clip = (fn) => { const c = P.ctx; c.save(); c.beginPath(); c.rect(P.pad.l, P.pad.t, P.w - P.pad.l - P.pad.r, P.h - P.pad.t - P.pad.b); c.clip(); fn(); c.restore(); };
    P.resize();
    return P;
  }

  const fmtNum = (v) => (Math.abs(v) >= 100 || Number.isInteger(v) ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, ""));
  const ticks = (a, b, n) => { const out = []; const st = (b - a) / n; for (let i = 0; i <= n; i++) out.push(+(a + i * st).toFixed(6)); return out; };

  function readout(box) { return el("div", { class: "mlw-readout" }, box); }

  // a boxed key inside a plot; items are [label, colour, dash, "dot"]; pos: "right", "left", "bottom-right", "bottom-left"
  function legend(P, items, pos) {
    const c = P.ctx, k = C(); c.save(); c.font = "12px sans-serif";
    const w = Math.max(...items.map((it) => c.measureText(it[0]).width)) + 38, h = items.length * 18 + 8;
    const x0 = (pos || "right").includes("left") ? P.pad.l + 8 : P.w - P.pad.r - w - 6;
    const y0 = (pos || "").startsWith("bottom") ? P.h - P.pad.b - h - 6 : P.pad.t + 6;
    c.globalAlpha = 0.9; c.fillStyle = k.bg; c.fillRect(x0, y0, w, h); c.globalAlpha = 1;
    c.strokeStyle = k.grid; c.lineWidth = 1; c.setLineDash([]); c.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
    items.forEach(([lab, col, dash, kind], i) => {
      const y = y0 + 13 + 18 * i;
      if (kind === "dot") { c.fillStyle = col; c.beginPath(); c.arc(x0 + 16, y, 4.5, 0, 2 * Math.PI); c.fill(); }
      else if (kind === "box") { c.fillStyle = col; c.fillRect(x0 + 7, y - 5, 18, 10); }
      else { c.strokeStyle = col; c.lineWidth = 2.6; c.setLineDash(dash || []); c.beginPath(); c.moveTo(x0 + 6, y); c.lineTo(x0 + 26, y); c.stroke(); c.setLineDash([]); }
      c.fillStyle = k.ink; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(lab, x0 + 32, y);
    });
    c.restore();
  }

  // least squares with a tiny ridge term, for polynomial fits on x in [-1, 1]
  function polyfit(xs, ys, deg, lam) {
    const n = deg + 1, A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
    xs.forEach((x, k) => {
      const p = []; for (let i = 0; i < n; i++) p.push(Math.pow(x, i));
      for (let i = 0; i < n; i++) { b[i] += p[i] * ys[k]; for (let j = 0; j < n; j++) A[i][j] += p[i] * p[j]; }
    });
    for (let i = 1; i < n; i++) A[i][i] += lam * xs.length;
    A[0][0] += 1e-10;
    for (let i = 0; i < n; i++) {                       // Gaussian elimination with pivoting
      let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const w = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * w[c]; w[i] = s / A[i][i]; }
    return (x) => w.reduce((s, wi, i) => s + wi * Math.pow(x, i), 0);
  }

  // ------------------------------------------------------------------ widgets
  const W = {};

  // 1. Fit a line by hand: residuals and RSS
  W.fitline = (box, opts) => {
    // data sets: a temperature-sensor calibration (default) or Hubble's law (opts.data = "hubble")
    const D = opts.data === "hubble"
      ? { n: 20, x0: 10, x1: 150, b0: 0, b1: 0.07, sd: 0.6, xr: [0, 150], yr: [0, 12], xl: "distance d (Mpc)", yl: "velocity v (10³ km/s)",
          u0: " ×10³ km/s", u1: " ×10³ km/s per Mpc", ru: "(10³ km/s)²", s0: [-4, 4, 0.01, 2], s1: [0, 0.12, 0.0005, 0.04] }
      : { n: 20, x0: 5, x1: 95, b0: 2.5, b1: 9.83, sd: 15, xr: [0, 100], yr: [0, 1000], xl: "temperature T (°C)", yl: "voltage V (mV)",
          u0: " mV", u1: " mV/°C", ru: "mV²", s0: [-200, 300, 1, 150], s1: [0, 15, 0.01, 7] };
    const r = rng(7), xs = [], ys = [];
    for (let i = 0; i < D.n; i++) { const x = D.x0 + (D.x1 - D.x0) * r(); xs.push(x); ys.push(D.b0 + D.b1 * x + D.sd * r.normal()); }
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    const b1 = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0), b0 = my - b1 * mx;
    const P = plot(box, D.xr, D.yr);
    let a0 = D.s0[3], a1 = D.s1[3];
    const out = readout(box);
    const draw = () => {
      P.clear(); P.axes(D.xl, D.yl, ticks(D.xr[0], D.xr[1], 5), ticks(D.yr[0], D.yr[1], 4));
      const k = C(); let rss = 0;
      P.clip(() => {
        xs.forEach((x, i) => { const yh = a0 + a1 * x; rss += (ys[i] - yh) ** 2; P.line([[x, ys[i]], [x, yh]], k.r, 1.2); });
        P.line([[D.xr[0], a0 + a1 * D.xr[0]], [D.xr[1], a0 + a1 * D.xr[1]]], k.b, 2.5);
        xs.forEach((x, i) => P.dot(x, ys[i], k.a));
      });
      const best = xs.reduce((s, x, i) => s + (ys[i] - b0 - b1 * x) ** 2, 0);
      const f = (v) => (Math.abs(v) < 100 ? v.toFixed(2) : v.toFixed(0));
      out.innerHTML = `RSS = <b>${f(rss)}</b> ${D.ru} &nbsp;·&nbsp; smallest possible RSS = ${f(best)} ${D.ru} (red lines: the residuals)`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    const dg = (st) => (st < 0.01 ? 4 : st < 1 ? 2 : 0);
    const s0 = slider(c, "intercept β₀", D.s0[0], D.s0[1], D.s0[2], a0, (v) => v.toFixed(dg(D.s0[2])) + D.u0, (v) => { a0 = v; draw(); });
    const s1 = slider(c, "slope β₁", D.s1[0], D.s1[1], D.s1[2], a1, (v) => v.toFixed(dg(D.s1[2])) + D.u1, (v) => { a1 = v; draw(); });
    button(c, "Least squares", () => { a0 = b0; a1 = b1; s0.value = b0; s1.value = b1; s0.dispatchEvent(new Event("input")); s1.dispatchEvent(new Event("input")); });
    draw();
    return draw;
  };

  // 2. Gradient descent on a one-parameter cost
  W.gd = (box) => {
    const J = (t) => (t - 2) ** 2 + 0.5, dJ = (t) => 2 * (t - 2);
    const P = plot(box, [-3, 7], [0, 26], { ratio: 0.48 });
    let alpha = 0.1, path = [-2.5];
    const out = readout(box);
    const draw = () => {
      P.clear(); P.axes("parameter θ", "cost J(θ)", ticks(-3, 7, 10), ticks(0, 25, 5));
      const k = C(), pts = []; for (let t = -3; t <= 7.001; t += 0.05) pts.push([t, J(t)]);
      P.clip(() => {
        P.line(pts, k.muted, 2);
        P.line(path.map((t) => [t, J(t)]), k.r, 1.2, [4, 3]);
        path.forEach((t, i) => P.dot(t, J(t), i === path.length - 1 ? k.b : k.a, i === path.length - 1 ? 6 : 4));
      });
      const t = path[path.length - 1];
      out.innerHTML = `step ${path.length - 1}: θ = <b>${t.toFixed(3)}</b>, J = ${J(t).toFixed(3)}, slope = ${dJ(t).toFixed(3)}` +
        (Math.abs(t) > 50 ? " — <b>diverged</b>: the step size is too large" : alpha > 1 ? " — α > 1 overshoots further every step" : alpha > 0.5 ? " — α between 0.5 and 1 zig-zags across the valley" : "");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "step size α", 0.01, 1.1, 0.01, alpha, (v) => v.toFixed(2), (v) => { alpha = v; path = [path[0]]; draw(); });
    button(c, "One step", () => { const t = path[path.length - 1]; if (Math.abs(t) < 1e6) path.push(t - alpha * dJ(t)); draw(); });
    button(c, "Ten steps", () => { for (let i = 0; i < 10; i++) { const t = path[path.length - 1]; if (Math.abs(t) < 1e6) path.push(t - alpha * dJ(t)); } draw(); });
    button(c, "Restart", () => { path = [-2.5]; draw(); });
    P.cv.addEventListener("click", (e) => { const rc = P.cv.getBoundingClientRect(); path = [Math.max(-3, Math.min(7, P.invX(e.clientX - rc.left)))]; draw(); });
    el("div", { class: "mlw-hint" }, box, "Click on the plot to choose a new starting point. Update: θ ← θ − α · dJ/dθ.");
    draw();
    return draw;
  };

  // 3. A threshold on a classifier score: confusion matrix and ROC point
  W.threshold = (box) => {
    const wrap = el("div", { class: "mlw-pair" }, box);
    const L = el("div", {}, wrap), R = el("div", {}, wrap);
    const P = plot(L, [-4, 4], [0, 0.55], { ratio: 0.7, maxWidth: 460 }), Q = plot(R, [0, 1], [0, 1], { ratio: 1, maxWidth: 300 });
    Q.pad = { l: 40, r: 10, t: 10, b: 36 };
    let thr = 0, sep = 2;
    const pdf = (x, m) => Math.exp(-0.5 * (x - m) ** 2) / Math.sqrt(2 * Math.PI);
    const cdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
    function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
    const out = readout(box);
    const draw = () => {
      const k = C(), m0 = -sep / 2, m1 = sep / 2;
      P.clear(); P.axes("classifier score", "density", ticks(-4, 4, 8), [0, 0.2, 0.4]);
      const c = P.ctx;
      [[m0, k.fillB, k.b], [m1, k.fillA, k.a]].forEach(([m, f, s]) => {
        const pts = []; for (let x = -4; x <= 4.001; x += 0.04) pts.push([x, pdf(x, m)]);
        c.fillStyle = f; c.beginPath(); c.moveTo(P.X(thr), P.Y(0));
        pts.filter(([x]) => x >= thr).forEach(([x, y]) => c.lineTo(P.X(x), P.Y(y))); c.lineTo(P.X(4), P.Y(0)); c.fill();
        P.line(pts, s, 2);
      });
      P.line([[thr, 0], [thr, 0.55]], k.r, 2, [5, 4]);
      P.text("negatives", P.X(m0), P.Y(0.47), k.b, "center"); P.text("positives", P.X(m1), P.Y(0.47), k.a, "center");
      const tpr = 1 - cdf(thr - m1), fpr = 1 - cdf(thr - m0);
      const N = 1000, TP = Math.round(tpr * N), FN = N - TP, FP = Math.round(fpr * N), TN = N - FP;
      Q.clear(); Q.axes("false positive rate", "true positive rate", [0, 0.5, 1], [0, 0.5, 1]);
      const roc = []; for (let t = 5; t >= -5; t -= 0.05) roc.push([1 - cdf(t - m0), 1 - cdf(t - m1)]);
      Q.line([[0, 0], [1, 1]], k.grid, 1, [4, 4]); Q.line(roc, k.a, 2); Q.dot(fpr, tpr, k.r, 6);
      let auc = 0; for (let i = 1; i < roc.length; i++) auc += (roc[i][0] - roc[i - 1][0]) * (roc[i][1] + roc[i - 1][1]) / 2;
      out.innerHTML = `<table class="mlw-cm"><tr><td></td><th>predicted +</th><th>predicted −</th></tr>` +
        `<tr><th>actual + (1000)</th><td>TP ${TP}</td><td>FN ${FN}</td></tr><tr><th>actual − (1000)</th><td>FP ${FP}</td><td>TN ${TN}</td></tr></table>` +
        `<div>TPR (recall) = <b>${tpr.toFixed(3)}</b> · FPR = <b>${fpr.toFixed(3)}</b> · precision = ${(TP / Math.max(1, TP + FP)).toFixed(3)} · accuracy = ${((TP + TN) / 2000).toFixed(3)} · AUC = ${auc.toFixed(3)}</div>`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "threshold", -3, 3, 0.01, thr, (v) => v.toFixed(2), (v) => { thr = v; draw(); });
    slider(c, "class separation", 0, 4, 0.05, sep, (v) => v.toFixed(2), (v) => { sep = v; draw(); });
    draw();
    return draw;
  };

  // 4. Flexibility: polynomial degree and ridge penalty; training versus test error
  W.flex = (box, opts) => {
    const r = rng(11), f = (x) => Math.sin(2.6 * x) + 0.3 * x;
    const tr = [], te = [];
    for (let i = 0; i < 18; i++) { const x = -1 + 2 * r(); tr.push([x, f(x) + 0.28 * r.normal()]); }
    for (let i = 0; i < 300; i++) { const x = -1 + 2 * r(); te.push([x, f(x) + 0.28 * r.normal()]); }
    const wrap = el("div", { class: "mlw-pair" }, box);
    const L = el("div", {}, wrap), R = el("div", {}, wrap);
    const P = plot(L, [-1, 1], [-2.2, 2.2], { ratio: 0.72, maxWidth: 470 }), Q = plot(R, [1, 12], [0, 1], { ratio: 0.9, maxWidth: 290 });
    let deg = opts.degree || 3, loglam = opts.ridge ? -2 : -9;
    const mse = (g, D) => D.reduce((s, [x, y]) => s + (g(x) - y) ** 2, 0) / D.length;
    const out = readout(box);
    const draw = () => {
      const k = C(), lam = Math.pow(10, loglam), g = polyfit(tr.map((p) => p[0]), tr.map((p) => p[1]), deg, lam);
      P.clear(); P.axes("x", "y", ticks(-1, 1, 4), ticks(-2, 2, 4));
      P.clip(() => {
        te.forEach(([x, y]) => P.dot(x, y, k.grid, 2));
        const pts = []; for (let x = -1; x <= 1.0001; x += 0.005) pts.push([x, f(x)]);
        P.line(pts, k.muted, 1.5, [5, 4]);
        const fit = []; for (let x = -1; x <= 1.0001; x += 0.005) fit.push([x, g(x)]);
        P.line(fit, k.b, 2.5);
        tr.forEach(([x, y]) => P.dot(x, y, k.a, 4));
      });
      Q.clear(); Q.axes("degree", "mean squared error", [1, 3, 6, 9, 12], [0, 0.25, 0.5, 0.75, 1]);
      const trc = [], tec = [];
      for (let d = 1; d <= 12; d++) { const h = polyfit(tr.map((p) => p[0]), tr.map((p) => p[1]), d, lam); trc.push([d, mse(h, tr)]); tec.push([d, mse(h, te)]); }
      Q.clip(() => { Q.line(trc, k.a, 2); Q.line(tec, k.r, 2); Q.line([[deg, 0], [deg, 1]], k.muted, 1, [3, 3]); });
      legend(Q, [["training", k.a], ["test", k.r]]);
      out.innerHTML = `degree ${deg}${opts.ridge ? `, λ = ${lam.toExponential(1)}` : ""}: training MSE = <b>${mse(g, tr).toFixed(3)}</b>, test MSE = <b>${mse(g, te).toFixed(3)}</b> (noise variance 0.078: no model can beat it on average)`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "polynomial degree", 1, 12, 1, deg, (v) => v.toFixed(0), (v) => { deg = v; draw(); });
    if (opts.ridge) slider(c, "ridge penalty log₁₀ λ", -9, 1, 0.1, loglam, (v) => "λ = " + Math.pow(10, v).toExponential(1), (v) => { loglam = v; draw(); });
    el("div", { class: "mlw-hint" }, box, "Blue: 18 training points. Grey: 300 new points used as the test set. Dashed: the true curve.");
    draw();
    return draw;
  };

  // 5. K-nearest neighbours: decision regions
  W.knn = (box) => {
    const r = rng(5), pts = [], test = [];
    const gen = (arr, n) => { for (let i = 0; i < n; i++) { const x = r(), y = r(); const p = 1 / (1 + Math.exp(-10 * (y - 0.5 - 0.25 * Math.sin(6 * x)))); arr.push([x, y, r() < p ? 1 : 0]); } };
    gen(pts, 120); gen(test, 600);
    const P = plot(box, [0, 1], [0, 1], { ratio: 0.75, maxWidth: 560 });
    let K = 1;
    const out = readout(box);
    const classify = (x, y, excludeSelf) => {
      const d = pts.map((p, i) => [(p[0] - x) ** 2 + (p[1] - y) ** 2, p[2], i]).sort((a, b) => a[0] - b[0]);
      const nb = d.slice(0, K); return nb.reduce((s, q) => s + q[1], 0) / K > 0.5 ? 1 : 0;
    };
    const draw = () => {
      const k = C(); P.clear(); P.axes("sensor 1", "sensor 2", [0, 0.5, 1], [0, 0.5, 1]);
      const c = P.ctx, N = 60, dx = 1 / N;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const cl = classify((i + 0.5) * dx, (j + 0.5) * dx);
        c.fillStyle = cl ? k.fillA : k.fillB; c.fillRect(P.X(i * dx), P.Y((j + 1) * dx), P.X(dx) - P.X(0) + 0.6, P.Y(0) - P.Y(dx) + 0.6);
      }
      pts.forEach(([x, y, l]) => P.dot(x, y, l ? k.a : k.b, 3.5));
      const trErr = pts.filter(([x, y, l]) => classify(x, y) !== l).length / pts.length;
      const teErr = test.filter(([x, y, l]) => classify(x, y) !== l).length / test.length;
      out.innerHTML = `K = ${K}: training error = <b>${(100 * trErr).toFixed(1)}%</b>, test error = <b>${(100 * teErr).toFixed(1)}%</b> (600 new points)`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "number of neighbours K", 1, 60, 1, K, (v) => v.toFixed(0), (v) => { K = v; draw(); });
    el("div", { class: "mlw-hint" }, box, "Small K: a jagged boundary that follows every point (overfit). Large K: too smooth (underfit).");
    draw();
    return draw;
  };

  // 6. k-means, step by step
  W.kmeans = (box) => {
    const r = rng(3), centres = [[0.25, 0.7], [0.7, 0.75], [0.45, 0.25], [0.8, 0.3]], X = [];
    centres.forEach(([cx, cy]) => { for (let i = 0; i < 45; i++) X.push([cx + 0.075 * r.normal(), cy + 0.075 * r.normal()]); });
    const P = plot(box, [0, 1], [0, 1], { ratio: 0.75, maxWidth: 560 });
    let k = 3, mu = [], lab = new Array(X.length).fill(-1), phase = "assign", it = 0, seed = 1;
    const cols = () => { const t = C(); return [t.a, t.b, t.g, t.r, "#8144dd", "#0f7c8c"]; };
    const init = () => { const q = rng(100 + seed++); mu = []; for (let j = 0; j < k; j++) mu.push(X[Math.floor(q() * X.length)].slice()); lab.fill(-1); phase = "assign"; it = 0; };
    const inertia = () => X.reduce((s, p, i) => s + (lab[i] < 0 ? 0 : (p[0] - mu[lab[i]][0]) ** 2 + (p[1] - mu[lab[i]][1]) ** 2), 0);
    const step = () => {
      if (phase === "assign") { X.forEach((p, i) => { let b = 0, bd = 1e9; mu.forEach((m, j) => { const d = (p[0] - m[0]) ** 2 + (p[1] - m[1]) ** 2; if (d < bd) { bd = d; b = j; } }); lab[i] = b; }); phase = "move"; }
      else { mu = mu.map((m, j) => { const s = X.filter((_, i) => lab[i] === j); return s.length ? [s.reduce((a, p) => a + p[0], 0) / s.length, s.reduce((a, p) => a + p[1], 0) / s.length] : m; }); phase = "assign"; it++; }
    };
    const out = readout(box);
    const draw = () => {
      const t = C(), cl = cols(); P.clear(); P.axes("feature 1", "feature 2", [0, 0.5, 1], [0, 0.5, 1]);
      X.forEach((p, i) => P.dot(p[0], p[1], lab[i] < 0 ? t.muted : cl[lab[i]], 3.5));
      const c = P.ctx;
      mu.forEach((m, j) => { c.strokeStyle = t.ink; c.fillStyle = cl[j]; c.lineWidth = 2; c.beginPath(); c.arc(P.X(m[0]), P.Y(m[1]), 9, 0, 2 * Math.PI); c.fill(); c.stroke(); });
      out.innerHTML = `iteration ${it} · next step: <b>${phase === "assign" ? "assign each point to its nearest centre" : "move each centre to the mean of its points"}</b>` +
        (lab[0] >= 0 ? ` · inertia (within-cluster sum of squares) = ${inertia().toFixed(3)}` : "");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "number of clusters k", 2, 6, 1, k, (v) => v.toFixed(0), (v) => { k = v; init(); draw(); });
    button(c, "Next step", () => { step(); draw(); });
    button(c, "Run to the end", () => { for (let i = 0; i < 100; i++) step(); if (phase === "move") step(); draw(); });
    button(c, "New random start", () => { init(); draw(); });
    init(); draw();
    return draw;
  };

  // 7. PCA: the direction of largest variance
  W.pca = (box) => {
    const r = rng(9), X = [];
    for (let i = 0; i < 160; i++) { const a = 1.4 * r.normal(), b = 0.45 * r.normal(); X.push([a * Math.cos(0.6) - b * Math.sin(0.6), a * Math.sin(0.6) + b * Math.cos(0.6)]); }
    const mx = X.reduce((s, p) => s + p[0], 0) / X.length, my = X.reduce((s, p) => s + p[1], 0) / X.length;
    const sxx = X.reduce((s, p) => s + (p[0] - mx) ** 2, 0) / X.length, syy = X.reduce((s, p) => s + (p[1] - my) ** 2, 0) / X.length, sxy = X.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / X.length;
    const best = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const P = plot(box, [-4, 4], [-3, 3], { ratio: 0.72, maxWidth: 600 });
    let ang = 0;
    const out = readout(box);
    const draw = () => {
      const k = C(), u = [Math.cos(ang), Math.sin(ang)];
      P.clear(); P.axes("x₁", "x₂", ticks(-4, 4, 8), ticks(-3, 3, 6));
      let v = 0;
      P.clip(() => {
        P.line([[mx - 6 * u[0], my - 6 * u[1]], [mx + 6 * u[0], my + 6 * u[1]]], k.b, 2.2);
        X.forEach(([x, y]) => {
          const t = (x - mx) * u[0] + (y - my) * u[1]; v += t * t;
          const px = mx + t * u[0], py = my + t * u[1];
          P.line([[x, y], [px, py]], k.grid, 1); P.dot(px, py, k.b, 2.2); P.dot(x, y, k.a, 3);
        });
      });
      v /= X.length;
      const tot = sxx + syy;
      out.innerHTML = `variance along this direction = <b>${v.toFixed(3)}</b> of a total ${tot.toFixed(3)} (<b>${(100 * v / tot).toFixed(1)}%</b>). The first principal component is the direction that makes this as large as possible.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    const s = slider(c, "direction (degrees)", 0, 180, 1, 0, (v) => v.toFixed(0) + "°", (v) => { ang = v * Math.PI / 180; draw(); });
    button(c, "Show PC1", () => { let d = best * 180 / Math.PI; if (d < 0) d += 180; s.value = d; s.dispatchEvent(new Event("input")); });
    button(c, "Show PC2", () => { let d = best * 180 / Math.PI + 90; if (d < 0) d += 180; if (d > 180) d -= 180; s.value = d; s.dispatchEvent(new Event("input")); });
    draw();
    return draw;
  };

  // 8. One neuron: weight, bias and activation
  W.neuron = (box) => {
    const P = plot(box, [-5, 5], [-1.2, 1.2], { ratio: 0.45 });
    let w = 1, b = 0, act = "sigmoid";
    const A = { sigmoid: (z) => 1 / (1 + Math.exp(-z)), tanh: Math.tanh, ReLU: (z) => Math.max(0, z) };
    const out = readout(box);
    const draw = () => {
      const k = C(); P.yr = act === "ReLU" ? [-0.5, 5] : [-1.2, 1.2];
      P.clear(); P.axes("input x", "output a = g(w x + b)", ticks(-5, 5, 10), act === "ReLU" ? [0, 1, 2, 3, 4, 5] : [-1, -0.5, 0, 0.5, 1]);
      const pts = []; for (let x = -5; x <= 5.001; x += 0.02) pts.push([x, A[act](w * x + b)]);
      P.clip(() => { P.line([[-5, 0], [5, 0]], k.grid, 1); P.line(pts, k.a, 2.6); if (w !== 0) P.line([[-b / w, P.yr[0]], [-b / w, P.yr[1]]], k.r, 1.2, [4, 3]); });
      out.innerHTML = `a = ${act}(${w.toFixed(2)} · x ${b >= 0 ? "+" : "−"} ${Math.abs(b).toFixed(2)})` + (w !== 0 ? ` · the switch is at x = −b/w = <b>${(-b / w).toFixed(2)}</b> (red line)` : "");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "weight w", -4, 4, 0.05, w, (v) => v.toFixed(2), (v) => { w = v; draw(); });
    slider(c, "bias b", -5, 5, 0.05, b, (v) => v.toFixed(2), (v) => { b = v; draw(); });
    const sel = el("select", { class: "mlw-select" }, c);
    Object.keys(A).forEach((n) => el("option", { value: n }, sel, n));
    sel.addEventListener("change", () => { act = sel.value; draw(); });
    draw();
    return draw;
  };

  // 9. A decision-tree split: Gini impurity and the gain of each cut
  W.split = (box) => {
    const r = rng(21), X = [];
    for (let i = 0; i < 40; i++) X.push([2 + 1.6 * r.normal(), 0]);
    for (let i = 0; i < 40; i++) X.push([5.5 + 1.6 * r.normal(), 1]);
    const gini = (s) => { if (!s.length) return 0; const p = s.filter((q) => q[1]).length / s.length; return 2 * p * (1 - p); };
    const gain = (t) => { const L = X.filter((q) => q[0] <= t), R = X.filter((q) => q[0] > t); return gini(X) - (L.length * gini(L) + R.length * gini(R)) / X.length; };
    const P = plot(box, [-2, 10], [0, 0.3], { ratio: 0.45 });
    const S = plot(box, [-2, 10], [0, 1], { ratio: 0.12 }); S.pad.t = 2; S.pad.b = 4;
    let t = 1;
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); P.axes("vibration level", "Gini gain of the cut", ticks(-2, 10, 6), [0, 0.1, 0.2, 0.3]);
      const g = []; for (let x = -2; x <= 10; x += 0.02) g.push([x, gain(x)]);
      P.clip(() => {
        P.line(g, k.muted, 2);
        P.line([[t, 0], [t, 0.3]], k.r, 2, [5, 4]);
      });
      S.clear(); S.clip(() => {
        const c = S.ctx; c.fillStyle = k.fillB; c.fillRect(S.X(-2), S.Y(1), S.X(t) - S.X(-2), S.Y(0) - S.Y(1)); c.fillStyle = k.fillA; c.fillRect(S.X(t), S.Y(1), S.X(10) - S.X(t), S.Y(0) - S.Y(1));
        X.forEach(([x, l], i) => S.dot(x, (l ? 0.3 : 0.7) + 0.06 * ((i % 5) - 2), l ? k.a : k.b, 3.5));
        S.line([[t, 0], [t, 1]], k.r, 2, [5, 4]);
        S.text("left", S.X(-2) + 4, S.Y(0.5), k.muted); S.text("right", S.X(10) - 4, S.Y(0.5), k.muted, "right");
      });
      const L = X.filter((q) => q[0] <= t), R = X.filter((q) => q[0] > t);
      out.innerHTML = `cut at ${t.toFixed(2)}: left ${L.length} points (Gini ${gini(L).toFixed(3)}), right ${R.length} points (Gini ${gini(R).toFixed(3)}); gain = <b>${gain(t).toFixed(3)}</b>. Orange: healthy, blue: faulty.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    const s = slider(c, "cut position", -2, 10, 0.01, t, (v) => v.toFixed(2), (v) => { t = v; draw(); });
    button(c, "Best cut", () => { let bt = 0, bg = -1; for (let x = -2; x <= 10; x += 0.01) { const g = gain(x); if (g > bg) { bg = g; bt = x; } } s.value = bt; s.dispatchEvent(new Event("input")); });
    draw();
    return draw;
  };

  // 10. Convolution: a 3x3 filter sliding over an image
  W.conv = (box) => {
    const N = 24, img = [];
    for (let i = 0; i < N; i++) { img.push([]); for (let j = 0; j < N; j++) { const d = Math.hypot(i - 12, j - 12); img[i].push((d < 8 && d > 4 ? 1 : 0) + (i > 3 && i < 7 && j > 14 && j < 21 ? 1 : 0)); } }
    const K = {
      "vertical edges": [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], "horizontal edges": [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
      "blur": [[1, 1, 1], [1, 1, 1], [1, 1, 1]].map((r) => r.map((v) => v / 9)), "sharpen": [[0, -1, 0], [-1, 5, -1], [0, -1, 0]], "identity": [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
    };
    const wrap = el("div", { class: "mlw-pair" }, box);
    const cvs = [0, 1].map(() => { const cv = el("canvas", { class: "mlw-canvas mlw-pixels", width: N * 10, height: N * 10 }, wrap); return cv; });
    let name = "vertical edges";
    const out = readout(box);
    const paint = (cv, M, lo, hi) => {
      const c = cv.getContext("2d"), dk = dark();
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const v = (M[i][j] - lo) / (hi - lo || 1), g = Math.round(255 * (dk ? v : 1 - v));
        c.fillStyle = `rgb(${g},${g},${g})`; c.fillRect(j * 10, i * 10, 10, 10);
      }
    };
    const draw = () => {
      const k = K[name], o = [];
      for (let i = 0; i < N; i++) { o.push([]); for (let j = 0; j < N; j++) { let s = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < N && jj < N) s += k[a + 1][b + 1] * img[ii][jj]; } o[i].push(s); } }
      const flat = o.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
      paint(cvs[0], img, 0, 1); paint(cvs[1], o, lo, hi);
      out.innerHTML = `left: the input image · right: the feature map. Filter: <code>${k.map((r) => "[" + r.map((v) => +v.toFixed(2)).join(" ") + "]").join(" ")}</code>`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    const sel = el("select", { class: "mlw-select" }, c);
    Object.keys(K).forEach((n) => el("option", { value: n }, sel, n));
    sel.addEventListener("change", () => { name = sel.value; draw(); });
    draw();
    return draw;
  };

  // 11. Logistic regression: a probability curve through 0/1 data
  W.sigmoid = (box, opts) => {
    const r = rng(13), D = [];
    for (let i = 0; i < 60; i++) { const x = 10 * r(); D.push([x, r() < 1 / (1 + Math.exp(-(-6 + 1.5 * x))) ? 1 : 0]); }
    const P = plot(box, [0, 10], [-0.1, 1.1], { ratio: 0.55 });
    let b0 = -3, b1 = 1;
    const ll = (a, b) => D.reduce((s, [x, y]) => { const p = Math.min(1 - 1e-12, Math.max(1e-12, 1 / (1 + Math.exp(-(a + b * x))))); return s + (y ? Math.log(p) : Math.log(1 - p)); }, 0);
    let best = [0, 0], bl = -1e9;                                     // a coarse grid search for the best fit
    for (let a = -12; a <= 0; a += 0.05) for (let b = 0; b <= 3; b += 0.01) { const v = ll(a, b); if (v > bl) { bl = v; best = [a, b]; } }
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); P.axes(opts.xlabel || "energy (GeV)", opts.ylabel || "P(detected)", ticks(0, 10, 5), [0, 0.5, 1]);
      const pts = []; for (let x = 0; x <= 10.001; x += 0.02) pts.push([x, 1 / (1 + Math.exp(-(b0 + b1 * x)))]);
      P.clip(() => { D.forEach(([x, y]) => P.dot(x, y, y ? k.a : k.b, 3.5)); P.line(pts, k.r, 2.5); P.line([[0, 0.5], [10, 0.5]], k.grid, 1, [4, 4]); });
      out.innerHTML = `log-likelihood = <b>${ll(b0, b1).toFixed(2)}</b> (best possible ${bl.toFixed(2)}) · 50% point at x = −β₀/β₁ = ${b1 ? (-b0 / b1).toFixed(2) : "∞"}`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    const s0 = slider(c, "β₀", -12, 2, 0.05, b0, (v) => v.toFixed(2), (v) => { b0 = v; draw(); });
    const s1 = slider(c, "β₁", 0, 3, 0.01, b1, (v) => v.toFixed(2), (v) => { b1 = v; draw(); });
    button(c, "Maximum likelihood", () => { s0.value = best[0]; s1.value = best[1]; s0.dispatchEvent(new Event("input")); s1.dispatchEvent(new Event("input")); });
    draw();
    return draw;
  };

  // 12. Hubble expansion: from any galaxy, the others recede with v proportional to d
  W.expansion = (box) => {
    const r = rng(17), G = [];
    for (let i = 0; i < 46; i++) G.push([-1 + 2 * r(), -1 + 2 * r()]);
    const wrap = el("div", { class: "mlw-pair" }, box);
    const L = el("div", {}, wrap), Rr = el("div", {}, wrap);
    const P = plot(L, [-1.9, 1.9], [-1.9, 1.9], { ratio: 1, maxWidth: 380 }), Q = plot(Rr, [0, 3], [0, 3], { ratio: 0.9, maxWidth: 360 });
    let a = 1.4, home = 0;
    const out = readout(box);
    const draw = () => {
      const k = C(), H = 1.0;                      // velocity = H x (separation), in arbitrary units
      P.clear(); P.pad = { l: 10, r: 10, t: 10, b: 10 };
      const h = G[home];
      P.clip(() => G.forEach((g, i) => {
        const x = a * g[0], y = a * g[1], dx = a * (g[0] - h[0]), dy = a * (g[1] - h[1]);
        if (i !== home) P.line([[x, y], [x + 0.18 * H * dx, y + 0.18 * H * dy]], k.r, 1.4);
        P.dot(x, y, i === home ? k.b : k.a, i === home ? 7 : 3.6);
      }));
      Q.clear(); Q.axes("distance from home", "recession speed", [0, 1, 2, 3], [0, 1, 2, 3]);
      Q.clip(() => { G.forEach((g, i) => { if (i === home) return; const d = a * Math.hypot(g[0] - h[0], g[1] - h[1]); Q.dot(d, H * d, k.a, 3.2); }); Q.line([[0, 0], [3, 3 * H]], k.r, 1.5, [4, 3]); });
      out.innerHTML = `The orange galaxy is "home". Every other galaxy moves away (red arrows), and its speed is proportional to its distance: <b>v = H₀ d</b>. Pick another home: the law is the same from everywhere. There is no centre.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "size of the Universe (time)", 1, 2, 0.01, a, (v) => "× " + v.toFixed(2), (v) => { a = v; draw(); });
    button(c, "Choose another home galaxy", () => { home = (home + 7) % G.length; draw(); });
    draw(); return draw;
  };

  // 13. A solar panel: power from irradiance and temperature
  W.solar = (box) => {
    const model = (G, T) => 0.26 * G * (1 - 0.004 * (T - 25));
    const r = rng(19), data = [];
    for (let i = 0; i < 40; i++) { const G = 100 + 800 * r(), T = 15 + 30 * r(); data.push([G, T, model(G, T) + 4 * r.normal()]); }
    const P = plot(box, [0, 1000], [0, 260], { ratio: 0.55 });
    let G = 600, T = 30;
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); P.axes("irradiance G (W/m²)", "power P (W)", ticks(0, 1000, 5), ticks(0, 250, 5));
      P.clip(() => {
        [[15, k.a], [35, k.b], [55, k.r]].forEach(([t, col]) => { P.line([[0, 0], [1000, model(1000, t)]], col, 1.6, [5, 4]); });
        data.forEach(([g, t, p]) => P.dot(g, p, k.muted, 3));
        P.dot(G, model(G, T), k.g, 8);
      });
      legend(P, [["model at 15 °C", k.a, [5, 4]], ["model at 35 °C", k.b, [5, 4]], ["model at 55 °C", k.r, [5, 4]], ["readings", k.muted, null, "dot"], ["your panel", k.g, null, "dot"]], "left");
      const p = model(G, T);
      out.innerHTML = `P = 0.26 · G · [1 − 0.004 (T − 25)] = <b>${p.toFixed(1)} W</b>. A hotter panel gives less power at the same sunlight: at G = ${G.toFixed(0)} W/m² going from 15 °C to 55 °C loses ${(model(G, 15) - model(G, 55)).toFixed(1)} W. Grey dots: 40 real-looking readings.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "sunlight G (W/m²)", 0, 1000, 5, G, (v) => v.toFixed(0), (v) => { G = v; draw(); });
    slider(c, "panel temperature T (°C)", 10, 60, 1, T, (v) => v.toFixed(0) + " °C", (v) => { T = v; draw(); });
    draw(); return draw;
  };

  // 14. The bootstrap: resample with replacement, many times
  W.bootstrap = (box) => {
    const r = rng(23), x = []; for (let i = 0; i < 20; i++) x.push(70 + 8 * r.normal());
    const n = x.length, mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, m0 = mean(x);
    const sdx = Math.sqrt(x.reduce((s, v) => s + (v - m0) ** 2, 0) / (n - 1));
    const wrap = el("div", { class: "mlw-pair" }, box);
    const L = el("div", {}, wrap), Rr = el("div", {}, wrap);
    const P = plot(L, [0, 21], [0, 4.5], { ratio: 0.55, maxWidth: 420 }), Q = plot(Rr, [62, 78], [0, 1], { ratio: 0.7, maxWidth: 360 });
    let counts = new Array(n).fill(0), means = [], q = rng(99);
    const out = readout(box);
    const one = () => { counts = new Array(n).fill(0); for (let i = 0; i < n; i++) counts[Math.floor(q() * n)]++; means.push(x.reduce((s, v, i) => s + v * counts[i], 0) / n); };
    const draw = () => {
      const k = C(); P.clear(); P.axes("data point (20 measurements of H₀)", "times picked", [1, 5, 10, 15, 20], [0, 1, 2, 3, 4]);
      const c = P.ctx; counts.forEach((ct, i) => { c.fillStyle = ct ? k.a : k.grid; c.fillRect(P.X(i + 0.65), P.Y(Math.max(ct, 0.08)), P.X(1) - P.X(0.3), P.Y(0) - P.Y(Math.max(ct, 0.08))); });
      Q.clear(); Q.axes("bootstrap estimate of the mean H₀", "", [64, 68, 72, 76], []);
      if (means.length) {
        const bins = new Array(32).fill(0); means.forEach((m) => { const b = Math.floor((m - 62) / 0.5); if (b >= 0 && b < 32) bins[b]++; });
        const mx = Math.max(...bins); bins.forEach((b, i) => { Q.ctx.fillStyle = k.fillA; Q.ctx.strokeStyle = k.a; const x0 = Q.X(62 + 0.5 * i), x1 = Q.X(62.5 + 0.5 * i), y = Q.Y(0.95 * b / mx); Q.ctx.fillRect(x0, y, x1 - x0, Q.Y(0) - y); Q.ctx.strokeRect(x0, y, x1 - x0, Q.Y(0) - y); });
      }
      Q.line([[m0, 0], [m0, 1]], k.r, 2, [5, 4]);
      const se = means.length > 1 ? Math.sqrt(means.reduce((s, v) => s + (v - mean(means)) ** 2, 0) / (means.length - 1)) : NaN;
      out.innerHTML = `${means.length} bootstrap samples. Each one picks 20 points <b>with replacement</b> (left: how often each point was picked; grey = left out). ` +
        `Spread of the estimates (bootstrap SE) = <b>${isNaN(se) ? "–" : se.toFixed(2)}</b>; the formula s/√n gives ${(sdx / Math.sqrt(n)).toFixed(2)}.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    button(c, "Draw one bootstrap sample", () => { one(); draw(); });
    button(c, "Draw 100", () => { for (let i = 0; i < 100; i++) one(); draw(); });
    button(c, "Draw 1000", () => { for (let i = 0; i < 1000; i++) one(); draw(); });
    button(c, "Reset", () => { means = []; counts = new Array(n).fill(0); draw(); });
    one(); draw(); return draw;
  };

  // 15. k-fold cross-validation picks the polynomial degree
  W.cv = (box) => {
    const r = rng(29), f = (x) => Math.sin(2.6 * x) + 0.3 * x, D = [];
    for (let i = 0; i < 40; i++) { const x = -1 + 2 * r(); D.push([x, f(x) + 0.28 * r.normal()]); }
    const wrap = el("div", { class: "mlw-pair" }, box);
    const L = el("div", {}, wrap), Rr = el("div", {}, wrap);
    const P = plot(L, [0, 40], [0, 10], { ratio: 0.55, maxWidth: 420 }), Q = plot(Rr, [1, 10], [0, 0.5], { ratio: 0.8, maxWidth: 340 });
    let K = 5;
    const out = readout(box);
    const draw = () => {
      const k = C(), folds = D.map((_, i) => i % K);
      P.clear(); P.pad = { l: 60, r: 10, t: 10, b: 24 };
      const c = P.ctx, rows = Math.min(K, 10);
      for (let f0 = 0; f0 < rows; f0++) for (let i = 0; i < 40; i++) {
        c.fillStyle = folds[i] === f0 ? k.b : k.a; const y = P.Y(10 - f0 * 10 / rows - 0.15), h = P.Y(0) - P.Y(10 / rows - 0.3);
        c.fillRect(P.X(i) + 0.5, y, P.X(1) - P.X(0) - 1, h);
      }
      for (let f0 = 0; f0 < rows; f0++) P.text(`fit ${f0 + 1}`, 4, P.Y(10 - (f0 + 0.5) * 10 / rows), k.muted);
      P.text("blue: fit on these   orange: measure the error", P.X(0), P.h - 8, k.muted);
      const cv = [];
      for (let d = 1; d <= 10; d++) {
        let e = 0;
        for (let f0 = 0; f0 < K; f0++) {
          const tr = D.filter((_, i) => folds[i] !== f0), te = D.filter((_, i) => folds[i] === f0);
          const g = polyfit(tr.map((p) => p[0]), tr.map((p) => p[1]), d, 1e-9); e += te.reduce((s, [x, y]) => s + (g(x) - y) ** 2, 0);
        }
        cv.push([d, e / D.length]);
      }
      const best = cv.reduce((a, b) => (b[1] < a[1] ? b : a));
      Q.clear(); Q.axes("polynomial degree", "CV error", [1, 4, 7, 10], [0, 0.25, 0.5]);
      Q.clip(() => { Q.line(cv, k.r, 2.2); cv.forEach(([d, e]) => Q.dot(d, e, d === best[0] ? k.g : k.r, d === best[0] ? 7 : 3.5)); });
      out.innerHTML = `${K}-fold cross-validation: ${K} fits, each tested on the left-out fold. The CV error is lowest at <b>degree ${best[0]}</b> (green point).` + (K === 40 ? " With K = 40 = n this is LOOCV." : "");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "number of folds K", 2, 40, 1, K, (v) => v.toFixed(0) + (v === 40 ? " (LOOCV)" : ""), (v) => { K = v; draw(); });
    draw(); return draw;
  };

  // 16. Linear SVM: the soft margin and the cost C
  W.svm = (box) => {
    const r = rng(31), D = [];
    for (let i = 0; i < 30; i++) D.push([0.3 + 0.09 * r.normal(), 0.32 + 0.09 * r.normal(), -1]);
    for (let i = 0; i < 30; i++) D.push([0.68 + 0.09 * r.normal(), 0.68 + 0.09 * r.normal(), 1]);
    const P = plot(box, [0, 1], [0, 1], { ratio: 0.72, maxWidth: 560 });
    let logC = 0;
    const out = readout(box);
    const fit = (Cc) => {               // primal sub-gradient descent on the hinge loss
      let w = [0, 0], b = 0; const lam = 1 / (Cc * D.length);
      for (let t = 1; t <= 3000; t++) {
        const eta = 1 / (lam * t + 50); let gw = [lam * w[0], lam * w[1]], gb = 0;
        D.forEach(([x, y, l]) => { if (l * (w[0] * x + w[1] * y + b) < 1) { gw[0] -= l * x / D.length; gw[1] -= l * y / D.length; gb -= l / D.length; } });
        w = [w[0] - eta * gw[0], w[1] - eta * gw[1]]; b -= eta * gb * 5;
      }
      return [w, b];
    };
    const draw = () => {
      const k = C(), [w, b] = fit(Math.pow(10, logC)), nw = Math.hypot(w[0], w[1]) || 1e-9;
      P.clear(); P.axes("feature 1", "feature 2", [0, 0.5, 1], [0, 0.5, 1]);
      const yAt = (x, off) => (off - b - w[0] * x) / w[1];
      P.clip(() => {
        P.line([[0, yAt(0, 0)], [1, yAt(1, 0)]], k.ink, 2.4); P.line([[0, yAt(0, 1)], [1, yAt(1, 1)]], k.muted, 1.2, [5, 4]); P.line([[0, yAt(0, -1)], [1, yAt(1, -1)]], k.muted, 1.2, [5, 4]);
        let sv = 0;
        D.forEach(([x, y, l]) => { const m = l * (w[0] * x + w[1] * y + b); P.dot(x, y, l > 0 ? k.b : k.a, 4); if (m <= 1.0001) { sv++; const c = P.ctx; c.strokeStyle = k.ink; c.lineWidth = 1.4; c.beginPath(); c.arc(P.X(x), P.Y(y), 8, 0, 2 * Math.PI); c.stroke(); } });
        out.innerHTML = `C = ${Math.pow(10, logC).toPrecision(2)}: margin width 2/‖β‖ = <b>${(2 / nw).toFixed(3)}</b>, support vectors (circled: on or inside the margin) = <b>${sv}</b>. Small C: a wide, tolerant street. Large C: a narrow street that tries to classify every point.`;
      });
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "cost C (log₁₀)", -2, 2, 0.1, logC, (v) => "C = " + Math.pow(10, v).toPrecision(2), (v) => { logC = v; draw(); });
    draw(); return draw;
  };

  // 17. A classification tree grows: depth by depth
  W.tree2d = (box) => {
    const r = rng(37), gen = (n) => { const a = []; for (let i = 0; i < n; i++) { const x = r(), y = r(); const p = (x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.09 ? 0.9 : 0.12; a.push([x, y, r() < p ? 1 : 0]); } return a; };
    const tr = gen(200), te = gen(800);
    const P = plot(box, [0, 1], [0, 1], { ratio: 0.75, maxWidth: 560 });
    let depth = 1;
    const out = readout(box);
    const gini = (s) => { if (!s.length) return 0; const p = s.filter((q) => q[2]).length / s.length; return 2 * p * (1 - p); };
    const grow = (S, d, box2) => {
      const p = S.filter((q) => q[2]).length / Math.max(1, S.length);
      if (d === 0 || S.length < 5 || p === 0 || p === 1) return { leaf: true, cls: p >= 0.5 ? 1 : 0, box: box2 };
      let best = null;
      for (const f of [0, 1]) for (let t = 0.05; t < 0.96; t += 0.025) {
        const Lf = S.filter((q) => q[f] < t), Rf = S.filter((q) => q[f] >= t); if (!Lf.length || !Rf.length) continue;
        const g = (Lf.length * gini(Lf) + Rf.length * gini(Rf)) / S.length; if (!best || g < best[0]) best = [g, f, t, Lf, Rf];
      }
      if (!best) return { leaf: true, cls: p >= 0.5 ? 1 : 0, box: box2 };
      const [, f, t, Lf, Rf] = best, bl = box2.slice(), br = box2.slice();
      if (f === 0) { bl[1] = t; br[0] = t; } else { bl[3] = t; br[2] = t; }
      return { f, t, l: grow(Lf, d - 1, bl), r: grow(Rf, d - 1, br) };
    };
    const pred = (n, q) => (n.leaf ? n.cls : q[n.f] < n.t ? pred(n.l, q) : pred(n.r, q));
    const leaves = (n, a) => { if (n.leaf) a.push(n); else { leaves(n.l, a); leaves(n.r, a); } return a; };
    const draw = () => {
      const k = C(), T = grow(tr, depth, [0, 1, 0, 1]); P.clear(); P.axes("feature 1", "feature 2", [0, 0.5, 1], [0, 0.5, 1]);
      const c = P.ctx, Ls = leaves(T, []);
      Ls.forEach((L) => { const [x0, x1, y0, y1] = L.box; c.fillStyle = L.cls ? k.fillA : k.fillB; c.fillRect(P.X(x0), P.Y(y1), P.X(x1) - P.X(x0), P.Y(y0) - P.Y(y1)); c.strokeStyle = k.muted; c.lineWidth = 0.8; c.strokeRect(P.X(x0), P.Y(y1), P.X(x1) - P.X(x0), P.Y(y0) - P.Y(y1)); });
      tr.forEach(([x, y, l]) => P.dot(x, y, l ? k.a : k.b, 3));
      const err = (S) => S.filter((q) => pred(T, q) !== q[2]).length / S.length;
      out.innerHTML = `depth ${depth}: ${Ls.length} boxes (leaves). Training error <b>${(100 * err(tr)).toFixed(1)}%</b>, test error <b>${(100 * err(te)).toFixed(1)}%</b>. Deep trees chase every point: the training error keeps falling, the test error does not.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "tree depth", 1, 10, 1, depth, (v) => v.toFixed(0), (v) => { depth = v; draw(); });
    draw(); return draw;
  };

  // 18. A small neural network learns, live
  W.mlp = (box) => {
    const r = rng(41), D = [];
    for (let i = 0; i < 160; i++) { const a = 2 * Math.PI * r(), inner = i % 2 === 0, rad = inner ? 0.45 * Math.sqrt(r()) : 0.75 + 0.25 * r(); D.push([rad * Math.cos(a), rad * Math.sin(a), inner ? 1 : 0]); }
    const P = plot(box, [-1.1, 1.1], [-1.1, 1.1], { ratio: 0.75, maxWidth: 520 });
    let H = 6, lr = 0.5, net, epoch, timer = null, loss = NaN;
    const init = () => { const q = rng(7 + H); net = { W1: [], b1: [], W2: [], b2: 0 }; for (let h = 0; h < H; h++) { net.W1.push([2 * q.normal(), 2 * q.normal()]); net.b1.push(q.normal()); net.W2.push(q.normal()); } epoch = 0; };
    const fwd = (x, y) => { const h = net.W1.map((w, j) => Math.tanh(w[0] * x + w[1] * y + net.b1[j])); const z = h.reduce((s, v, j) => s + v * net.W2[j], net.b2); return [h, 1 / (1 + Math.exp(-z))]; };
    const train = (n) => {
      for (let e = 0; e < n; e++) {
        const gW1 = net.W1.map(() => [0, 0]), gb1 = new Array(H).fill(0), gW2 = new Array(H).fill(0); let gb2 = 0; loss = 0;
        D.forEach(([x, y, l]) => {
          const [h, p] = fwd(x, y), d = p - l; loss -= l ? Math.log(p + 1e-12) : Math.log(1 - p + 1e-12); gb2 += d;
          for (let j = 0; j < H; j++) { gW2[j] += d * h[j]; const dh = d * net.W2[j] * (1 - h[j] * h[j]); gW1[j][0] += dh * x; gW1[j][1] += dh * y; gb1[j] += dh; }
        });
        const m = D.length; for (let j = 0; j < H; j++) { net.W1[j][0] -= lr * gW1[j][0] / m; net.W1[j][1] -= lr * gW1[j][1] / m; net.b1[j] -= lr * gb1[j] / m; net.W2[j] -= lr * gW2[j] / m; }
        net.b2 -= lr * gb2 / m; loss /= m; epoch++;
      }
    };
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); P.axes("x₁", "x₂", [-1, 0, 1], [-1, 0, 1]);
      const c = P.ctx, N = 44, st = 2.2 / N;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const p = fwd(-1.1 + (i + 0.5) * st, -1.1 + (j + 0.5) * st)[1]; c.fillStyle = p > 0.5 ? k.fillA : k.fillB; c.fillRect(P.X(-1.1 + i * st), P.Y(-1.1 + (j + 1) * st), P.X(st) - P.X(0) + 0.6, P.Y(0) - P.Y(st) + 0.6); }
      D.forEach(([x, y, l]) => P.dot(x, y, l ? k.a : k.b, 3));
      const acc = D.filter(([x, y, l]) => (fwd(x, y)[1] > 0.5 ? 1 : 0) === l).length / D.length;
      out.innerHTML = `${H} hidden units · epoch ${epoch} · loss ${isNaN(loss) ? "–" : loss.toFixed(3)} · accuracy <b>${(100 * acc).toFixed(1)}%</b>. No straight line separates the disc from the ring; the hidden layer bends the boundary.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "hidden units", 1, 16, 1, H, (v) => v.toFixed(0), (v) => { H = v; init(); draw(); });
    slider(c, "learning rate", 0.05, 2, 0.05, lr, (v) => v.toFixed(2), (v) => { lr = v; });
    const go = button(c, "Train", () => {
      if (timer) { clearInterval(timer); timer = null; go.textContent = "Train"; return; }
      go.textContent = "Pause"; timer = setInterval(() => { train(10); draw(); if (epoch >= 3000) { clearInterval(timer); timer = null; go.textContent = "Train"; } }, 40);
    });
    button(c, "Reset", () => { init(); loss = NaN; draw(); });
    init(); draw(); return draw;
  };

  // 19. Q-learning in a grid world
  W.qlearn = (box) => {
    const N = 5, goal = [4, 4], pits = [[1, 3], [3, 1], [2, 2]], acts = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    let Q, eps = 0.2, rewards = [], q = rng(53);
    const reset = () => { Q = Array.from({ length: N * N }, () => [0, 0, 0, 0]); rewards = []; };
    const isPit = (x, y) => pits.some(([a, b]) => a === x && b === y);
    const episode = () => {
      let x = 0, y = 0, tot = 0;
      for (let t = 0; t < 60; t++) {
        const s = y * N + x; const a = q() < eps ? Math.floor(q() * 4) : Q[s].indexOf(Math.max(...Q[s]));
        const nx = Math.min(N - 1, Math.max(0, x + acts[a][0])), ny = Math.min(N - 1, Math.max(0, y + acts[a][1]));
        const done = (nx === goal[0] && ny === goal[1]) || isPit(nx, ny), rew = nx === goal[0] && ny === goal[1] ? 10 : isPit(nx, ny) ? -10 : -0.1;
        const ns = ny * N + nx; Q[s][a] += 0.5 * (rew + (done ? 0 : 0.9 * Math.max(...Q[ns])) - Q[s][a]);
        x = nx; y = ny; tot += rew; if (done) break;
      }
      rewards.push(tot);
    };
    const wrap = el("div", { class: "mlw-pair" }, box);
    const L = el("div", {}, wrap), Rr = el("div", {}, wrap);
    const P = plot(L, [0, N], [0, N], { ratio: 1, maxWidth: 340 }), Pl = plot(Rr, [0, 1], [-12, 12], { ratio: 0.8, maxWidth: 340 });
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); P.pad = { l: 8, r: 8, t: 8, b: 8 }; const c = P.ctx;
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        c.fillStyle = x === goal[0] && y === goal[1] ? k.g : isPit(x, y) ? k.r : k.grid; c.globalAlpha = x === goal[0] && y === goal[1] || isPit(x, y) ? 0.7 : 0.35;
        c.fillRect(P.X(x) + 2, P.Y(y + 1) + 2, P.X(1) - P.X(0) - 4, P.Y(0) - P.Y(1) - 4); c.globalAlpha = 1;
        if (!(x === goal[0] && y === goal[1]) && !isPit(x, y)) {
          const s = y * N + x, a = Q[s].indexOf(Math.max(...Q[s])), cx = x + 0.5, cy = y + 0.5, known = Math.max(...Q[s].map(Math.abs)) > 1e-6;
          if (known) { P.line([[cx - 0.25 * acts[a][0], cy - 0.25 * acts[a][1]], [cx + 0.3 * acts[a][0], cy + 0.3 * acts[a][1]]], k.ink, 2.4); P.dot(cx + 0.3 * acts[a][0], cy + 0.3 * acts[a][1], k.ink, 3.5); }
        }
      }
      P.text("start", P.X(0.08), P.Y(0.15), k.muted); P.text("goal +10", P.X(4.05), P.Y(4.5), "#fff"); pits.forEach(([a, b]) => P.text("−10", P.X(a + 0.3), P.Y(b + 0.5), "#fff"));
      Pl.xr = [0, Math.max(10, rewards.length)]; Pl.clear(); Pl.axes("episode", "total reward", [0, Pl.xr[1]], [-10, 0, 10]);
      Pl.clip(() => Pl.line(rewards.map((v, i) => [i + 1, v]), k.a, 1.5));
      out.innerHTML = `${rewards.length} episodes. Arrows: the best action the agent has learned in each square (the greedy policy). Exploration ε = ${eps.toFixed(2)}: the chance of a random move.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    button(c, "Run 1 episode", () => { episode(); draw(); });
    button(c, "Run 50", () => { for (let i = 0; i < 50; i++) episode(); draw(); });
    button(c, "Reset", () => { reset(); draw(); });
    slider(c, "exploration ε", 0, 1, 0.05, eps, (v) => v.toFixed(2), (v) => { eps = v; });
    reset(); draw(); return draw;
  };

  // 20. A damped oscillator: fit the physics by hand
  W.oscillator = (box) => {
    const r = rng(59), truth = (t) => Math.exp(-0.15 * t) * Math.cos(Math.sqrt(4 - 0.0225) * t), D = [];
    for (let i = 0; i < 26; i++) { const t = 0.25 + i * 0.3; D.push([t, truth(t) + 0.05 * r.normal()]); }
    const P = plot(box, [0, 16], [-1.2, 1.2], { ratio: 0.45 });
    let g = 0.4, w = 1.5;
    const out = readout(box);
    const model = (t) => Math.exp(-g * t) * Math.cos(Math.sqrt(Math.max(1e-6, w * w - g * g)) * t);
    const draw = () => {
      const k = C(); P.clear(); P.axes("time t", "x(t)", ticks(0, 16, 8), [-1, 0, 1]);
      const m = []; for (let t = 0; t <= 16.001; t += 0.04) m.push([t, model(t)]);
      P.clip(() => { P.line([[8, -1.2], [8, 1.2]], k.grid, 1, [4, 4]); P.line(m, k.b, 2.4); D.forEach(([t, x]) => P.dot(t, x, k.a, 3.8)); });
      P.text("measured", P.X(0.4), P.Y(1.1), k.a); P.text("no data here: the physics must carry the curve", P.X(8.3), P.Y(1.1), k.muted);
      const mse = D.reduce((s, [t, x]) => s + (model(t) - x) ** 2, 0) / D.length;
      out.innerHTML = `model ẍ + 2γẋ + ω²x = 0 with γ = ${g.toFixed(2)}, ω = ${w.toFixed(2)}: data error (MSE) = <b>${mse.toFixed(4)}</b>. When the physics is right, the curve also predicts the future (t > 8), where a plain network fitted to the data has no idea.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "damping γ", 0, 0.6, 0.01, g, (v) => v.toFixed(2), (v) => { g = v; draw(); });
    slider(c, "frequency ω", 0.5, 3, 0.01, w, (v) => v.toFixed(2), (v) => { w = v; draw(); });
    draw(); return draw;
  };

  // 21. EM for a mixture of two Gaussians (1-D)
  W.em = (box) => {
    const r = rng(61), X = []; for (let i = 0; i < 160; i++) X.push(i < 100 ? 0.45 + 0.13 * r.normal() : 1.15 + 0.1 * r.normal());
    const P = plot(box, [-0.2, 1.6], [-0.9, 4.5], { ratio: 0.5 });
    let mu, sd, pi, it, resp = null;
    const init = () => { mu = [0.2, 1.4]; sd = [0.3, 0.3]; pi = [0.5, 0.5]; it = 0; resp = null; };
    const N = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
    const step = () => {
      resp = X.map((x) => { const a = pi[0] * N(x, mu[0], sd[0]), b = pi[1] * N(x, mu[1], sd[1]); return a / (a + b); });
      const n0 = resp.reduce((s, v) => s + v, 0), n1 = X.length - n0;
      mu = [X.reduce((s, x, i) => s + resp[i] * x, 0) / n0, X.reduce((s, x, i) => s + (1 - resp[i]) * x, 0) / n1];
      sd = [Math.sqrt(X.reduce((s, x, i) => s + resp[i] * (x - mu[0]) ** 2, 0) / n0) + 1e-3, Math.sqrt(X.reduce((s, x, i) => s + (1 - resp[i]) * (x - mu[1]) ** 2, 0) / n1) + 1e-3];
      pi = [n0 / X.length, n1 / X.length]; it++;
    };
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); P.axes("colour B − V", "density", ticks(-0.2, 1.6, 6), [0, 2, 4]);
      const bins = new Array(36).fill(0); X.forEach((x) => { const b = Math.floor((x + 0.2) / 0.05); if (b >= 0 && b < 36) bins[b]++; });
      bins.forEach((b, i) => { P.ctx.fillStyle = k.grid; const h = b / (X.length * 0.05); P.ctx.fillRect(P.X(-0.2 + 0.05 * i) + 1, P.Y(h), P.X(0.05) - P.X(0) - 2, P.Y(0) - P.Y(h)); });
      const c0 = [], c1 = []; for (let x = -0.2; x <= 1.6; x += 0.01) { c0.push([x, pi[0] * N(x, mu[0], sd[0])]); c1.push([x, pi[1] * N(x, mu[1], sd[1])]); }
      P.clip(() => { P.line(c0, k.a, 2.4); P.line(c1, k.b, 2.4); P.line([[-0.2, 0], [1.6, 0]], k.grid, 1); X.forEach((x, i) => P.dot(x, -0.3 - 0.18 * (i % 3), resp ? (resp[i] > 0.5 ? k.a : k.b) : k.muted, 2.6)); });
      legend(P, [["population 1", k.a], ["population 2", k.b], ["stars (colour = more likely population)", k.muted, null, "dot"]]);
      out.innerHTML = `iteration ${it}: blue μ = ${mu[0].toFixed(3)}, σ = ${sd[0].toFixed(3)}, weight ${pi[0].toFixed(2)} · orange μ = ${mu[1].toFixed(3)}, σ = ${sd[1].toFixed(3)}, weight ${pi[1].toFixed(2)}. ` +
        `<b>E-step</b>: each star gets a probability of belonging to each population; <b>M-step</b>: refit each bell curve with those weights.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    button(c, "One EM iteration", () => { step(); draw(); });
    button(c, "Run 20", () => { for (let i = 0; i < 20; i++) step(); draw(); });
    button(c, "Reset", () => { init(); draw(); });
    init(); draw(); return draw;
  };

  // ------------------------------------------------------------------ start
  // ------------------------------------------------------------------ helpers for the newer widgets
  function eigSym(A0) {                          // Jacobi rotations: eigenvalues and eigenvectors of a small symmetric matrix
    const n = A0.length, A = A0.map((r) => r.slice()), V = A0.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 80; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-16) continue;
        const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th);
        for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
      }
    }
    const idx = A.map((_, i) => i).sort((i, j) => A[j][j] - A[i][i]);
    return { vals: idx.map((i) => Math.max(A[i][i], 0)), vecs: idx.map((i) => V.map((row) => row[i])) };
  }

  function lsq(rows, y, lam) {                    // least squares on a design matrix (array of rows), tiny ridge for stability
    const p = rows[0].length, A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
    rows.forEach((r, k) => { for (let i = 0; i < p; i++) { b[i] += r[i] * y[k]; for (let j = 0; j < p; j++) A[i][j] += r[i] * r[j]; } });
    for (let i = 0; i < p; i++) A[i][i] += (lam || 1e-8) * rows.length;
    for (let i = 0; i < p; i++) {
      let m = i; for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
      for (let r = i + 1; r < p; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < p; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const w = new Array(p).fill(0);
    for (let i = p - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < p; c++) s -= A[i][c] * w[c]; w[i] = s / A[i][i]; }
    return w;
  }

  function choose(box, label, options, value, onChange) {
    const row = el("label", { class: "mlw-row mlw-row-tight" }, box);
    if (label) el("span", { class: "mlw-label" }, row, label);
    const s = el("select", { class: "mlw-select" }, row);
    options.forEach((o) => { const e = el("option", { value: o }, s, o); if (o === value) e.selected = true; });
    s.addEventListener("change", () => onChange(s.value));
    return s;
  }

  function checkbox(box, label, checked, onChange) {
    const row = el("label", { class: "mlw-check" }, box);
    const c = el("input", { type: "checkbox" }, row); c.checked = checked;
    el("span", {}, row, " " + label);
    c.addEventListener("change", () => onChange(c.checked));
    return c;
  }

  function animate(ms, onFrame, onDone) {        // calls onFrame(t) with t from 0 to 1 (eased); returns a stop function
    let stop = false; const t0 = performance.now();
    const f = (now) => {
      if (stop) return;
      const t = Math.min(1, (now - t0) / ms), e = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      onFrame(e);
      if (t < 1) requestAnimationFrame(f); else if (onDone) onDone();
    };
    requestAnimationFrame(f);
    return () => { stop = true; };
  }

  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  // a 3-D view: drag to turn, optional automatic spin
  function view3d(box, opts) {
    opts = opts || {};
    const cv = el("canvas", { class: "mlw-canvas mlw-3d" }, box);
    cv.style.touchAction = "none"; cv.style.cursor = "grab";
    const V = { cv, yaw: opts.yaw === undefined ? -0.7 : opts.yaw, pitch: opts.pitch === undefined ? 0.4 : opts.pitch, scale: opts.scale || 0.25, redraw: () => {} };
    V.resize = () => {
      const w = Math.min(box.clientWidth || 520, opts.maxWidth || 520), h = Math.round(w * (opts.ratio || 0.82)), d = window.devicePixelRatio || 1;
      cv.width = w * d; cv.height = h * d; cv.style.width = w + "px"; cv.style.height = h + "px";
      V.w = w; V.h = h; V.ctx = cv.getContext("2d"); V.ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    V.proj = (p) => {
      const cy = Math.cos(V.yaw), sy = Math.sin(V.yaw), cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
      const xr = cy * p[0] - sy * p[1], yr = sy * p[0] + cy * p[1], z = p[2] || 0;
      const s = V.scale * Math.min(V.w, V.h);
      return [V.w / 2 + s * xr, V.h / 2 - s * (cp * z + sp * yr), -sp * z + cp * yr];
    };
    V.clear = () => V.ctx.clearRect(0, 0, V.w, V.h);
    V.line = (a, b, col, w, dash) => {
      const c = V.ctx, A = V.proj(a), B = V.proj(b);
      c.strokeStyle = col; c.lineWidth = w || 1.5; c.setLineDash(dash || []);
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); c.setLineDash([]);
    };
    V.path = (pts, col, w, dash) => {
      const c = V.ctx; c.strokeStyle = col; c.lineWidth = w || 1.5; c.setLineDash(dash || []);
      c.beginPath(); pts.forEach((p, i) => { const q = V.proj(p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); c.setLineDash([]);
    };
    V.poly = (pts, fill, stroke) => {
      const c = V.ctx; c.beginPath(); pts.forEach((p, i) => { const q = V.proj(p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
    };
    V.dot = (p, col, r) => { const c = V.ctx, q = V.proj(p); c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], r || 3, 0, 2 * Math.PI); c.fill(); };
    V.ring = (p, col, r) => { const c = V.ctx, q = V.proj(p); c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.arc(q[0], q[1], r || 5, 0, 2 * Math.PI); c.stroke(); };
    V.text = (s, p, col) => { const c = V.ctx, q = V.proj(p); c.fillStyle = col; c.font = "13px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, q[0], q[1]); };
    V.axes = (len, names) => {
      const k = C();
      [[len, 0, 0], [0, len, 0], [0, 0, len]].forEach((e, i) => {
        V.line([-e[0], -e[1], -e[2]], e, k.grid, 1);
        V.text(names[i], [e[0] * 1.12, e[1] * 1.12, e[2] * 1.12], k.muted);
      });
    };
    V.arrow = (a, b, col, label) => {
      const c = V.ctx, A = V.proj(a), B = V.proj(b), ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
      c.beginPath(); c.moveTo(B[0], B[1]); c.lineTo(B[0] - 10 * Math.cos(ang - 0.4), B[1] - 10 * Math.sin(ang - 0.4));
      c.lineTo(B[0] - 10 * Math.cos(ang + 0.4), B[1] - 10 * Math.sin(ang + 0.4)); c.closePath(); c.fill();
      if (label) { c.font = "bold 13px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(label, B[0] + 14 * Math.cos(ang), B[1] + 14 * Math.sin(ang)); }
    };
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; V.stopSpin(); });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      V.yaw += (e.clientX - drag[0]) * 0.01; V.pitch = Math.max(-1.5, Math.min(1.5, V.pitch + (e.clientY - drag[1]) * 0.01));
      drag = [e.clientX, e.clientY]; V.redraw();
    });
    const end = () => { drag = null; cv.style.cursor = "grab"; };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    let spinning = false;
    V.spin = () => {
      if (spinning) return; spinning = true;
      let last = performance.now();
      const f = (now) => { if (!spinning) return; V.yaw += (now - last) * 0.0006; last = now; V.redraw(); requestAnimationFrame(f); };
      requestAnimationFrame(f);
    };
    V.stopSpin = () => { spinning = false; };
    V.spinning = () => spinning;
    V.resize();
    return V;
  }

  // 22. PCA explorer: 2-D and 3-D data, components kept, scree with cumulative variance, loadings, rotation to the PC axes
  W.pcaexplore = (box) => {
    const k0 = C();
    const SETS = {
      "2-D: a tilted cloud": { p: 2, sd: [1.5, 0.45], names: ["x₁", "x₂"] },
      "3-D: a flat pancake": { p: 3, sd: [1.6, 1.0, 0.18], names: ["x₁", "x₂", "x₃"] },
      "3-D: a cigar": { p: 3, sd: [1.8, 0.32, 0.22], names: ["x₁", "x₂", "x₃"] },
      "3-D: a round ball": { p: 3, sd: [0.95, 0.9, 0.85], names: ["x₁", "x₂", "x₃"] },
      "3 sensors that move together": { p: 3, sensors: true, names: ["flow", "pressure", "current"] },
    };
    const NAMES = Object.keys(SETS);
    let set = SETS[NAMES[0]], X = [], mean = [], Xc = [], E = null, keep = 1, recon = true, t = 0, stopAnim = null;
    const R3 = (() => {                            // a fixed 3-D rotation, so the cloud is not aligned with the axes
      const a = 0.7, b = 0.5, c = 0.4;
      const Rz = [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
      const Ry = [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]];
      const Rx = [[1, 0, 0], [0, Math.cos(c), -Math.sin(c)], [0, Math.sin(c), Math.cos(c)]];
      const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, i) => s + v * B[i][j], 0)));
      return mul(Rz, mul(Ry, Rx));
    })();
    const make = () => {
      const r = rng(21); X = [];
      for (let i = 0; i < 180; i++) {
        if (set.sensors) {                          // the load drives all three sensors; each has its own noise
          const load = 1.3 * r.normal();
          X.push([load + 0.35 * r.normal(), 0.9 * load + 0.4 * r.normal(), 1.1 * load + 0.3 * r.normal()]);
        } else if (set.p === 2) {
          const a = set.sd[0] * r.normal(), b = set.sd[1] * r.normal(), th = 0.6;
          X.push([a * Math.cos(th) - b * Math.sin(th), a * Math.sin(th) + b * Math.cos(th)]);
        } else {
          const z = set.sd.map((s) => s * r.normal());
          X.push(R3.map((row) => row[0] * z[0] + row[1] * z[1] + row[2] * z[2]));
        }
      }
      const p = set.p, n = X.length;
      mean = new Array(p).fill(0); X.forEach((x) => x.forEach((v, j) => { mean[j] += v / n; }));
      Xc = X.map((x) => x.map((v, j) => v - mean[j]));
      const S = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => Xc.reduce((s, x) => s + x[i] * x[j], 0) / n));
      E = eigSym(S);
      E.vecs = E.vecs.map((v) => { let m = 0; v.forEach((x, j) => { if (Math.abs(x) > Math.abs(v[m])) m = j; }); return v[m] < 0 ? v.map((x) => -x) : v; });
      if (p === 3) {                               // make (PC1, PC2, PC3) a right-handed set, so the rotation below is a pure rotation
        const [a, b, c] = E.vecs, cr = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        if (cr[0] * c[0] + cr[1] * c[1] + cr[2] * c[2] < 0) E.vecs[2] = c.map((x) => -x);
      }
    };
    // rotation that takes the data from the x axes to the PC axes, at fraction t
    const rotAt = (tt) => {
      const p = set.p, Q = E.vecs;                 // rows of Q are the PCs: Q x gives the scores
      if (p === 2) {
        const th = -Math.atan2(Q[0][1], Q[0][0]) * tt, c = Math.cos(th), s = Math.sin(th);
        return (x) => [c * x[0] - s * x[1], s * x[0] + c * x[1]];
      }
      const tr = Q[0][0] + Q[1][1] + Q[2][2], ang = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
      let ax = [Q[2][1] - Q[1][2], Q[0][2] - Q[2][0], Q[1][0] - Q[0][1]];
      const nrm = Math.hypot(ax[0], ax[1], ax[2]);
      if (nrm < 1e-9) {                            // angle 0 or pi: take the axis from the symmetric part
        if (ang < 1e-6) return (x) => x.slice();
        const M = Q.map((r, i) => r.map((v, j) => (v + (i === j ? 1 : 0)) / 2)); let best = 0;
        for (let i = 1; i < 3; i++) if (M[i][i] > M[best][best]) best = i;
        ax = M[best]; const m2 = Math.hypot(ax[0], ax[1], ax[2]); ax = ax.map((v) => v / m2);
      } else ax = ax.map((v) => v / nrm);
      const a = ang * tt, c = Math.cos(a), s = Math.sin(a);
      return (x) => {                              // Rodrigues' formula
        const d = ax[0] * x[0] + ax[1] * x[1] + ax[2] * x[2];
        const cr = [ax[1] * x[2] - ax[2] * x[1], ax[2] * x[0] - ax[0] * x[2], ax[0] * x[1] - ax[1] * x[0]];
        return [0, 1, 2].map((i) => x[i] * c + cr[i] * s + ax[i] * d * (1 - c));
      };
    };
    const project = (x) => {                       // projection of a centred point onto the first `keep` PCs
      const out = new Array(set.p).fill(0);
      for (let j = 0; j < keep; j++) { const v = E.vecs[j], sc = x.reduce((s, xi, i) => s + xi * v[i], 0); v.forEach((vi, i) => { out[i] += sc * vi; }); }
      return out;
    };

    const top = el("div", { class: "mlw-pair" }, box);
    const left = el("div", { class: "mlw-col" }, top), right = el("div", { class: "mlw-col mlw-col-narrow" }, top);
    let P2 = null, V3 = null;
    const S = plot(right, [0.4, 3.6], [0, 100], { ratio: 0.85, maxWidth: 340 });
    S.pad.l = 40;
    const tbl = el("table", { class: "mlw-cm mlw-loadings" }, right);
    const out = readout(box);
    const hint = el("div", { class: "mlw-hint" }, box);

    const drawData = () => {
      const k = C(), p = set.p, rot = rotAt(t), cols = [k.r, k.g, k.b];
      const axNames = t > 0.999 ? ["PC1", "PC2", "PC3"] : set.names;
      const pts = Xc.map((x) => ({ x: rot(x), q: rot(project(x)) }));
      const arrows = E.vecs.map((v, j) => ({ v: rot(v.map((vi) => vi * 2 * Math.sqrt(E.vals[j]))), j }));
      if (p === 2) {
        const P = P2; P.clear(); P.axes(axNames[0], axNames[1], ticks(-5, 5, 10), ticks(-3, 3, 6));
        P.clip(() => {
          if (keep < p) { const v = rot(E.vecs[0]); P.line([[-8 * v[0], -8 * v[1]], [8 * v[0], 8 * v[1]]], rgba(k.r, 0.45), 1.5, [5, 4]); }
          pts.forEach(({ x, q }) => {
            if (recon && keep < p) { P.line([x, q], k.grid, 1); P.dot(q[0], q[1], k.b, 2.2); }
            P.dot(x[0], x[1], k.a, 3);
          });
          arrows.forEach(({ v, j }) => {
            const c = P.ctx, A = [P.X(0), P.Y(0)], B = [P.X(v[0]), P.Y(v[1])], ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
            c.strokeStyle = cols[j]; c.fillStyle = cols[j]; c.lineWidth = j < keep ? 3 : 1.6; c.setLineDash(j < keep ? [] : [4, 3]);
            c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); c.setLineDash([]);
            c.beginPath(); c.moveTo(B[0], B[1]); c.lineTo(B[0] - 10 * Math.cos(ang - 0.4), B[1] - 10 * Math.sin(ang - 0.4)); c.lineTo(B[0] - 10 * Math.cos(ang + 0.4), B[1] - 10 * Math.sin(ang + 0.4)); c.closePath(); c.fill();
            c.font = "bold 13px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("PC" + (j + 1), B[0] + 16 * Math.cos(ang), B[1] + 16 * Math.sin(ang));
          });
        });
      } else {
        const V = V3; V.clear(); V.axes(4, axNames);
        if (keep === 2) {                          // the plane of PC1 and PC2
          const a = rot(E.vecs[0].map((v) => v * 2.4 * Math.sqrt(E.vals[0]))), b = rot(E.vecs[1].map((v) => v * 2.4 * Math.sqrt(E.vals[1])));
          V.poly([[a[0] + b[0], a[1] + b[1], a[2] + b[2]], [a[0] - b[0], a[1] - b[1], a[2] - b[2]], [-a[0] - b[0], -a[1] - b[1], -a[2] - b[2]], [-a[0] + b[0], -a[1] + b[1], -a[2] + b[2]]], rgba(k.g, 0.13), rgba(k.g, 0.5));
        }
        if (keep === 1) { const v = rot(E.vecs[0]); V.line(v.map((x) => -7 * x), v.map((x) => 7 * x), rgba(k.r, 0.45), 1.5, [5, 4]); }
        const order = pts.map((pt, i) => [V.proj(pt.x)[2], i]).sort((a, b) => b[0] - a[0]);
        order.forEach(([, i]) => {
          const { x, q } = pts[i];
          if (recon && keep < p) { V.line(x, q, k.grid, 1); V.dot(q, k.b, 1.8); }
          V.dot(x, k.a, 2.8);
        });
        arrows.forEach(({ v, j }) => V.arrow([0, 0, 0], v, cols[j], "PC" + (j + 1)));
      }
    };
    const drawScree = () => {
      const k = C(), p = set.p, tot = E.vals.reduce((s, v) => s + v, 0);
      S.xr = [0.4, p + 0.6]; S.clear(); S.axes("principal component", "% of variance", ticks(1, p, p - 1), [0, 25, 50, 75, 100]);
      let cum = 0; const cpts = [];
      E.vals.forEach((v, j) => {
        const pct = 100 * v / tot; cum += pct; cpts.push([j + 1, cum]);
        const c = S.ctx, x0 = S.X(j + 1 - 0.32), x1 = S.X(j + 1 + 0.32);
        c.fillStyle = j < keep ? k.a : k.grid; c.fillRect(x0, S.Y(pct), x1 - x0, S.Y(0) - S.Y(pct));
        S.text(pct.toFixed(0) + "%", S.X(j + 1), S.Y(pct) - 9, k.muted, "center");
      });
      S.line(cpts, k.b, 2.2); cpts.forEach(([x, y], j) => { S.dot(x, y, j < keep ? k.b : k.bg, 4.2); S.ctx.strokeStyle = k.b; S.ctx.lineWidth = 1.5; S.ctx.beginPath(); S.ctx.arc(S.X(x), S.Y(y), 4.2, 0, 2 * Math.PI); S.ctx.stroke(); });
      S.text("cumulative", S.X(p + 0.5) - 4, S.Y(cpts[p - 1][1]) + 16, k.b, "right");
      return { tot, kept: cpts[keep - 1][1] };
    };
    const drawTable = () => {
      const k = C(), p = set.p, tot = E.vals.reduce((s, v) => s + v, 0);
      let h = "<tr><th></th>" + set.names.map((n) => `<th>${n}</th>`).join("") + "<th>variance</th></tr>";
      E.vecs.forEach((v, j) => {
        h += `<tr${j < keep ? ' class="mlw-kept"' : ""}><th>PC${j + 1}</th>` + v.map((x) => {
          const col = x >= 0 ? k.a : k.r;
          return `<td><span class="mlw-bar" style="width:${Math.round(34 * Math.abs(x))}px;background:${col}"></span> ${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}</td>`;
        }).join("") + `<td>${(100 * E.vals[j] / tot).toFixed(1)}%</td></tr>`;
      });
      tbl.innerHTML = h;
    };
    const draw = () => {
      drawData(); const s = drawScree(); drawTable();
      const p = set.p, lost = E.vals.slice(keep).reduce((a, v) => a + v, 0);
      out.innerHTML = `Keeping <b>${keep}</b> of ${p} components keeps <b>${s.kept.toFixed(1)}%</b> of the variance. ` +
        (keep < p ? `Each point is replaced by its projection (orange dots): the mean squared reconstruction error is <b>${lost.toFixed(3)}</b>, the sum of the dropped eigenvalues.` : `With all components kept nothing is lost: PCA is only a rotation.`) +
        ` The table gives the <b>loadings</b>: the entries of each principal direction, i.e. how much each input contributes to it.`;
    };
    const build = () => {
      if (stopAnim) { stopAnim(); stopAnim = null; }
      if (V3) V3.stopSpin();
      left.innerHTML = ""; P2 = null; V3 = null; t = 0;
      if (set.p === 2) P2 = plot(left, [-5, 5], [-3, 3], { ratio: 0.66, maxWidth: 520 });
      else { V3 = view3d(left, { scale: 0.115, maxWidth: 520, ratio: 0.8 }); V3.redraw = drawData; }
      keepS.max = set.p; if (keep > set.p) keep = set.p; keepS.value = keep; keepS.dispatchEvent(new Event("input"));
      spinB.style.display = set.p === 3 ? "" : "none";
      rotB.textContent = "Rotate to the PC axes";
      hint.textContent = set.p === 3 ? "Drag the cloud to turn it in 3-D, or press Spin." : "";
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "data", NAMES, NAMES[0], (v) => { set = SETS[v]; make(); build(); });
    const keepS = slider(c, "components kept", 1, 2, 1, 1, (v) => v.toFixed(0), (v) => { keep = v; if (E) draw(); });
    checkbox(c, "show projections", true, (v) => { recon = v; draw(); });
    const rotB = button(c, "Rotate to the PC axes", () => {
      if (stopAnim) stopAnim();
      const from = t, to = t > 0.5 ? 0 : 1;
      rotB.textContent = to ? "Back to the original axes" : "Rotate to the PC axes";
      stopAnim = animate(1400, (e) => { t = from + (to - from) * e; drawData(); }, () => { stopAnim = null; draw(); });
    });
    const spinB = button(c, "Spin", () => { if (!V3) return; if (V3.spinning()) { V3.stopSpin(); spinB.textContent = "Spin"; } else { V3.spin(); spinB.textContent = "Stop"; } });
    make(); build(); draw();
    void k0;
    return draw;
  };

  // 23. The kernel trick: lift a disc and a ring into 3-D, where a flat plane separates them
  W.kernel3d = (box) => {
    const r = rng(5), X = [];
    for (let i = 0; i < 90; i++) { const a = 2 * Math.PI * r(), rad = Math.sqrt(r()) * 1.0; X.push([rad * Math.cos(a), rad * Math.sin(a), 1]); }
    for (let i = 0; i < 90; i++) { const a = 2 * Math.PI * r(), rad = 1.6 + 0.9 * r(); X.push([rad * Math.cos(a), rad * Math.sin(a), 0]); }
    const V = view3d(box, { scale: 0.16, pitch: 0.42, yaw: -0.5, maxWidth: 560, ratio: 0.7 });
    let lift = 0, cut = 1.8, stopAnim = null;
    const ZS = 0.32;                                 // display scale of z = x1^2 + x2^2
    const out = readout(box);
    const draw = () => {
      const k = C(); V.clear(); V.axes(3.2, ["x₁", "x₂", "z"]);
      const rc = Math.sqrt(cut), circ = [], off = 0.8 * lift;
      for (let i = 0; i <= 80; i++) { const a = 2 * Math.PI * i / 80; circ.push([rc * Math.cos(a), rc * Math.sin(a), -off]); }
      V.path(circ, k.r, 1.6, [5, 4]);
      if (lift > 0.02) { const h = ZS * cut * lift - off, L = 2.8; V.poly([[-L, -L, h], [L, -L, h], [L, L, h], [-L, L, h]], rgba(k.r, 0.12 + 0.1 * lift), rgba(k.r, 0.6)); }
      const pts = X.map((p) => [p[0], p[1], ZS * lift * (p[0] * p[0] + p[1] * p[1]) - off, p[2]]);
      pts.map((p, i) => [V.proj(p)[2], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
        const p = pts[i]; if (lift > 0.02) V.line([p[0], p[1], -off], p, k.grid, 0.8);
        V.dot(p, p[3] ? k.a : k.b, 3.2);
      });
      let ok = 0; X.forEach((p) => { if ((p[0] * p[0] + p[1] * p[1] < cut) === (p[2] === 1)) ok++; });
      out.innerHTML = `Rule: <b>inner class if z = x₁² + x₂² &lt; ${cut.toFixed(2)}</b> → ${ok} of ${X.length} correct (${(100 * ok / X.length).toFixed(0)}%). ` +
        `In 3-D this rule is the flat red plane; seen from above (in the original x₁, x₂ plane) it is the dashed circle of radius √c = ${rc.toFixed(2)}. ` +
        `A kernel lets an SVM work in such a bigger space without ever computing z.`;
    };
    V.redraw = draw;
    const c = el("div", { class: "mlw-controls" }, box);
    const liftS = slider(c, "lift into 3-D", 0, 1, 0.01, 0, (v) => (100 * v).toFixed(0) + "%", (v) => { lift = v; draw(); });
    slider(c, "plane height c", 0.2, 6, 0.05, 1.8, (v) => v.toFixed(2), (v) => { cut = v; draw(); });
    button(c, "Lift", () => {
      if (stopAnim) stopAnim();
      const from = lift, to = lift > 0.5 ? 0 : 1;
      stopAnim = animate(1500, (e) => { lift = from + (to - from) * e; liftS.value = lift; liftS.dispatchEvent(new Event("input")); });
    });
    const spinB = button(c, "Spin", () => { if (V.spinning()) { V.stopSpin(); spinB.textContent = "Spin"; } else { V.spin(); spinB.textContent = "Stop"; } });
    el("div", { class: "mlw-hint" }, box, "Drag the picture to turn it.");
    draw(); return draw;
  };

  // 24. Ridge or lasso: the RSS ellipse meets the circle or the diamond
  W.penalty = (box) => {
    const b = [2.0, 0.85], H = [[1.0, 0.55], [0.55, 0.8]];       // least-squares point and the shape of the RSS bowl
    const E = eigSym(H);
    const rss = (x) => { const d = [x[0] - b[0], x[1] - b[1]]; return d[0] * (H[0][0] * d[0] + H[0][1] * d[1]) + d[1] * (H[1][0] * d[0] + H[1][1] * d[1]); };
    const solve = (kind, s) => {
      const inside = kind === "ridge" ? Math.hypot(b[0], b[1]) <= s : Math.abs(b[0]) + Math.abs(b[1]) <= s;
      if (inside) return b.slice();
      let best = null, bv = Infinity; const test = (x) => { const v = rss(x); if (v < bv) { bv = v; best = x; } };
      if (kind === "ridge") for (let i = 0; i < 3600; i++) { const a = 2 * Math.PI * i / 3600; test([s * Math.cos(a), s * Math.sin(a)]); }
      else { const V = [[s, 0], [0, s], [-s, 0], [0, -s]]; for (let e = 0; e < 4; e++) { const A = V[e], B = V[(e + 1) % 4]; for (let i = 0; i < 1200; i++) { const u = i / 1200; test([A[0] + u * (B[0] - A[0]), A[1] + u * (B[1] - A[1])]); } } }
      return best;
    };
    let kind = "lasso", s = 1.3;
    const top = el("div", { class: "mlw-pair" }, box);
    const left = el("div", { class: "mlw-col" }, top), right = el("div", { class: "mlw-col mlw-col-narrow" }, top);
    const P = plot(left, [-1.2, 3.0], [-1.4, 2.0], { ratio: 0.82, maxWidth: 440 });
    const Q = plot(right, [0, 3], [-0.2, 2.2], { ratio: 0.8, maxWidth: 340 });
    const out = readout(box);
    const ellipse = (level) => {
      const pts = []; for (let i = 0; i <= 120; i++) {
        const a = 2 * Math.PI * i / 120, u = [Math.cos(a) * Math.sqrt(level / E.vals[0]), Math.sin(a) * Math.sqrt(level / E.vals[1])];
        pts.push([b[0] + u[0] * E.vecs[0][0] + u[1] * E.vecs[1][0], b[1] + u[0] * E.vecs[0][1] + u[1] * E.vecs[1][1]]);
      } return pts;
    };
    const path = { ridge: [], lasso: [] };
    ["ridge", "lasso"].forEach((kk) => { for (let x = 0.02; x <= 3.0; x += 0.02) path[kk].push([x, solve(kk, x)]); });
    const draw = () => {
      const k = C(), sol = solve(kind, s), lev = rss(sol);
      P.clear(); P.axes("β₁", "β₂", ticks(-1, 3, 4), ticks(-1, 2, 3));
      P.clip(() => {
        P.line([[-2, 0], [4, 0]], k.grid, 1); P.line([[0, -2], [0, 3]], k.grid, 1);
        const reg = []; if (kind === "ridge") for (let i = 0; i <= 120; i++) { const a = 2 * Math.PI * i / 120; reg.push([s * Math.cos(a), s * Math.sin(a)]); }
        else reg.push([s, 0], [0, s], [-s, 0], [0, -s], [s, 0]);
        const c = P.ctx; c.beginPath(); reg.forEach(([x, y], i) => (i ? c.lineTo(P.X(x), P.Y(y)) : c.moveTo(P.X(x), P.Y(y)))); c.closePath(); c.fillStyle = k.fillA; c.fill();
        P.line(reg, k.a, 2);
        [0.15, 0.6, 1.3, 2.3].forEach((l) => P.line(ellipse(l), k.grid, 1));
        if (lev > 1e-9) P.line(ellipse(lev), k.b, 2.4);
        P.dot(b[0], b[1], k.b, 4.5); P.text("least squares", P.X(b[0]) + 8, P.Y(b[1]) - 10, k.b);
        P.dot(sol[0], sol[1], k.r, 5.5);
      });
      Q.clear(); Q.axes("budget s", "coefficient", ticks(0, 3, 3), [0, 1, 2]);
      Q.clip(() => {
        Q.line([[0, 0], [3, 0]], k.grid, 1);
        Q.line(path[kind].map(([x, v]) => [x, v[0]]), k.a, 2.2); Q.line(path[kind].map(([x, v]) => [x, v[1]]), k.b, 2.2);
        Q.line([[s, -1], [s, 3]], k.r, 1.4, [4, 3]);
        Q.text("β₁", Q.X(2.75), Q.Y(b[0]) - 12, k.a); Q.text("β₂", Q.X(2.75), Q.Y(b[1]) - 12, k.b);
      });
      const z = Math.abs(sol[1]) < 1e-12;
      out.innerHTML = `${kind === "ridge" ? "Ridge: the budget is the disc β₁² + β₂² ≤ s²" : "Lasso: the budget is the diamond |β₁| + |β₂| ≤ s"}. ` +
        `The answer (red) is where the smallest RSS contour (orange) touches the budget: β̂₁ = <b>${sol[0].toFixed(3)}</b>, β̂₂ = <b>${sol[1].toFixed(3)}</b>.` +
        (z ? ` <b>β₂ is exactly zero</b>: the contour meets the diamond at its corner, so that input is dropped.` : kind === "ridge" ? " Ridge shrinks both coefficients but neither becomes exactly zero." : "") +
        ` Right: how the coefficients change with the budget (a smaller budget means a larger λ).`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "penalty", ["lasso", "ridge"], "lasso", (v) => { kind = v; draw(); });
    slider(c, "budget s", 0.05, 2.6, 0.01, 1.3, (v) => v.toFixed(2), (v) => { s = v; draw(); });
    draw(); return draw;
  };

  // 25. Bagging: many bootstrap trees and their average
  W.bagging = (box) => {
    const truth = (x) => Math.sin(2 * Math.PI * x) + 0.6 * x, SD = 0.35;
    let seed = 3, xs = [], ys = [], trees = [], B = 1, depth = 8;
    const grow = (px, py, d) => {                     // a regression tree on one input
      const n = px.length, m = py.reduce((s, v) => s + v, 0) / n;
      if (d === 0 || n < 4) return () => m;
      const idx = px.map((_, i) => i).sort((a, b) => px[a] - px[b]);
      let best = null, bs = Infinity, sL = 0, qL = 0; const sT = py.reduce((s, v) => s + v, 0), qT = py.reduce((s, v) => s + v * v, 0);
      for (let i = 0; i < n - 1; i++) {
        const y = py[idx[i]]; sL += y; qL += y * y;
        if (px[idx[i]] === px[idx[i + 1]] || i < 1 || i > n - 3) continue;
        const nL = i + 1, nR = n - nL, sse = qL - sL * sL / nL + (qT - qL) - (sT - sL) ** 2 / nR;
        if (sse < bs) { bs = sse; best = (px[idx[i]] + px[idx[i + 1]]) / 2; }
      }
      if (best === null) return () => m;
      const L = [], R = []; px.forEach((x, i) => (x <= best ? L : R).push(i));
      const fl = grow(L.map((i) => px[i]), L.map((i) => py[i]), d - 1), fr = grow(R.map((i) => px[i]), R.map((i) => py[i]), d - 1);
      return (x) => (x <= best ? fl(x) : fr(x));
    };
    const make = () => {
      const r = rng(seed); xs = []; ys = [];
      for (let i = 0; i < 50; i++) { const x = r(); xs.push(x); ys.push(truth(x) + SD * r.normal()); }
      trees = []; const rb = rng(seed + 100);
      for (let t = 0; t < 100; t++) { const ix = xs.map(() => Math.floor(rb() * xs.length)); trees.push(grow(ix.map((i) => xs[i]), ix.map((i) => ys[i]), depth)); }
    };
    const P = plot(box, [0, 1], [-1.6, 2.2], { ratio: 0.58 });
    const out = readout(box);
    const grid = []; for (let x = 0; x <= 1.0001; x += 0.0025) grid.push(x);
    const mse = (f) => grid.reduce((s, x) => s + (f(x) - truth(x)) ** 2, 0) / grid.length + SD * SD;
    const draw = () => {
      const k = C(); P.clear(); P.axes("x", "y", ticks(0, 1, 5), ticks(-1.5, 2, 7));
      const avg = (x) => { let s = 0; for (let t = 0; t < B; t++) s += trees[t](x); return s / B; };
      P.clip(() => {
        for (let t = 0; t < Math.min(B, 12); t++) P.line(grid.map((x) => [x, trees[t](x)]), rgba(k.b, 0.35), 1);
        P.line(grid.map((x) => [x, truth(x)]), k.muted, 1.8, [6, 4]);
        xs.forEach((x, i) => P.dot(x, ys[i], k.a, 3));
        P.line(grid.map((x) => [x, avg(x)]), k.r, 2.8);
      });
      let one = 0; for (let t = 0; t < B; t++) one += mse(trees[t]); one /= B;
      out.innerHTML = `Thin orange: ${Math.min(B, 12)} of the ${B} trees, each grown on its own bootstrap sample. Thick red: their average. Dashed: the truth. ` +
        `Test MSE of one tree ≈ <b>${one.toFixed(3)}</b>; of the average of ${B} ≈ <b>${mse(avg).toFixed(3)}</b> (the best possible is σ² = ${(SD * SD).toFixed(3)}).`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "number of trees B", 1, 100, 1, 1, (v) => v.toFixed(0), (v) => { B = v; draw(); });
    slider(c, "depth of each tree", 1, 8, 1, 8, (v) => v.toFixed(0), (v) => { depth = v; make(); draw(); });
    button(c, "New data", () => { seed += 1; make(); draw(); });
    make(); draw(); return draw;
  };

  // 26. Anomaly detection: distance from the PCA line or each sensor on its own
  W.anomaly = (box) => {
    const r = rng(14), N = [], F = [];
    for (let i = 0; i < 300; i++) { const t = r.normal(); N.push([t + 0.15 * r.normal(), 0.9 * t + 0.15 * r.normal()]); }
    for (let i = 0; i < 30; i++) { const t = r.normal(); F.push([t + 0.15 * r.normal(), -2.0 + 4.0 * r()]); }
    const mx = [0, 1].map((j) => N.reduce((s, p) => s + p[j], 0) / N.length);
    const sd = [0, 1].map((j) => Math.sqrt(N.reduce((s, p) => s + (p[j] - mx[j]) ** 2, 0) / N.length));
    const S = [[0, 0], [0, 0]]; N.forEach((p) => { const d = [p[0] - mx[0], p[1] - mx[1]]; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) S[i][j] += d[i] * d[j] / N.length; });
    const u = eigSym(S).vecs[0];
    const dist = (p) => { const d = [p[0] - mx[0], p[1] - mx[1]], t = d[0] * u[0] + d[1] * u[1]; return Math.hypot(d[0] - t * u[0], d[1] - t * u[1]); };
    let rule = "distance from the PC1 line", thr = 0.5, sth = 2.5;
    const P = plot(box, [-3.5, 3.5], [-2.8, 2.8], { ratio: 0.72, maxWidth: 600 });
    const out = readout(box);
    const flagged = (p) => (rule === "each sensor on its own" ? [0, 1].some((j) => Math.abs(p[j] - mx[j]) > sth * sd[j]) : dist(p) > thr);
    const draw = () => {
      const k = C(); P.clear(); P.axes("sensor 1 (standardised)", "sensor 2 (standardised)", ticks(-3, 3, 6), ticks(-2, 2, 4));
      P.clip(() => {
        if (rule === "each sensor on its own") {
          const x0 = mx[0] - sth * sd[0], x1 = mx[0] + sth * sd[0], y0 = mx[1] - sth * sd[1], y1 = mx[1] + sth * sd[1];
          P.line([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], k.b, 1.8, [6, 4]);
        } else {
          const nrm = [-u[1], u[0]];
          [-1, 0, 1].forEach((sg) => P.line([[mx[0] - 6 * u[0] + sg * thr * nrm[0], mx[1] - 6 * u[1] + sg * thr * nrm[1]], [mx[0] + 6 * u[0] + sg * thr * nrm[0], mx[1] + 6 * u[1] + sg * thr * nrm[1]]], sg ? k.b : k.muted, sg ? 1.8 : 1.2, sg ? [6, 4] : []));
        }
        N.forEach((p) => { P.dot(p[0], p[1], k.a, 2.6); if (flagged(p)) { P.ctx.strokeStyle = k.b; P.ctx.lineWidth = 1.6; P.ctx.beginPath(); P.ctx.arc(P.X(p[0]), P.Y(p[1]), 6, 0, 7); P.ctx.stroke(); } });
        F.forEach((p) => { P.dot(p[0], p[1], k.r, 3.6); if (flagged(p)) { P.ctx.strokeStyle = k.b; P.ctx.lineWidth = 2; P.ctx.beginPath(); P.ctx.arc(P.X(p[0]), P.Y(p[1]), 7, 0, 7); P.ctx.stroke(); } });
      });
      const caught = F.filter(flagged).length, fa = N.filter(flagged).length;
      out.innerHTML = `Blue: normal readings; red: sensor 2 has come loose. Circled: flagged as anomalies. ` +
        `<b>${caught} of ${F.length}</b> faults caught, <b>${fa} of ${N.length}</b> false alarms. ` +
        (rule === "each sensor on its own" ? "Each faulty reading is inside the normal range of each sensor, so a box cannot catch them without many false alarms." :
          "Normal readings lie close to the PC1 line, because the sensors move together; a loose sensor moves the point off the line.");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    const rs = choose(c, "rule", ["distance from the PC1 line", "each sensor on its own"], rule, (v) => { rule = v; thrS.parentNode.style.display = v === "each sensor on its own" ? "none" : ""; sthS.parentNode.style.display = v === "each sensor on its own" ? "" : "none"; draw(); });
    const thrS = slider(c, "distance threshold", 0.1, 1.5, 0.01, thr, (v) => v.toFixed(2), (v) => { thr = v; draw(); });
    const sthS = slider(c, "limit (standard deviations)", 0.5, 3.5, 0.05, sth, (v) => v.toFixed(2), (v) => { sth = v; draw(); });
    sthS.parentNode.style.display = "none"; void rs;
    draw(); return draw;
  };

  // 27. A latent space: two numbers decode into a whole shower profile
  W.latent = (box) => {
    let z = [0, 0], walking = false;
    const top = el("div", { class: "mlw-pair" }, box);
    const left = el("div", { class: "mlw-col mlw-col-narrow" }, top), right = el("div", { class: "mlw-col" }, top);
    const L = plot(left, [-3, 3], [-3, 3], { ratio: 1, maxWidth: 300 });
    const P = plot(right, [0, 25], [0, 12], { ratio: 0.66, maxWidth: 460 });
    const out = readout(box);
    const cloud = []; { const r = rng(4); for (let i = 0; i < 160; i++) cloud.push([r.normal(), r.normal()]); }
    const decode = (zz) => {                          // stands in for a trained decoder: energy from z1, depth from z2
      const E = Math.max(10, Math.min(100, 55 + 22 * zz[0])), b = 0.5, tmax = Math.log(E / 0.022) - 0.5 + 0.9 * zz[1], a = 1 + b * Math.max(1, tmax);
      const prof = []; let s = 0; for (let i = 0; i < 25; i++) { const t = i + 0.5, v = Math.pow(t, a - 1) * Math.exp(-b * t); prof.push(v); s += v; }
      return { E, tmax, prof: prof.map((v) => E * v / s) };
    };
    const draw = () => {
      const k = C(); L.clear(); L.axes("z₁", "z₂", ticks(-3, 3, 6), ticks(-3, 3, 6));
      L.clip(() => {
        [1, 2].forEach((rr) => { const pts = []; for (let i = 0; i <= 80; i++) { const a = 2 * Math.PI * i / 80; pts.push([rr * Math.cos(a), rr * Math.sin(a)]); } L.line(pts, k.grid, 1.2, [4, 3]); });
        cloud.forEach(([x, y]) => L.dot(x, y, k.grid, 2.2));
        L.dot(z[0], z[1], k.r, 6.5);
      });
      const d = decode(z), ref = decode([0, 0]);
      P.clear(); P.axes("depth t (radiation lengths X₀)", "energy per layer (GeV)", ticks(0, 25, 5), ticks(0, 12, 4));
      P.clip(() => {
        const c = P.ctx; d.prof.forEach((v, i) => { c.fillStyle = k.fillA; c.strokeStyle = k.a; const x0 = P.X(i + 0.08), x1 = P.X(i + 0.92); c.fillRect(x0, P.Y(v), x1 - x0, P.Y(0) - P.Y(v)); c.strokeRect(x0, P.Y(v), x1 - x0, P.Y(0) - P.Y(v)); });
        P.line(ref.prof.map((v, i) => [i + 0.5, v]), k.muted, 1.4, [5, 4]);
        P.line([[d.tmax, 0], [d.tmax, 12]], k.r, 1.4, [3, 3]);
      });
      out.innerHTML = `z = (${z[0].toFixed(2)}, ${z[1].toFixed(2)}) → a shower of <b>${d.E.toFixed(0)} GeV</b> with its maximum at <b>${d.tmax.toFixed(1)} X₀</b>. ` +
        `Two latent numbers decode into 25 layer energies. The grey cloud is where training showers land in latent space (a standard Gaussian); dashed profile: z = (0, 0).`;
    };
    const setFrom = (e) => { const rc = L.cv.getBoundingClientRect(); z = [Math.max(-3, Math.min(3, L.invX(e.clientX - rc.left))), Math.max(-3, Math.min(3, L.invY(e.clientY - rc.top)))]; draw(); };
    L.cv.style.touchAction = "none"; L.cv.style.cursor = "crosshair"; let down = false;
    L.cv.addEventListener("pointerdown", (e) => { down = true; walking = false; walkB.textContent = "Walk through latent space"; L.cv.setPointerCapture(e.pointerId); setFrom(e); });
    L.cv.addEventListener("pointermove", (e) => { if (down) setFrom(e); });
    L.cv.addEventListener("pointerup", () => { down = false; });
    const c = el("div", { class: "mlw-controls" }, box);
    button(c, "Draw a random z", () => { const r = Math.random; const u = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); z = [u(), u()]; draw(); });
    const walkB = button(c, "Walk through latent space", () => {
      walking = !walking; walkB.textContent = walking ? "Stop" : "Walk through latent space";
      if (walking) { const t0 = performance.now(); const f = (now) => { if (!walking) return; const a = (now - t0) * 0.0012; z = [1.5 * Math.cos(a), 1.5 * Math.sin(a)]; draw(); requestAnimationFrame(f); }; requestAnimationFrame(f); }
    });
    el("div", { class: "mlw-hint" }, box, "Click or drag in the latent plane (left). Here the decoder is the average-profile formula, standing in for a trained network.");
    draw(); return draw;
  };

  // 28. Basis functions: polynomial, step functions and splines on the same data
  W.basis = (box) => {
    const truth = (h) => 20 + 12 * Math.exp(-((h - 9) ** 2) / (2 * 1.5 * 1.5)) + 25 * Math.exp(-((h - 19.5) ** 2) / (2 * 2 * 2));
    const r = rng(12), xs = [], ys = [];
    for (let i = 0; i < 120; i++) { const h = 24 * r(); xs.push(h); ys.push(truth(h) + 4 * r.normal()); }
    let kind = "cubic spline", K = 4, deg = 3;
    const feats = (h, knots) => {
      const x = h / 24, f = [1];
      if (kind === "polynomial") for (let j = 1; j <= deg; j++) f.push(Math.pow(x - 0.5, j));
      else if (kind === "step functions") knots.forEach((c) => f.push(h >= c ? 1 : 0));
      else if (kind === "piecewise linear") { f.push(x); knots.forEach((c) => f.push(Math.max(0, x - c / 24))); }
      else { f.push(x, x * x, x * x * x); knots.forEach((c) => f.push(Math.max(0, x - c / 24) ** 3)); }
      return f;
    };
    const P = plot(box, [0, 24], [0, 70], { ratio: 0.58 });
    const out = readout(box);
    const draw = () => {
      const k = C(), knots = []; for (let j = 1; j <= K; j++) knots.push(24 * j / (K + 1));
      const w = lsq(xs.map((h) => feats(h, knots)), ys, 1e-9), f = (h) => feats(h, knots).reduce((s, v, i) => s + v * w[i], 0);
      P.clear(); P.axes("hour of the day", "demand (kW)", ticks(0, 24, 6), ticks(0, 70, 7));
      P.clip(() => {
        if (kind !== "polynomial") knots.forEach((c) => P.line([[c, 0], [c, 70]], k.grid, 1.2, [4, 3]));
        xs.forEach((x, i) => P.dot(x, ys[i], k.a, 2.6));
        const g = []; for (let h = 0; h <= 24; h += 0.04) g.push([h, f(h)]);
        P.line(g, k.r, 2.6);
      });
      let te = 0, n = 0; for (let h = 0; h <= 24; h += 0.05) { te += (f(h) - truth(h)) ** 2; n++; }
      const p = feats(0, knots).length;
      out.innerHTML = `${kind}${kind === "polynomial" ? ` of degree ${deg}` : ` with ${K} knot${K > 1 ? "s" : ""} (dashed lines)`}: <b>${p}</b> coefficients. ` +
        `Test MSE ≈ <b>${(te / n + 16).toFixed(1)}</b> kW² (the best possible is the noise, 16 kW²).`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "fit", ["polynomial", "step functions", "piecewise linear", "cubic spline"], kind, (v) => { kind = v; kS.parentNode.style.display = v === "polynomial" ? "none" : ""; dS.parentNode.style.display = v === "polynomial" ? "" : "none"; draw(); });
    const kS = slider(c, "number of knots K", 1, 12, 1, K, (v) => v.toFixed(0), (v) => { K = v; draw(); });
    const dS = slider(c, "degree d", 1, 12, 1, deg, (v) => v.toFixed(0), (v) => { deg = v; draw(); });
    dS.parentNode.style.display = "none";
    draw(); return draw;
  };

  // 29. LDA or QDA: linear and quadratic class boundaries
  W.lda = (box) => {
    const r = rng(8), Z = []; for (let i = 0; i < 200; i++) Z.push([r.normal(), r.normal()]);
    let sep = 2.0, spread = 1.8, method = "QDA";
    const P = plot(box, [-4, 6], [-4, 4], { ratio: 0.72, maxWidth: 620 });
    const out = readout(box);
    const data = () => Z.map((z, i) => i < 100
      ? { x: [-1 + 0.9 * z[0], 0.2 + 0.7 * z[1] + 0.25 * z[0]], y: 0 }
      : { x: [-1 + sep + spread * 0.8 * z[0], 0.2 + spread * (0.45 * z[1] - 0.25 * z[0])], y: 1 });
    const fit = (D, kind) => {
      const g = [0, 1].map((c) => {
        const pts = D.filter((d) => d.y === c).map((d) => d.x), n = pts.length, m = [0, 1].map((j) => pts.reduce((s, p) => s + p[j], 0) / n);
        const S = [[0, 0], [0, 0]]; pts.forEach((p) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) S[i][j] += (p[i] - m[i]) * (p[j] - m[j]) / n; });
        return { m, S, n };
      });
      if (kind === "LDA") { const S = [[0, 0], [0, 0]]; g.forEach((c) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) S[i][j] += c.S[i][j] * c.n / D.length; }); g.forEach((c) => { c.S = S; }); }
      g.forEach((c) => { const d = c.S[0][0] * c.S[1][1] - c.S[0][1] * c.S[1][0]; c.inv = [[c.S[1][1] / d, -c.S[0][1] / d], [-c.S[1][0] / d, c.S[0][0] / d]]; c.ld = Math.log(d); c.lp = Math.log(c.n / D.length); });
      const delta = (c, x) => { const d = [x[0] - c.m[0], x[1] - c.m[1]]; return -0.5 * c.ld - 0.5 * (d[0] * (c.inv[0][0] * d[0] + c.inv[0][1] * d[1]) + d[1] * (c.inv[1][0] * d[0] + c.inv[1][1] * d[1])) + c.lp; };
      return (x) => (delta(g[1], x) > delta(g[0], x) ? 1 : 0);
    };
    const draw = () => {
      const k = C(), D = data(), f = fit(D, method), nx = 100, ny = 70;
      P.clear();
      const c = P.ctx, cw = (P.X(6) - P.X(-4)) / nx, ch = (P.Y(-4) - P.Y(4)) / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = -4 + (i + 0.5) * 10 / nx, y = 4 - (j + 0.5) * 8 / ny; c.fillStyle = f([x, y]) ? k.fillB : k.fillA; c.fillRect(P.X(-4) + i * cw, P.Y(4) + j * ch, cw + 0.5, ch + 0.5); }
      P.axes("x₁", "x₂", ticks(-4, 6, 5), ticks(-4, 4, 4));
      D.forEach((d) => P.dot(d.x[0], d.x[1], d.y ? k.b : k.a, 3));
      const err = (kind) => { const g = fit(D, kind); return D.filter((d) => g(d.x) !== d.y).length / D.length; };
      out.innerHTML = `Shaded: the class each method predicts. Training error: LDA <b>${(100 * err("LDA")).toFixed(1)}%</b>, QDA <b>${(100 * err("QDA")).toFixed(1)}%</b>. ` +
        `LDA assumes both classes share one covariance matrix, so its boundary is a straight line; QDA gives each class its own, so the boundary can curve.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "method", ["QDA", "LDA"], method, (v) => { method = v; draw(); });
    slider(c, "separation of the classes", 0.5, 4, 0.05, sep, (v) => v.toFixed(2), (v) => { sep = v; draw(); });
    slider(c, "spread of the orange class", 0.5, 2.5, 0.05, spread, (v) => v.toFixed(2), (v) => { spread = v; draw(); });
    draw(); return draw;
  };

  // ------------------------------------------------------------------ more helpers
  function solveLin(A0, b0) {                    // Gaussian elimination with pivoting
    const n = b0.length, A = A0.map((r) => r.slice()), b = b0.slice();
    for (let i = 0; i < n; i++) {
      let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; if (!f) continue; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
    return x;
  }
  function ring(P, x, y, col, r, w) { const c = P.ctx; c.strokeStyle = col; c.lineWidth = w || 1.6; c.beginPath(); c.arc(P.X(x), P.Y(y), r || 5, 0, 2 * Math.PI); c.stroke(); }
  function moons(seed, n, noise) {               // two interleaved half-moons, classes 0 and 1
    const r = rng(seed), D = [];
    for (let i = 0; i < n; i++) {
      const y = i % 2, t = Math.PI * r(), x = y ? [1 - Math.cos(t), 0.5 - Math.sin(t)] : [Math.cos(t), Math.sin(t)];
      D.push({ x: [x[0] + noise * r.normal(), x[1] + noise * r.normal()], y });
    }
    return D;
  }
  function regions(P, f, nx, ny) {               // shade the plot by the predicted class (0 blue, 1 orange)
    const k = C(), c = P.ctx, xr = P.xr, yr = P.yr, cw = (P.X(xr[1]) - P.X(xr[0])) / nx, ch = (P.Y(yr[0]) - P.Y(yr[1])) / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = xr[0] + (i + 0.5) * (xr[1] - xr[0]) / nx, y = yr[1] - (j + 0.5) * (yr[1] - yr[0]) / ny;
      c.fillStyle = f([x, y]) ? k.fillB : k.fillA; c.fillRect(P.X(xr[0]) + i * cw, P.Y(yr[1]) + j * ch, cw + 0.6, ch + 0.6);
    }
  }
  function trainMLP(D, H, seed, epochs, batch, lr) {   // a 2-H-1 network (tanh, sigmoid output) trained with Adam
    const r = rng(seed), np = 4 * H + 1, th = new Float64Array(np), m = new Float64Array(np), v = new Float64Array(np), g = new Float64Array(np), hid = new Float64Array(H);
    for (let h = 0; h < H; h++) { th[2 * h] = r.normal(); th[2 * h + 1] = r.normal(); th[3 * H + h] = r.normal() / Math.sqrt(H); }
    const fwd = (x) => {
      let o = th[4 * H];
      for (let h = 0; h < H; h++) { hid[h] = Math.tanh(th[2 * h] * x[0] + th[2 * h + 1] * x[1] + th[2 * H + h]); o += th[3 * H + h] * hid[h]; }
      return 1 / (1 + Math.exp(-o));
    };
    const idx = D.map((_, i) => i); let t = 0;
    for (let e = 0; e < epochs; e++) {
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      for (let s = 0; s < idx.length; s += batch) {
        g.fill(0); const end = Math.min(idx.length, s + batch);
        for (let q = s; q < end; q++) {
          const d = D[idx[q]], p = fwd(d.x), dl = (p - d.y) / (end - s);
          g[4 * H] += dl;
          for (let h = 0; h < H; h++) { g[3 * H + h] += dl * hid[h]; const dz = dl * th[3 * H + h] * (1 - hid[h] * hid[h]); g[2 * h] += dz * d.x[0]; g[2 * h + 1] += dz * d.x[1]; g[2 * H + h] += dz; }
        }
        t++; const c1 = 1 - Math.pow(0.9, t), c2 = 1 - Math.pow(0.999, t);
        for (let q = 0; q < np; q++) { m[q] = 0.9 * m[q] + 0.1 * g[q]; v[q] = 0.999 * v[q] + 0.001 * g[q] * g[q]; th[q] -= lr * (m[q] / c1) / (Math.sqrt(v[q] / c2) + 1e-8); }
      }
    }
    return fwd;
  }
  function growTree(D, idx, depth, r, oneFeature) {  // classification tree (Gini); r and oneFeature for random forests
    const n = idx.length, n1 = idx.reduce((s, i) => s + D[i].y, 0), leaf = () => { const c = 2 * n1 >= n ? 1 : 0; return () => c; };
    if (depth === 0 || n < 4 || n1 === 0 || n1 === n) return leaf();
    let best = null, bg = Infinity;
    for (const f of oneFeature ? [Math.floor(r() * 2)] : [0, 1]) {
      const s = idx.slice().sort((a, b) => D[a].x[f] - D[b].x[f]); let l1 = 0;
      for (let q = 0; q < n - 1; q++) {
        l1 += D[s[q]].y; if (D[s[q]].x[f] === D[s[q + 1]].x[f]) continue;
        const nl = q + 1, nr = n - nl, pl = l1 / nl, pr = (n1 - l1) / nr, gi = nl * pl * (1 - pl) + nr * pr * (1 - pr);
        if (gi < bg) { bg = gi; best = [f, (D[s[q]].x[f] + D[s[q + 1]].x[f]) / 2]; }
      }
    }
    if (!best) return leaf();
    const [f, cut] = best, L = idx.filter((i) => D[i].x[f] <= cut), R = idx.filter((i) => D[i].x[f] > cut);
    const fl = growTree(D, L, depth - 1, r, oneFeature), fr = growTree(D, R, depth - 1, r, oneFeature);
    return (x) => (x[f] <= cut ? fl(x) : fr(x));
  }

  // 30. The three ingredients: a model family, an error measured on unseen data, and an optimiser that lowers it
  W.ingredients = (box) => {
    const truth = (x) => Math.sin(2.5 * x) + 0.3 * x, r = rng(31), tr = [], te = [];
    for (let i = 0; i < 14; i++) { const x = -1 + 2 * r(); tr.push([x, truth(x) + 0.25 * r.normal()]); }
    for (let i = 0; i < 40; i++) { const x = -1 + 2 * r(); te.push([x, truth(x) + 0.25 * r.normal()]); }
    const FAM = { "straight lines": 1, "parabolas (degree 2)": 2, "cubics (degree 3)": 3, "degree-9 polynomials": 9 };
    let deg = 1, w, m, v, it, hist, running = false, showTest = true;
    const phi = (x) => { const P = [1, x]; for (let n = 1; n < deg; n++) P.push(((2 * n + 1) * x * P[n] - n * P[n - 1]) / (n + 1)); return P.slice(0, deg + 1); };
    const pred = (x) => phi(x).reduce((s, f, i) => s + f * w[i], 0);
    const mse = (D) => D.reduce((s, [x, y]) => s + (pred(x) - y) ** 2, 0) / D.length;
    const reset = () => { w = new Array(deg + 1).fill(0); m = w.slice(); v = w.slice(); it = 0; hist = [[0, mse(tr), mse(te)]]; };
    const steps = (k) => {
      for (let q = 0; q < k; q++) {
        const g = new Array(deg + 1).fill(0);
        tr.forEach(([x, y]) => { const f = phi(x), e = 2 * (pred(x) - y) / tr.length; f.forEach((fi, i) => { g[i] += e * fi; }); });
        it++; const c1 = 1 - Math.pow(0.9, it), c2 = 1 - Math.pow(0.999, it);
        for (let i = 0; i <= deg; i++) { m[i] = 0.9 * m[i] + 0.1 * g[i]; v[i] = 0.999 * v[i] + 0.001 * g[i] * g[i]; w[i] -= 0.05 * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8); }
      }
      hist.push([it, mse(tr), mse(te)]);
    };
    const top = el("div", { class: "mlw-pair" }, box);
    const P = plot(el("div", { class: "mlw-col" }, top), [-1, 1], [-2, 2], { ratio: 0.72, maxWidth: 460 });
    const Q = plot(el("div", { class: "mlw-col mlw-col-narrow" }, top), [0, 1500], [0, 1.2], { ratio: 0.8, maxWidth: 340 });
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); P.axes("x", "y", ticks(-1, 1, 4), ticks(-2, 2, 4));
      P.clip(() => {
        if (showTest) te.forEach(([x, y]) => ring(P, x, y, k.muted, 3.2, 1.2));
        tr.forEach(([x, y]) => P.dot(x, y, k.a, 4));
        const g = []; for (let x = -1; x <= 1.0001; x += 0.005) g.push([x, pred(x)]);
        P.line(g, k.r, 2.6);
      });
      Q.clear(); Q.axes("optimisation step", "MSE", [0, 500, 1000, 1500], ticks(0, 1.2, 4));
      Q.clip(() => { Q.line(hist.map((h) => [h[0], h[1]]), k.a, 2.2); if (showTest) Q.line(hist.map((h) => [h[0], h[2]]), k.r, 2.2, [6, 3]); });
      legend(Q, showTest ? [["training", k.a], ["test", k.r, [6, 3]]] : [["training", k.a]]);
      const h = hist[hist.length - 1];
      out.innerHTML = `<b>1 Representation:</b> each x becomes ${deg + 1} numbers and the model family is ${Object.keys(FAM).find((s) => FAM[s] === deg)} (${deg + 1} parameters). ` +
        `<b>2 Evaluation:</b> training MSE <b>${h[1].toFixed(3)}</b> on the 14 filled points; test MSE <b>${h[2].toFixed(3)}</b> on the 40 hollow points the model never saw. ` +
        `<b>3 Optimisation:</b> gradient descent, step <b>${it}</b>: each step moves the parameters a little downhill on the training MSE.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "model family", Object.keys(FAM), "straight lines", (s) => { deg = FAM[s]; running = false; trainB.textContent = "Train"; reset(); draw(); });
    const trainB = button(c, "Train", () => {
      running = !running; trainB.textContent = running ? "Pause" : "Train";
      const f = () => { if (!running) return; steps(15); draw(); if (it >= 1500) { running = false; trainB.textContent = "Train"; return; } requestAnimationFrame(f); };
      if (running) requestAnimationFrame(f);
    });
    button(c, "Start again", () => { running = false; trainB.textContent = "Train"; reset(); draw(); });
    checkbox(c, "show test data", true, (s) => { showTest = s; draw(); });
    reset(); draw(); return draw;
  };

  // 31. The matrix product, one entry at a time
  W.matmul = (box, opts) => {
    const EX = {
      "a 2×2 product": { A: [[1, 2], [3, 4]], B: [[5, 6], [7, 8]], an: "A", bn: "B", cn: "AB" },
      "Hubble: 3 galaxies": { A: [[1, 20.8], [1, 60.6], [1, 141.0]], B: [[0.1], [0.07]], an: "X", bn: "β", cn: "ŷ = Xβ", cols: ["1", "d (Mpc)"] },
      "solar panel: 3 readings": { A: [[1, 260, 31.1], [1, 410, 35.6], [1, 150, 28.4]], B: [[2.0], [0.25], [-0.3]], an: "X", bn: "β", cn: "ŷ = Xβ", cols: ["1", "G", "T"] },
    };
    const names = Object.keys(EX), first = opts.example === "solar" ? names[2] : opts.example === "hubble" ? names[1] : names[0];
    let ex = EX[first], cur = -1, timer = null;
    const row = el("div", { class: "mlw-matrow" }, box), out = readout(box);
    const fmt = (v) => String(+v.toFixed(3));
    const prod = () => ex.A.map((a) => ex.B[0].map((_, j) => a.reduce((s, x, kk) => s + x * ex.B[kk][j], 0)));
    const draw = () => {
      const k = C(), R = prod(), r = ex.A.length, s = ex.B[0].length, d = ex.B.length, i = cur >= 0 ? Math.floor(cur / s) : -1, j = cur >= 0 ? cur % s : -1;
      const tab = (M, name, hl, show) => {
        let h = `<div class="mlw-matwrap"><div class="mlw-matname">${name}</div><table class="mlw-mat">`;
        M.forEach((rw, a) => { h += "<tr>" + rw.map((x, b) => { const on = hl(a, b), txt = show(a, b) ? fmt(x) : "?"; return `<td style="${on ? `background:${on};font-weight:600` : ""}">${txt}</td>`; }).join("") + "</tr>"; });
        return h + "</table></div>";
      };
      row.innerHTML = tab(ex.A, `${ex.an} (${r}×${d})`, (a) => (a === i ? k.fillA : ""), () => true) + '<div class="mlw-op">×</div>' +
        tab(ex.B, `${ex.bn} (${d}×${s})`, (a, b) => (b === j ? k.fillB : ""), () => true) + '<div class="mlw-op">=</div>' +
        tab(R, `${ex.cn} (${r}×${s})`, (a, b) => (a === i && b === j ? rgba(k.g, 0.3) : ""), (a, b) => a * s + b <= cur);
      if (cur < 0) out.innerHTML = `Sizes: (${r}×${d})(${d}×${s}) = ${r}×${s}. The inner sizes match (${d}), so the product exists and has the outer sizes. Press Step to compute the entries one at a time.`;
      else {
        const terms = ex.A[i].map((x, kk) => `${fmt(x)}×${fmt(ex.B[kk][j])}`).join(" + ");
        out.innerHTML = `Entry (${i + 1}, ${j + 1}): go along <b style="color:${k.a}">row ${i + 1}</b> of ${ex.an} and down <b style="color:${k.b}">column ${j + 1}</b> of ${ex.bn}, multiply in pairs and add: ` +
          `${terms} = <b>${fmt(R[i][j])}</b>.` + (s === 1 ? ` This is the model's prediction for observation ${i + 1}.` : "") + (cur === r * s - 1 ? " All entries done." : "");
      }
    };
    const total = () => ex.A.length * ex.B[0].length;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; playB.textContent = "Play"; } };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "example", names, first, (s) => { stop(); ex = EX[s]; cur = -1; draw(); });
    button(c, "Step", () => { stop(); cur = cur + 1 >= total() ? -1 : cur + 1; draw(); });
    const playB = button(c, "Play", () => {
      if (timer) { stop(); return; }
      if (cur >= total() - 1) cur = -1;
      playB.textContent = "Pause";
      timer = setInterval(() => { cur++; draw(); if (cur >= total() - 1) stop(); }, 1300);
    });
    button(c, "Reset", () => { stop(); cur = -1; draw(); });
    draw(); return draw;
  };

  // 32. Reducible and irreducible error: the noise sets a floor
  W.noisefloor = (box) => {
    const f = (x) => 1.2 * Math.sin(2 * Math.PI * x) + 2 * x;
    const MODELS = { "perfect: f̂ = f": -1, "straight line": 1, "cubic": 3, "very flexible (degree 15)": 15 };
    let sd = 0.4, model = "straight line", seed = 1, xs = [], ys = [], fh = f;
    const top = el("div", { class: "mlw-pair" }, box);
    const P = plot(el("div", { class: "mlw-col" }, top), [0, 1], [-1.5, 3.5], { ratio: 0.72, maxWidth: 480 });
    const Q = plot(el("div", { class: "mlw-col mlw-col-narrow" }, top), [0.3, 2.7], [0, 1], { ratio: 0.9, maxWidth: 300 });
    const out = readout(box);
    const fit = () => {
      const r = rng(seed); xs = []; ys = [];
      for (let i = 0; i < 30; i++) { const x = r(); xs.push(x); ys.push(f(x) + sd * r.normal()); }
      const d = MODELS[model];
      if (d < 0) fh = f; else { const pf = polyfit(xs.map((x) => 2 * x - 1), ys, d, 1e-9); fh = (x) => pf(2 * x - 1); }
    };
    const draw = () => {
      const k = C(); P.clear(); P.axes("X", "Y", ticks(0, 1, 5), ticks(-1, 3, 4));
      const g = []; for (let x = 0; x <= 1.0001; x += 0.004) g.push(x);
      P.clip(() => {
        P.line(g.map((x) => [x, f(x)]), k.muted, 2, [6, 4]);
        xs.forEach((x, i) => P.dot(x, ys[i], k.a, 3.4));
        P.line(g.map((x) => [x, fh(x)]), k.r, 2.6);
      });
      const red = g.reduce((s, x) => s + (fh(x) - f(x)) ** 2, 0) / g.length, irr = sd * sd;
      const r2 = rng(seed + 999); let meas = 0; for (let i = 0; i < 2000; i++) { const x = r2(); meas += (f(x) + sd * r2.normal() - fh(x)) ** 2; } meas /= 2000;
      const top2 = Math.max(0.5, 1.2 * Math.max(red + irr, meas)); Q.yr = [0, top2];
      Q.clear(); Q.axes("", "average squared error", [], ticks(0, +top2.toFixed(1), 4));
      const c = Q.ctx, bar = (x, y0, y1, col) => { c.fillStyle = col; c.fillRect(Q.X(x - 0.32), Q.Y(Math.min(y1, top2)), Q.X(x + 0.32) - Q.X(x - 0.32), Q.Y(y0) - Q.Y(Math.min(y1, top2))); };
      bar(1, 0, irr, k.b); bar(1, irr, irr + red, k.a); bar(2, 0, meas, k.grid);
      Q.line([[0.3, irr], [2.7, irr]], k.b, 1.4, [4, 3]);
      Q.text("theory", Q.X(1), Q.h - 22, k.ink, "center"); Q.text("measured", Q.X(2), Q.h - 22, k.ink, "center");
      Q.text("noise floor", Q.X(2.7) - 2, Q.Y(irr) - 9, k.b, "right");
      out.innerHTML = `Dashed: the true f; red: the estimate f̂ from 30 points. <span style="color:${k.a}">Reducible error</span> [f − f̂]² averaged over X: <b>${red.toFixed(3)}</b>. ` +
        `<span style="color:${k.b}">Irreducible error</span> Var(ε) = σ² = <b>${irr.toFixed(3)}</b>. Their sum, <b>${(red + irr).toFixed(3)}</b>, matches the error measured on 2000 new points, <b>${meas.toFixed(3)}</b>. ` +
        (model.startsWith("perfect") ? "Even the perfect model cannot go below the noise floor." : "A better model can shrink only the blue part.");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "model", Object.keys(MODELS), model, (s) => { model = s; fit(); draw(); });
    slider(c, "noise σ", 0, 1, 0.01, sd, (s) => s.toFixed(2), (s) => { sd = s; fit(); draw(); });
    button(c, "New training sample", () => { seed++; fit(); draw(); });
    fit(); draw(); return draw;
  };

  // 33. The maximal margin classifier: the widest street, and only the support vectors matter
  W.margin = (box) => {
    const r = rng(2), D = [], u0 = [0.82, 0.57];
    while (D.length < 30) { const y = D.length % 2 ? 1 : -1, x = [1.0 * y + 0.5 * r.normal(), 0.7 * y + 0.5 * r.normal()]; if (y * (x[0] * u0[0] + x[1] * u0[1]) > 0.7) D.push({ x, y }); }
    let th = 75 * Math.PI / 180, b = 0.4, showBest = false, stopAnim = null, drag = -1;
    const ev = (t) => { const c = Math.cos(t), s = Math.sin(t); let lo = Infinity, hi = -Infinity; D.forEach((d) => { const p = c * d.x[0] + s * d.x[1]; if (d.y > 0) lo = Math.min(lo, p); else hi = Math.max(hi, p); }); return [(lo - hi) / 2, (lo + hi) / 2]; };
    const best = () => {
      let bm = -Infinity, bt = 0, bb = 0;
      for (let i = 0; i < 1440; i++) { const t = 2 * Math.PI * i / 1440, [mm, bo] = ev(t); if (mm > bm) { bm = mm; bt = t; bb = bo; } }
      for (let st = 2 * Math.PI / 1440; st > 1e-9; st /= 2) for (const t of [bt - st, bt + st]) { const [mm, bo] = ev(t); if (mm > bm) { bm = mm; bt = t; bb = bo; } }
      return { th: bt, b: bb, m: bm };
    };
    const P = plot(box, [-2.6, 2.6], [-2.2, 2.2], { ratio: 0.75, maxWidth: 600 });
    const out = readout(box);
    const lineAt = (t, off, col, w, dash) => { const u = [Math.cos(t), Math.sin(t)], p0 = [off * u[0], off * u[1]], dv = [-u[1], u[0]]; P.line([[p0[0] - 9 * dv[0], p0[1] - 9 * dv[1]], [p0[0] + 9 * dv[0], p0[1] + 9 * dv[1]]], col, w, dash); };
    const draw = () => {
      const k = C(), u = [Math.cos(th), Math.sin(th)], sd = D.map((d) => d.y * (u[0] * d.x[0] + u[1] * d.x[1] - b)), mn = Math.min(...sd), B = best();
      P.clear(); P.axes("density (standardised)", "conductivity (standardised)", ticks(-2, 2, 4), ticks(-2, 2, 4));
      P.clip(() => {
        if (mn > 0) {                              // the street
          const dv = [-u[1], u[0]], c = P.ctx, q = (o, s) => [(b + o) * u[0] + s * 9 * dv[0], (b + o) * u[1] + s * 9 * dv[1]];
          const pts = [q(-mn, -1), q(-mn, 1), q(mn, 1), q(mn, -1)];
          c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(P.X(x), P.Y(y)) : c.moveTo(P.X(x), P.Y(y)))); c.closePath(); c.fillStyle = rgba(k.g, 0.12); c.fill();
          lineAt(th, b - mn, k.g, 1.4, [5, 4]); lineAt(th, b + mn, k.g, 1.4, [5, 4]);
        }
        if (showBest) { lineAt(B.th, B.b, k.r, 1.6, [2, 3]); lineAt(B.th, B.b - B.m, rgba(k.r, 0.5), 1, [2, 3]); lineAt(B.th, B.b + B.m, rgba(k.r, 0.5), 1, [2, 3]); }
        lineAt(th, b, k.ink, 2.2);
        D.forEach((d, i) => { P.dot(d.x[0], d.x[1], d.y > 0 ? k.a : k.b, 4.2); if (mn > 0 && sd[i] - mn < 1e-3) ring(P, d.x[0], d.x[1], k.g, 8, 2); if (sd[i] <= 0) ring(P, d.x[0], d.x[1], k.r, 8, 2); });
      });
      const wrong = sd.filter((s) => s <= 0).length, nsv = D.filter((d) => { const v = d.y * (Math.cos(B.th) * d.x[0] + Math.sin(B.th) * d.x[1] - B.b); return v - B.m < 2e-3; }).length;
      out.innerHTML = `Blue: pure milk; orange: watered. ` + (mn > 0 ? `Your line separates the classes with a street of width <b>${(2 * mn).toFixed(2)}</b> (green; the points on its edges are circled).` :
        `Your line puts <b>${wrong}</b> sample${wrong > 1 ? "s" : ""} on the wrong side (red circles).`) +
        ` The widest possible street has width <b>${(2 * B.m).toFixed(2)}</b> and is fixed by <b>${nsv}</b> support vectors.` + (showBest ? " It is shown dotted red. Drag a point that is not a support vector: the dotted line does not move." : "");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    const thS = slider(c, "direction of w (degrees)", 0, 360, 0.5, th * 180 / Math.PI, (s) => s.toFixed(1) + "°", (s) => { th = s * Math.PI / 180; draw(); });
    const bS = slider(c, "offset b", -1.5, 1.5, 0.01, b, (s) => s.toFixed(2), (s) => { b = s; draw(); });
    button(c, "Find the widest street", () => {
      if (stopAnim) stopAnim(); const B = best(), t0 = th, b0 = b; let dt = B.th - t0; dt = Math.atan2(Math.sin(dt), Math.cos(dt));
      stopAnim = animate(1500, (e) => { th = t0 + dt * e; b = b0 + (B.b - b0) * e; thS.value = (((th * 180 / Math.PI) % 360) + 360) % 360; bS.value = b; thS.dispatchEvent(new Event("input")); bS.dispatchEvent(new Event("input")); }, () => { stopAnim = null; });
    });
    checkbox(c, "show the widest street", false, (s) => { showBest = s; draw(); });
    el("div", { class: "mlw-hint" }, box, "Drag any sample with the mouse or a finger to move it.");
    P.cv.style.touchAction = "none";
    const at = (e) => { const rc = P.cv.getBoundingClientRect(); return [e.clientX - rc.left, e.clientY - rc.top]; };
    P.cv.addEventListener("pointerdown", (e) => { const [px, py] = at(e); let bd = 14; drag = -1; D.forEach((d, i) => { const dd = Math.hypot(P.X(d.x[0]) - px, P.Y(d.x[1]) - py); if (dd < bd) { bd = dd; drag = i; } }); if (drag >= 0) P.cv.setPointerCapture(e.pointerId); });
    P.cv.addEventListener("pointermove", (e) => { if (drag < 0) return; const [px, py] = at(e); D[drag].x = [P.invX(px), P.invY(py)]; draw(); });
    P.cv.addEventListener("pointerup", () => { drag = -1; });
    draw(); return draw;
  };

  // 34. Hinge loss and log loss
  W.hinge = (box) => {
    let z = 0.5;
    const P = plot(box, [-3, 3], [0, 4], { ratio: 0.55, maxWidth: 620 });
    const S = plot(box, [-3, 3], [0, 1], { ratio: 0.16, maxWidth: 620 });
    S.pad.b = 22; S.pad.t = 4;
    const out = readout(box);
    const hinge = (t) => Math.max(0, 1 - t), logl = (t) => Math.log(1 + Math.exp(-t)), zo = (t) => (t <= 0 ? 1 : 0);
    const draw = () => {
      const k = C(), g = []; for (let t = -3; t <= 3.0001; t += 0.01) g.push(t);
      P.clear(); P.axes("signed distance  y·f(x)", "loss", ticks(-3, 3, 6), ticks(0, 4, 4));
      P.clip(() => {
        P.line([[1, 0], [1, 4]], k.grid, 1, [3, 3]); P.line([[0, 0], [0, 4]], k.grid, 1);
        P.line(g.map((t) => [t, zo(t)]), k.muted, 1.6, [5, 4]);
        P.line(g.map((t) => [t, logl(t)]), k.a, 2.4); P.line(g.map((t) => [t, hinge(t)]), k.r, 2.6);
        P.line([[z, 0], [z, 4]], k.g, 1.4, [4, 3]); P.dot(z, hinge(z), k.r, 5.5); P.dot(z, logl(z), k.a, 5.5);
      });
      legend(P, [["hinge loss (SVM)", k.r], ["log loss (logistic regression)", k.a], ["0–1 loss (counts errors)", k.muted, [5, 4]]]);
      S.clear(); const c = S.ctx;
      c.fillStyle = rgba(k.g, 0.15); c.fillRect(S.X(-1), S.Y(1), S.X(1) - S.X(-1), S.Y(0) - S.Y(1));
      S.line([[0, 0], [0, 1]], k.ink, 2); S.line([[-1, 0], [-1, 1]], k.g, 1.2, [4, 3]); S.line([[1, 0], [1, 1]], k.g, 1.2, [4, 3]);
      S.text("wrong side", S.X(-2), S.Y(0.5), k.muted, "center"); S.text("street", S.X(-0.5), S.Y(0.5), k.g, "center"); S.text("safely outside", S.X(2), S.Y(0.5), k.muted, "center");
      S.dot(z, 0.5, k.a, 6);
      const where = z <= 0 ? "on the <b>wrong side</b> of the boundary: both losses are large and grow with the distance" : z < 1 ? "<b>inside the street</b>: correctly classified, but the hinge loss still pushes it out" : "<b>safely outside the street</b>: the hinge loss is exactly 0, so this point has no influence on the SVM; the log loss is small but not zero";
      out.innerHTML = `y·f(x) = <b>${z.toFixed(2)}</b>: hinge loss <b style="color:${k.r}">${hinge(z).toFixed(3)}</b>, log loss <b style="color:${k.a}">${logl(z).toFixed(3)}</b>. The point is ${where}.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "move the point: y·f(x)", -3, 3, 0.01, z, (s) => s.toFixed(2), (s) => { z = s; draw(); });
    draw(); return draw;
  };

  // 35. A recurrent unit: the hidden state as memory
  W.rnn = (box) => {
    const T = 60, MODES = ["a single pulse", "a step", "a disturbance that lingers (AR(1))"];
    let mode = MODES[0], w = 0.7, u = 1.0, t = T, playing = false;
    const ar = (() => { const r = rng(9), e = [0]; for (let i = 1; i < T; i++) e.push(0.7 * e[i - 1] + 0.35 * r.normal()); return e; })();
    const xs = () => Array.from({ length: T }, (_, i) => (mode === MODES[0] ? (i === 6 ? 1 : 0) : mode === MODES[1] ? (i >= 6 && i < 36 ? 0.6 : 0) : ar[i]));
    const hs = (x) => { const h = []; let p = 0; x.forEach((xi) => { p = Math.tanh(w * p + u * xi); h.push(p); }); return h; };
    const PX = plot(box, [0, T], [-1.2, 1.2], { ratio: 0.24, maxWidth: 700 }), PH = plot(box, [0, T], [-1, 1], { ratio: 0.3, maxWidth: 700 });
    PX.pad.l = PH.pad.l = 52;
    const out = readout(box);
    const draw = () => {
      const k = C(), x = xs(), h = hs(x), n = Math.max(1, Math.min(T, Math.round(t)));
      PX.clear(); PX.axes("", "input xₜ", [], [-1, 0, 1]);
      x.forEach((v, i) => { const c = PX.ctx; c.fillStyle = i < n ? k.a : k.grid; c.fillRect(PX.X(i + 0.15), PX.Y(Math.max(v, 0)), PX.X(i + 0.85) - PX.X(i + 0.15), Math.abs(PX.Y(v) - PX.Y(0)) + 0.5); });
      PH.clear(); PH.axes("time step t", "hidden state hₜ", ticks(0, T, 6), [-1, 0, 1]);
      PH.clip(() => { PH.line([[0, 0], [T, 0]], k.grid, 1); PH.line(h.slice(0, n).map((v, i) => [i + 0.5, v]), k.r, 2.4); PH.dot(n - 0.5, h[n - 1], k.r, 5); });
      const hp = n > 1 ? h[n - 2] : 0, half = w > 0.01 ? Math.log(0.5) / Math.log(w) : 0;
      out.innerHTML = `Step ${n}: h<sub>t</sub> = tanh(W·h<sub>t−1</sub> + U·x<sub>t</sub>) = tanh(${w.toFixed(2)} × ${hp.toFixed(3)} + ${u.toFixed(2)} × ${x[n - 1].toFixed(3)}) = <b>${h[n - 1].toFixed(3)}</b>. ` +
        `With no new input the memory shrinks by about a factor W = ${w.toFixed(2)} each step, so it halves in about <b>${half.toFixed(1)}</b> steps. ` +
        `W near 0: the unit forgets at once; W near 1: it remembers for a long time.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "input", MODES, mode, (s) => { mode = s; draw(); });
    slider(c, "memory weight W", 0, 0.99, 0.01, w, (s) => s.toFixed(2), (s) => { w = s; draw(); });
    slider(c, "input weight U", 0.1, 2, 0.05, u, (s) => s.toFixed(2), (s) => { u = s; draw(); });
    const playB = button(c, "Play from the start", () => {
      if (playing) { playing = false; playB.textContent = "Play from the start"; return; }
      playing = true; playB.textContent = "Stop"; t = 1; let last = performance.now();
      const f = (now) => { if (!playing) return; t += (now - last) * 0.012; last = now; if (t >= T) { t = T; playing = false; playB.textContent = "Play from the start"; } draw(); if (playing) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    draw(); return draw;
  };

  // 36. Simple or flexible? It depends on the amount of data and on how complicated the pattern is
  W.datasize = (box) => {
    const SD = 0.3, NS = [10, 20, 40, 80, 160, 320, 640, 1280, 2560], R = 12, G = []; for (let i = 0; i < 200; i++) G.push((i + 0.5) / 200);
    let cyc = 2, sel = 3, curves = null;
    const f = (x) => Math.sin(2 * Math.PI * cyc * x) + 0.5 * x;
    const fitSimple = (xs, ys) => { const pf = polyfit(xs.map((x) => 2 * x - 1), ys, 3, 1e-9); return (x) => pf(2 * x - 1); };
    const fitFlex = (xs, ys) => {
      const o = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]), sx = o.map((i) => xs[i]), sy = o.map((i) => ys[i]), n = sx.length, K = Math.max(2, Math.round(Math.sqrt(n)));
      return (x) => {
        let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (sx[mid] < x) lo = mid + 1; else hi = mid; }
        let a = lo - 1, b = lo, s = 0;
        for (let q = 0; q < K; q++) { if (b >= n || (a >= 0 && x - sx[a] <= sx[b] - x)) { s += sy[a]; a--; } else { s += sy[b]; b++; } }
        return s / K;
      };
    };
    const sample = (n, seed) => { const r = rng(seed), xs = [], ys = []; for (let i = 0; i < n; i++) { const x = r(); xs.push(x); ys.push(f(x) + SD * r.normal()); } return [xs, ys]; };
    const err = (g) => G.reduce((s, x) => s + (g(x) - f(x)) ** 2, 0) / G.length + SD * SD;
    const compute = () => {
      curves = NS.map((n, j) => { let a = 0, b = 0; for (let q = 0; q < R; q++) { const [xs, ys] = sample(n, 100 * j + q + 1); a += err(fitSimple(xs, ys)); b += err(fitFlex(xs, ys)); } return [Math.log10(n), a / R, b / R]; });
    };
    const top = el("div", { class: "mlw-pair" }, box);
    const L = plot(el("div", { class: "mlw-col mlw-col-narrow" }, top), [0, 1], [-1.8, 2.3], { ratio: 0.8, maxWidth: 340 });
    const P = plot(el("div", { class: "mlw-col" }, top), [0.9, 3.5], [0, 1], { ratio: 0.72, maxWidth: 460 });
    const out = readout(box);
    const draw = () => {
      const k = C(), n = NS[sel], [xs, ys] = sample(n, 100 * sel + 1), gs = fitSimple(xs, ys), gf = fitFlex(xs, ys);
      L.clear(); L.axes("x", "y", ticks(0, 1, 2), ticks(-1, 2, 3));
      L.clip(() => {
        const step = Math.max(1, Math.floor(n / 300)); for (let i = 0; i < n; i += step) L.dot(xs[i], ys[i], k.grid, 2.2);
        L.line(G.map((x) => [x, f(x)]), k.muted, 1.6, [5, 4]); L.line(G.map((x) => [x, gs(x)]), k.a, 2.4); L.line(G.map((x) => [x, gf(x)]), k.r, 2.2);
      });
      const ymax = Math.min(1.2, Math.ceil(1.1 * Math.max(...curves.map((c) => Math.max(c[1], c[2]))) * 5) / 5); P.yr = [0, ymax];
      P.clear(); P.axes("training set size n (log scale)", "test MSE", [], ticks(0, ymax, Math.round(ymax / 0.2)));
      NS.forEach((m) => P.text(String(m), P.X(Math.log10(m)), P.h - P.pad.b + 10, k.muted, "center"));
      P.clip(() => {
        P.line([[0.9, SD * SD], [3.5, SD * SD]], k.muted, 1.2, [3, 3]);
        P.line(curves.map((c) => [c[0], c[1]]), k.a, 2.4); P.line(curves.map((c) => [c[0], c[2]]), k.r, 2.4);
        curves.forEach((c) => { P.dot(c[0], c[1], k.a, 3.5); P.dot(c[0], c[2], k.r, 3.5); });
        P.line([[Math.log10(n), 0], [Math.log10(n), ymax]], k.g, 1.4, [4, 3]);
      });
      legend(P, [["simple model", k.a], ["flexible model", k.r], ["noise floor", k.muted, [3, 3]]]);
      const cs = curves[sel], win = cs[1] < cs[2] ? "the <b>simple</b> model wins" : "the <b>flexible</b> model wins";
      out.innerHTML = `Simple model: a cubic, 4 parameters (blue). Flexible model: a local average of the √n nearest points, standing in for a large network (red). ` +
        `At n = ${n}: test MSE ${cs[1].toFixed(3)} (simple) and ${cs[2].toFixed(3)} (flexible), so ${win}. ` +
        `The flexible model keeps improving as data grow; the simple one stops at its bias. With a simple pattern (few wiggles) the simple model is hard to beat.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "training set size n", 0, NS.length - 1, 1, sel, (s) => String(NS[s]), (s) => { sel = s; draw(); });
    slider(c, "wiggles in the true pattern", 0.25, 4, 0.25, cyc, (s) => s.toFixed(2), (s) => { cyc = s; compute(); draw(); });
    compute(); draw(); return draw;
  };

  // 37. The same network, a different seed: report the spread
  W.seeds = (box) => {
    const D = moons(3, 240, 0.32), T = moons(4, 1000, 0.32);
    let runs = [], last = null, rival = null;
    const top = el("div", { class: "mlw-pair" }, box);
    const L = plot(el("div", { class: "mlw-col mlw-col-narrow" }, top), [-1.6, 2.6], [-1.2, 1.7], { ratio: 0.8, maxWidth: 330 });
    const Q = plot(el("div", { class: "mlw-col" }, top), [80, 90], [0, 1], { ratio: 0.5, maxWidth: 460 });
    const out = readout(box);
    const train = () => {
      const s = runs.length, f = trainMLP(D, 5, 1000 + 7 * s, 12, 16, 0.02);
      const acc = 100 * T.filter((d) => (f(d.x) > 0.5 ? 1 : 0) === d.y).length / T.length;
      runs.push({ s, acc, j: 0.15 + 0.7 * rng(77 + s)() }); last = f;
      if (rival === null) { rival = +(acc + 1.6).toFixed(1); rivS.value = rival; rivS.dispatchEvent(new Event("input")); }
    };
    const draw = () => {
      const k = C(); L.clear(); L.axes("", "", [], []);
      if (last) regions(L, (x) => (last(x) > 0.5 ? 1 : 0), 60, 45);
      D.forEach((d) => L.dot(d.x[0], d.x[1], d.y ? k.b : k.a, 2.2));
      const a = runs.map((r) => r.acc), n = a.length, mean = a.reduce((s, v) => s + v, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
      let lo = Math.min(...a, rival) - 1, hi = Math.max(...a, rival) + 1; if (hi - lo < 4) { const m = (hi + lo) / 2; lo = m - 2; hi = m + 2; }
      Q.xr = [Math.floor(lo), Math.ceil(hi)]; Q.clear(); Q.axes("test accuracy (%)", "", ticks(Q.xr[0], Q.xr[1], Math.min(8, Q.xr[1] - Q.xr[0])), []);
      Q.clip(() => {
        if (n > 1) { const c = Q.ctx; c.fillStyle = k.fillB; c.fillRect(Q.X(mean - sd), Q.Y(1), Q.X(mean + sd) - Q.X(mean - sd), Q.Y(0) - Q.Y(1)); }
        Q.line([[mean, 0], [mean, 1]], k.b, 2.2);
        Q.line([[rival, 0], [rival, 1]], k.g, 2, [5, 4]);
        runs.forEach((r, i) => Q.dot(r.acc, r.j, i === n - 1 ? k.r : k.a, i === n - 1 ? 5.5 : 4));
      });
      Q.text("rival (one run)", Q.X(rival) + 5, 16, k.g);
      const verdict = n < 2 ? "Train a few more seeds to see the spread." : Math.abs(rival - mean) <= sd ? `The rival's ${rival.toFixed(1)}% lies within one standard deviation of our mean: <b>from one run we cannot say it is better or worse</b>.` :
        `The rival's ${rival.toFixed(1)}% is more than one standard deviation from our mean, ${rival > mean ? "a hint that it is better" : "a hint that it is worse"}; it should still be run over several seeds too.`;
      out.innerHTML = `Each dot is the same network (5 hidden units, the same data and the same 12 epochs) trained with a different random seed; red is the latest (seed ${runs[n - 1].s}, ${runs[n - 1].acc.toFixed(1)}%). ` +
        `Over <b>${n}</b> seed${n > 1 ? "s" : ""}: accuracy = <b>${mean.toFixed(1)}${n > 1 ? " ± " + sd.toFixed(1) : ""}%</b> (orange line and band: mean ± one standard deviation). ${verdict}`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    button(c, "Train with a new seed", () => { train(); draw(); });
    button(c, "Train 10 more", () => { for (let i = 0; i < 10; i++) train(); draw(); });
    button(c, "Start again", () => { runs = []; train(); draw(); });
    const rivS = slider(c, "rival's single-run accuracy", 70, 100, 0.1, 90, (s) => s.toFixed(1) + "%", (s) => { rival = s; if (runs.length) draw(); });
    for (let i = 0; i < 5; i++) train(); draw(); return draw;
  };

  // 38. The course in one picture: six methods on the same data
  W.gallery = (box) => {
    let seed = 7, noise = 0.25, D = [], T = [], fits = {}, method = "neural network (16 hidden units)";
    const METHODS = {
      "logistic regression": () => {
        let w = [0, 0, 0];
        for (let it = 0; it < 3000; it++) { const g = [0, 0, 0]; D.forEach((d) => { const e = 1 / (1 + Math.exp(-(w[0] + w[1] * d.x[0] + w[2] * d.x[1]))) - d.y; g[0] += e; g[1] += e * d.x[0]; g[2] += e * d.x[1]; }); w = w.map((v, i) => v - g[i] / D.length); }
        return (x) => (w[0] + w[1] * x[0] + w[2] * x[1] > 0 ? 1 : 0);
      },
      "k-nearest neighbours (k = 15)": () => (x) => {
        const d = D.map((p) => [(p.x[0] - x[0]) ** 2 + (p.x[1] - x[1]) ** 2, p.y]).sort((a, b) => a[0] - b[0]);
        let s = 0; for (let i = 0; i < 15; i++) s += d[i][1]; return s > 7.5 ? 1 : 0;
      },
      "decision tree (depth 4)": () => growTree(D, D.map((_, i) => i), 4, null, false),
      "random forest (60 trees)": () => {
        const rb = rng(seed + 50), trees = [];
        for (let t = 0; t < 60; t++) trees.push(growTree(D, D.map(() => Math.floor(rb() * D.length)), 8, rb, true));
        return (x) => (trees.reduce((s, f) => s + f(x), 0) > 30 ? 1 : 0);
      },
      "kernel method (RBF kernel)": () => {
        const g = 3, K = D.map((a) => D.map((b) => Math.exp(-g * ((a.x[0] - b.x[0]) ** 2 + (a.x[1] - b.x[1]) ** 2))));
        K.forEach((row, i) => { row[i] += 0.3; });
        const al = solveLin(K, D.map((d) => 2 * d.y - 1));
        return (x) => (D.reduce((s, d, i) => s + al[i] * Math.exp(-g * ((d.x[0] - x[0]) ** 2 + (d.x[1] - x[1]) ** 2)), 0) > 0 ? 1 : 0);
      },
      "neural network (16 hidden units)": () => { const f = trainMLP(D, 16, seed + 9, 1500, D.length, 0.03); return (x) => (f(x) > 0.5 ? 1 : 0); },
    };
    const NAMES = Object.keys(METHODS);
    const make = () => { D = moons(seed, 200, noise); T = moons(seed + 1000, 600, noise); fits = {}; NAMES.forEach((m) => { const f = METHODS[m](); fits[m] = { f, tr: D.filter((d) => f(d.x) === d.y).length / D.length, te: T.filter((d) => f(d.x) === d.y).length / T.length }; }); };
    const top = el("div", { class: "mlw-pair" }, box);
    const P = plot(el("div", { class: "mlw-col" }, top), [-1.6, 2.6], [-1.2, 1.7], { ratio: 0.72, maxWidth: 520 });
    const tbl = el("table", { class: "mlw-cm mlw-loadings" }, el("div", { class: "mlw-col mlw-col-narrow" }, top));
    const out = readout(box);
    const draw = () => {
      const k = C(), F = fits[method]; P.clear(); regions(P, F.f, 84, 58); P.axes("x₁", "x₂", ticks(-1, 2, 3), ticks(-1, 1.5, 5));
      D.forEach((d) => P.dot(d.x[0], d.x[1], d.y ? k.b : k.a, 3));
      tbl.innerHTML = "<tr><th>method</th><th>training</th><th>test</th></tr>" + NAMES.map((m) => `<tr${m === method ? ' class="mlw-kept"' : ""}><th style="text-align:left">${m}</th><td>${(100 * fits[m].tr).toFixed(1)}%</td><td><b>${(100 * fits[m].te).toFixed(1)}%</b></td></tr>`).join("");
      const bestM = NAMES.reduce((a, b) => (fits[b].te > fits[a].te ? b : a));
      out.innerHTML = `Shaded: the class predicted by <b>${method}</b>. Accuracy on the 200 training points: ${(100 * F.tr).toFixed(1)}%; on 600 new test points: <b>${(100 * F.te).toFixed(1)}%</b>. ` +
        `Best on test data here: ${bestM}. A straight boundary (logistic regression) cannot follow the moons; the flexible methods can, but a high training accuracy alone proves nothing: judge on the test column.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "method", NAMES, method, (s) => { method = s; draw(); });
    slider(c, "noise", 0.1, 0.45, 0.01, noise, (s) => s.toFixed(2), (s) => { noise = s; });
    button(c, "New data", () => { seed++; make(); draw(); });
    c.querySelectorAll("input[type=range]")[0].addEventListener("change", () => { make(); draw(); });
    make(); draw(); return draw;
  };

  // ------------------------------------------------------------------ second-demo widgets (39–63)
  function lineEq(P, a, b, c0, col, w, dash) {   // draw the line a·x + b·y + c0 = 0 across the plot
    if (Math.abs(b) > Math.abs(a)) P.line(P.xr.map((x) => [x, -(a * x + c0) / b]), col, w, dash);
    else if (Math.abs(a) > 1e-12) P.line(P.yr.map((y) => [-(b * y + c0) / a, y]), col, w, dash);
  }
  function gauss2(r, n, m, L) {                  // n points from a 2-D normal with mean m and Cholesky factor L
    const out = []; for (let i = 0; i < n; i++) { const z1 = r.normal(), z2 = r.normal(); out.push([m[0] + L[0][0] * z1, m[1] + L[1][0] * z1 + L[1][1] * z2]); }
    return out;
  }
  function hist(P, vals, lo, hi, nb, fill, stroke, scale) {   // a histogram drawn as bars (density scale if scale given)
    const h = new Array(nb).fill(0), bw = (hi - lo) / nb;
    vals.forEach((v) => { const i = Math.floor((v - lo) / bw); if (i >= 0 && i < nb) h[i]++; });
    const c = P.ctx, s = scale || 1;
    h.forEach((n, i) => { if (!n) return; const x0 = P.X(lo + i * bw), x1 = P.X(lo + (i + 1) * bw), y = P.Y(n * s); c.fillStyle = fill; c.fillRect(x0 + 0.5, y, x1 - x0 - 1, P.Y(0) - y); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.strokeRect(x0 + 0.5, y, x1 - x0 - 1, P.Y(0) - y); } });
    return h;
  }
  const PAL = (k) => [k.a, k.b, k.g, k.r, k.muted, "#8e44ad"];

  // 39. Likelihood: how probable are the data under a Gaussian with mean μ?
  W.likelihood = (box) => {
    const r = rng(5), data = []; for (let i = 0; i < 8; i++) data.push(2 + 0.8 * r.normal());
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    let mu = 0.8, sd = 0.8, stop = null;
    const wrap = el("div", { class: "mlw-pair" }, box), L = el("div", {}, wrap), R = el("div", {}, wrap);
    const P = plot(L, [-1, 5], [0, 0.8], { ratio: 0.72, maxWidth: 430 }), Q = plot(R, [-1, 5], [-40, 0], { ratio: 0.72, maxWidth: 330 });
    Q.pad.l = 50;
    const pdf = (x, m) => Math.exp(-0.5 * ((x - m) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
    const ll = (m) => data.reduce((s, x) => s + Math.log(pdf(x, m)), 0);
    const out = readout(box);
    const draw = () => {
      const k = C(), g = []; for (let x = -1; x <= 5.0001; x += 0.02) g.push(x);
      P.yr = [0, Math.max(0.8, 1.15 / (sd * Math.sqrt(2 * Math.PI)))];
      P.clear(); P.axes("measurement x", "probability density", ticks(-1, 5, 6), ticks(0, P.yr[1] > 1 ? 1.6 : 0.8, 4));
      P.clip(() => {
        P.line(g.map((x) => [x, pdf(x, mu)]), k.a, 2.4);
        data.forEach((x) => { P.line([[x, 0], [x, pdf(x, mu)]], k.g, 2.2); P.dot(x, pdf(x, mu), k.g, 3.5); P.dot(x, 0, k.ink, 4.5); });
      });
      legend(P, [["model: normal(μ, σ)", k.a], ["density at each point", k.g], ["measurements", k.ink, null, "dot"]], "right");
      const best = ll(mean), hi = Math.ceil((best + 2) / 5) * 5;
      Q.yr = [hi - 40, hi];
      Q.clear(); Q.axes("mean μ", "log-likelihood", ticks(-1, 5, 6), ticks(hi - 40, hi, 4));
      Q.clip(() => {
        Q.line([[mean, hi - 40], [mean, hi]], k.grid, 1.2, [4, 3]);
        Q.line(g.map((m) => [m, ll(m)]), k.r, 2.4); Q.dot(mu, ll(mu), k.a, 6);
      });
      Q.text("best μ", Q.X(mean) + 5, Q.Y(hi) + 10, k.muted);
      const prod = data.reduce((p, x) => p * pdf(x, mu), 1);
      out.innerHTML = `μ = <b>${mu.toFixed(2)}</b>, σ = ${sd.toFixed(2)}. Likelihood L = product of the 8 green heights = <b>${prod.toExponential(2)}</b>; ` +
        `log L = sum of their logs = <b>${ll(mu).toFixed(2)}</b>. The largest log L is at μ = ${mean.toFixed(2)}, the sample mean: ` +
        `that is the maximum-likelihood estimate. A point far from the curve has a tiny height and drags the product down.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    const sM = slider(c, "mean μ", -1, 5, 0.01, mu, (v) => v.toFixed(2), (v) => { if (stop) stop(); mu = v; draw(); });
    slider(c, "spread σ", 0.3, 2, 0.01, sd, (v) => v.toFixed(2), (v) => { sd = v; draw(); });
    button(c, "Find the best μ", () => { if (stop) stop(); const m0 = mu; stop = animate(900, (t) => { mu = m0 + (mean - m0) * t; sM.value = mu; sM.nextSibling.textContent = mu.toFixed(2); draw(); }); });
    draw(); return draw;
  };

  // 40. Rare positives: precision collapses when the positive class is rare
  W.imbalance = (box) => {
    let lp = Math.log10(0.5), thr = 1, sep = 2.5;
    const P = plot(box, [-4, 5], [0, 0.45], { ratio: 0.42, maxWidth: 680 }), S = plot(box, [0, 1], [0, 1], { ratio: 0.12, maxWidth: 680 });
    S.pad = { l: 46, r: 14, t: 4, b: 18 };
    const pdf = (x, m) => Math.exp(-0.5 * (x - m) ** 2) / Math.sqrt(2 * Math.PI);
    function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
    const sf = (x) => 0.5 * (1 - erf(x / Math.SQRT2));
    const out = readout(box);
    const draw = () => {
      const k = C(), pi = Math.pow(10, lp), m1 = sep, g = []; for (let x = -4; x <= 5.0001; x += 0.03) g.push(x);
      P.yr = [0, 0.42 * Math.max(1 - pi, pi) * 1.08];
      P.clear(); P.axes("classifier score", "number of events (scaled)", ticks(-4, 5, 9), []);
      const c = P.ctx;
      [[0, 1 - pi, k.fillB, k.b], [m1, pi, k.fillA, k.a]].forEach(([m, w, f, s]) => {
        c.fillStyle = f; c.beginPath(); c.moveTo(P.X(thr), P.Y(0)); g.filter((x) => x >= thr).forEach((x) => c.lineTo(P.X(x), P.Y(w * pdf(x, m)))); c.lineTo(P.X(5), P.Y(0)); c.fill();
        P.line(g.map((x) => [x, w * pdf(x, m)]), s, 2.2);
      });
      P.line([[thr, 0], [thr, P.yr[1]]], k.r, 2, [5, 4]);
      legend(P, [["negatives (background)", k.b], ["positives (signal)", k.a], ["threshold: flag if score above", k.r, [5, 4]]], "right");
      const N = 100000, TP = pi * N * sf(thr - m1), FP = (1 - pi) * N * sf(thr), FN = pi * N - TP, prec = TP / Math.max(1e-9, TP + FP), rec = TP / (pi * N);
      S.clear(); const s = S.ctx, f = TP + FP > 0 ? TP / (TP + FP) : 0;
      s.fillStyle = k.a; s.fillRect(S.X(0), S.Y(1), S.X(f) - S.X(0), S.Y(0) - S.Y(1));
      s.fillStyle = k.b; s.fillRect(S.X(f), S.Y(1), S.X(1) - S.X(f), S.Y(0) - S.Y(1));
      s.fillStyle = k.ink; s.font = "12px sans-serif"; s.textAlign = "right"; s.textBaseline = "middle"; s.fillText("flagged", S.pad.l - 4, S.Y(0.5));
      s.textAlign = "left"; s.fillStyle = "#fff"; if (f > 0.18) s.fillText(`real signal ${(100 * f).toFixed(0)}%`, S.X(0) + 6, S.Y(0.5));
      s.textAlign = "right"; if (f < 0.82) s.fillText(`false alarms ${(100 * (1 - f)).toFixed(0)}%`, S.X(1) - 6, S.Y(0.5));
      out.innerHTML = `Positives make up <b>${(100 * pi).toPrecision(2)}%</b> of the events. Out of 100 000 events the classifier flags ${Math.round(TP + FP).toLocaleString()}: ` +
        `${Math.round(TP).toLocaleString()} real (TP) and ${Math.round(FP).toLocaleString()} false alarms (FP); ${Math.round(FN).toLocaleString()} positives are missed (FN). ` +
        `Recall (efficiency) = <b>${rec.toFixed(3)}</b> does not depend on how rare the positives are; precision (purity) = <b>${prec.toFixed(3)}</b> does. ` +
        (pi < 0.02 ? "With rare positives even a small false-positive rate swamps the signal: raise the threshold or report precision as well as accuracy." : "Now make the positives rare and watch the precision fall while the recall stays put.");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "share of positives", -3, Math.log10(0.5), 0.01, lp, (v) => (100 * Math.pow(10, v)).toPrecision(2) + "%", (v) => { lp = v; draw(); });
    slider(c, "threshold", -2, 5, 0.01, thr, (v) => v.toFixed(2), (v) => { thr = v; draw(); });
    slider(c, "class separation", 0.5, 4, 0.05, sep, (v) => v.toFixed(2), (v) => { sep = v; draw(); });
    draw(); return draw;
  };

  // 41. Logistic regression with two inputs, trained by gradient descent
  W.logreg = (box, opts) => {
    const r = rng(41), D = [];
    gauss2(r, 60, [-0.8, -0.5], [[0.8, 0], [0.25, 0.7]]).forEach((x) => D.push({ x, y: 0 }));
    gauss2(r, 60, [0.9, 0.7], [[0.8, 0], [0.3, 0.75]]).forEach((x) => D.push({ x, y: 1 }));
    const xl = opts.xlabel || "input x₁", yl = opts.ylabel || "input x₂";
    let b = [0, 0.3, -1.0], it = 0, lr = 0.5, shade = true, running = false;
    const P = plot(box, [-3, 3], [-2.6, 2.6], { ratio: 0.72, maxWidth: 600 });
    const sig = (z) => 1 / (1 + Math.exp(-z)), p = (x) => sig(b[0] + b[1] * x[0] + b[2] * x[1]);
    const cost = () => -D.reduce((s, d) => { const q = Math.min(1 - 1e-12, Math.max(1e-12, p(d.x))); return s + (d.y ? Math.log(q) : Math.log(1 - q)); }, 0) / D.length;
    const step = () => { const g = [0, 0, 0]; D.forEach((d) => { const e = p(d.x) - d.y; g[0] += e; g[1] += e * d.x[0]; g[2] += e * d.x[1]; }); for (let j = 0; j < 3; j++) b[j] -= lr * g[j] / D.length; it++; };
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear();
      if (shade) {
        const c = P.ctx, nx = 60, ny = 52, cw = (P.X(3) - P.X(-3)) / nx, ch = (P.Y(-2.6) - P.Y(2.6)) / ny;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          const q = p([-3 + (i + 0.5) * 6 / nx, 2.6 - (j + 0.5) * 5.2 / ny]);
          c.fillStyle = q > 0.5 ? rgba(k.b, 0.3 * (q - 0.5) * 2) : rgba(k.a, 0.3 * (0.5 - q) * 2); c.fillRect(P.X(-3) + i * cw, P.Y(2.6) + j * ch, cw + 0.6, ch + 0.6);
        }
      }
      P.axes(xl, yl, ticks(-3, 3, 6), ticks(-2, 2, 4));
      P.clip(() => {
        const L = Math.log(9);
        lineEq(P, b[1], b[2], b[0] - L, k.muted, 1.2, [4, 3]); lineEq(P, b[1], b[2], b[0] + L, k.muted, 1.2, [4, 3]);
        lineEq(P, b[1], b[2], b[0], k.ink, 2.6);
        D.forEach((d) => P.dot(d.x[0], d.x[1], d.y ? k.b : k.a, 3.6));
      });
      legend(P, [["class 0", k.a, null, "dot"], ["class 1", k.b, null, "dot"], ["boundary p = 0.5", k.ink], ["p = 0.1 and p = 0.9", k.muted, [4, 3]]], "bottom-right");
      const acc = D.filter((d) => (p(d.x) > 0.5) === !!d.y).length / D.length;
      out.innerHTML = `Step ${it}: β₀ = ${b[0].toFixed(2)}, β₁ = ${b[1].toFixed(2)}, β₂ = ${b[2].toFixed(2)}. Cross-entropy cost = <b>${cost().toFixed(3)}</b>, training accuracy = <b>${(100 * acc).toFixed(0)}%</b>. ` +
        `The boundary is the line β₀ + β₁x₁ + β₂x₂ = 0; the shading is the predicted probability. As training goes on the dashed lines close in: the model grows more confident.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "learning rate α", 0.05, 3, 0.05, lr, (v) => v.toFixed(2), (v) => { lr = v; });
    button(c, "One step", () => { step(); draw(); });
    const runB = button(c, "Train", () => {
      if (running) { running = false; runB.textContent = "Train"; return; }
      running = true; runB.textContent = "Stop"; let n = 0;
      const f = () => { if (!running) return; step(); step(); n += 2; draw(); if (n < 300) requestAnimationFrame(f); else { running = false; runB.textContent = "Train"; } };
      requestAnimationFrame(f);
    });
    button(c, "Reset", () => { running = false; runB.textContent = "Train"; b = [0, 0.3, -1.0]; it = 0; draw(); });
    checkbox(c, "show probability shading", shade, (v) => { shade = v; draw(); });
    draw(); return draw;
  };

  // 42. Two inputs: the least-squares plane in 3-D, with residuals
  W.plane3d = (box) => {
    const r = rng(42), D = [];
    for (let i = 0; i < 30; i++) { const a = -1 + 2 * r(), b = -1 + 2 * r(); D.push([a, b, 0.3 + 0.7 * a - 0.5 * b + 0.18 * r.normal()]); }
    const fit = lsq(D.map((d) => [1, d[0], d[1]]), D.map((d) => d[2]));
    let B = [0.3, 0, 0], stop = null;
    const V = view3d(box, { ratio: 0.7, maxWidth: 560, scale: 0.3, yaw: -0.6, pitch: 0.35 });
    const out = readout(box);
    const f = (a, b) => B[0] + B[1] * a + B[2] * b;
    const draw = () => {
      const k = C(); V.clear(); V.axes(1.25, ["x₁", "x₂", "y"]);
      for (let i = 0; i <= 8; i++) { const t = -1 + i / 4; V.line([t, -1, f(t, -1)], [t, 1, f(t, 1)], rgba(k.a, 0.45), 1); V.line([-1, t, f(-1, t)], [1, t, f(1, t)], rgba(k.a, 0.45), 1); }
      V.poly([[-1, -1, f(-1, -1)], [1, -1, f(1, -1)], [1, 1, f(1, 1)], [-1, 1, f(-1, 1)]], rgba(k.a, 0.1));
      const pts = D.map((d) => ({ d, z: V.proj(d)[2] })).sort((p, q) => q.z - p.z);
      pts.forEach(({ d }) => { const e = d[2] - f(d[0], d[1]); V.line([d[0], d[1], f(d[0], d[1])], d, e > 0 ? k.g : k.r, 1.6); V.dot(d, k.ink, 3.4); });
      const rss = D.reduce((s, d) => s + (d[2] - f(d[0], d[1])) ** 2, 0), best = D.reduce((s, d) => s + (d[2] - fit[0] - fit[1] * d[0] - fit[2] * d[1]) ** 2, 0);
      out.innerHTML = `Plane ŷ = ${B[0].toFixed(2)} + ${B[1].toFixed(2)}·x₁ ${B[2] < 0 ? "−" : "+"} ${Math.abs(B[2]).toFixed(2)}·x₂. RSS = <b>${rss.toFixed(3)}</b> (smallest possible: ${best.toFixed(3)}). ` +
        `Green sticks: points above the plane; red: below. Drag the picture to turn it: seen edge-on the plane becomes a line, and each slope is the tilt along one axis.`;
    };
    V.redraw = draw;
    const c = el("div", { class: "mlw-controls" }, box), S = [];
    S.push(slider(c, "intercept β₀", -1, 1.5, 0.01, B[0], (v) => v.toFixed(2), (v) => { B[0] = v; draw(); }));
    S.push(slider(c, "slope β₁ (along x₁)", -1.5, 1.5, 0.01, B[1], (v) => v.toFixed(2), (v) => { B[1] = v; draw(); }));
    S.push(slider(c, "slope β₂ (along x₂)", -1.5, 1.5, 0.01, B[2], (v) => v.toFixed(2), (v) => { B[2] = v; draw(); }));
    button(c, "Least squares", () => { if (stop) stop(); const b0 = B.slice(); stop = animate(1000, (t) => { B = b0.map((v, i) => v + (fit[i] - v) * t); B.forEach((v, i) => { S[i].value = v; S[i].nextSibling.textContent = v.toFixed(2); }); draw(); }); });
    checkbox(c, "spin", false, (v) => (v ? V.spin() : V.stopSpin()));
    draw(); return draw;
  };

  // 43. Boosting: small trees (stumps) added one at a time, each fitted to what is left over
  W.boosting = (box) => {
    const r = rng(43), truth = (x) => Math.sin(6 * x) + 2 * x * x, tr = [], te = [];
    for (let i = 0; i < 60; i++) { const x = r(); tr.push([x, truth(x) + 0.3 * r.normal()]); }
    for (let i = 0; i < 300; i++) { const x = r(); te.push([x, truth(x) + 0.3 * r.normal()]); }
    let nu = 0.3, stumps = [], last = null;
    const F = (x) => stumps.reduce((s, [c, a, b]) => s + (x <= c ? a : b), 0);
    const fitStump = (res) => {
      const s = tr.map((p, i) => [p[0], res[i]]).sort((p, q) => p[0] - q[0]), n = s.length, tot = s.reduce((a, p) => a + p[1], 0);
      let best = null, bs = Infinity, left = 0;
      for (let i = 0; i < n - 1; i++) { left += s[i][1]; const nl = i + 1, a = left / nl, b = (tot - left) / (n - nl), sse = -(nl * a * a + (n - nl) * b * b); if (sse < bs) { bs = sse; best = [(s[i][0] + s[i + 1][0]) / 2, a, b]; } }
      return best;
    };
    const add = (m) => { for (let q = 0; q < m; q++) { const res = tr.map((p) => p[1] - F(p[0])), s = fitStump(res); last = s; stumps.push([s[0], nu * s[1], nu * s[2]]); } };
    const P = plot(box, [0, 1], [-1.5, 3.2], { ratio: 0.42, maxWidth: 680 }), Q = plot(box, [0, 1], [-1.6, 1.6], { ratio: 0.26, maxWidth: 680 });
    const out = readout(box), G = []; for (let i = 0; i <= 400; i++) G.push(i / 400);
    const mse = (D) => D.reduce((s, p) => s + (p[1] - F(p[0])) ** 2, 0) / D.length;
    const draw = () => {
      const k = C();
      P.clear(); P.axes("", "y", [], ticks(-1, 3, 4));
      P.clip(() => { P.line(G.map((x) => [x, truth(x)]), k.muted, 1.4, [5, 4]); tr.forEach((p) => P.dot(p[0], p[1], k.ink, 3)); P.line(G.map((x) => [x, F(x)]), k.r, 2.4); });
      legend(P, [["data", k.ink, null, "dot"], ["true pattern", k.muted, [5, 4]], [`boosted model (${stumps.length} stumps)`, k.r]], "left");
      Q.clear(); Q.axes("x", "left over", ticks(0, 1, 5), [-1, 0, 1]);
      Q.clip(() => {
        Q.line([[0, 0], [1, 0]], k.grid, 1);
        const pr = stumps.length ? stumps.slice(0, -1).reduce((f, [c, a, b]) => (x) => f(x) + (x <= c ? a : b), () => 0) : () => 0;
        tr.forEach((p) => Q.dot(p[0], p[1] - pr(p[0]), k.ink, 2.6));
        if (last) Q.line(G.map((x) => [x, x <= last[0] ? last[1] : last[2]]), k.g, 2.4);
      });
      if (last) legend(Q, [["residuals before the newest stump", k.ink, null, "dot"], ["newest stump, fitted to them", k.g]], "right");
      out.innerHTML = `${stumps.length} stumps, learning rate ν = ${nu.toFixed(2)}. Training MSE = <b>${mse(tr).toFixed(3)}</b>, test MSE = <b>${mse(te).toFixed(3)}</b> (noise variance 0.09). ` +
        `Each stump is one split; it is fitted to the residuals and only a fraction ν of it is added. Many small corrections build a flexible curve. ` +
        (stumps.length > 150 ? "Keep going and the training error still falls while the test error stops improving or rises: the number of trees is chosen by cross-validation." : "");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "learning rate ν", 0.05, 1, 0.05, nu, (v) => v.toFixed(2), (v) => { nu = v; });
    button(c, "Add one stump", () => { add(1); draw(); });
    button(c, "Add ten", () => { add(10); draw(); });
    button(c, "Add a hundred", () => { add(100); draw(); });
    button(c, "Start again", () => { stumps = []; last = null; draw(); });
    add(3); draw(); return draw;
  };

  // 44. Distance from normal: Euclidean versus Mahalanobis
  W.mahalanobis = (box) => {
    const r = rng(44), rho = 0.9, D = gauss2(r, 250, [0, 0], [[1, 0], [rho, Math.sqrt(1 - rho * rho)]]);
    const m = [0, 0], S = [[0, 0], [0, 0]]; D.forEach((p) => { m[0] += p[0] / D.length; m[1] += p[1] / D.length; });
    D.forEach((p) => { const a = p[0] - m[0], b = p[1] - m[1]; S[0][0] += a * a / (D.length - 1); S[0][1] += a * b / (D.length - 1); S[1][1] += b * b / (D.length - 1); }); S[1][0] = S[0][1];
    const E = eigSym(S), det = S[0][0] * S[1][1] - S[0][1] ** 2, Si = [[S[1][1] / det, -S[0][1] / det], [-S[0][1] / det, S[0][0] / det]];
    const maha = (x) => { const a = x[0] - m[0], b = x[1] - m[1]; return Math.sqrt(a * (Si[0][0] * a + Si[0][1] * b) + b * (Si[1][0] * a + Si[1][1] * b)); };
    const eu = (x) => Math.hypot(x[0] - m[0], x[1] - m[1]);
    let pt = [2.2, 2.0], cut = 3;
    const P = plot(box, [-4, 4], [-3.3, 3.3], { ratio: 0.72, maxWidth: 580 });
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); P.axes("sensor 1 (standardised)", "sensor 2 (standardised)", ticks(-4, 4, 8), ticks(-3, 3, 6));
      P.clip(() => {
        D.forEach((p) => P.dot(p[0], p[1], rgba(k.a, 0.55), 2.6));
        [1, 2, cut].forEach((d, i) => {
          const pts = []; for (let t = 0; t <= 2 * Math.PI + 0.01; t += 0.05) { const a = d * Math.sqrt(E.vals[0]) * Math.cos(t), b = d * Math.sqrt(E.vals[1]) * Math.sin(t); pts.push([m[0] + a * E.vecs[0][0] + b * E.vecs[1][0], m[1] + a * E.vecs[0][1] + b * E.vecs[1][1]]); }
          P.line(pts, i === 2 ? k.r : k.muted, i === 2 ? 2.2 : 1.2, i === 2 ? [] : [4, 3]);
        });
        const re = eu(pt), circ = []; for (let t = 0; t <= 2 * Math.PI + 0.01; t += 0.05) circ.push([m[0] + re * Math.cos(t), m[1] + re * Math.sin(t)]);
        P.line(circ, k.g, 1.4, [2, 3]);
        P.line([m, pt], k.g, 1.4); P.dot(pt[0], pt[1], maha(pt) > cut ? k.r : k.ink, 6.5);
      });
      legend(P, [["normal readings", k.a, null, "dot"], ["Mahalanobis distance 1 and 2", k.muted, [4, 3]], [`alarm boundary (distance ${cut.toFixed(1)})`, k.r], ["circle of the same Euclidean distance", k.g, [2, 3]]], "bottom-right");
      const dm = maha(pt);
      out.innerHTML = `New reading at (${pt[0].toFixed(2)}, ${pt[1].toFixed(2)}): Euclidean distance from the centre <b>${eu(pt).toFixed(2)}</b>, Mahalanobis distance <b>${dm.toFixed(2)}</b> → ` +
        (dm > cut ? `<b style="color:${k.r}">anomaly</b>.` : "normal.") + ` The two sensors move together (correlation ${rho}), so a reading along the cloud is ordinary even when far out, while a reading across it is suspicious even when close. ` +
        `Mahalanobis distance measures distance in units of the spread in each direction: the ellipses, not circles, are the lines of equal "strangeness".`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "alarm at distance", 1.5, 5, 0.1, cut, (v) => v.toFixed(1), (v) => { cut = v; draw(); });
    button(c, "Far, but along the cloud", () => { pt = [2.2, 2.0]; draw(); });
    button(c, "Close, but across it", () => { pt = [0.9, -0.9]; draw(); });
    const move = (e) => { const rc = P.cv.getBoundingClientRect(); pt = [P.invX(e.clientX - rc.left), P.invY(e.clientY - rc.top)]; draw(); };
    P.cv.addEventListener("click", move);
    el("div", { class: "mlw-hint" }, box, "Click anywhere on the plot to place a new reading.");
    draw(); return draw;
  };

  // 45. A generative model: learn a distribution from data, then draw new samples from it
  W.generate = (box) => {
    const r = rng(45), draw1 = (rr) => (rr() < 0.6 ? -1.2 + 0.5 * rr.normal() : 1.5 + 0.8 * rr.normal());
    const data = [], test = []; for (let i = 0; i < 500; i++) data.push(draw1(r)); for (let i = 0; i < 500; i++) test.push(draw1(r));
    const MODELS = ["one normal distribution", "mixture of 2 normals", "mixture of 4 normals"];
    let model = MODELS[1], fake = [], seed = 1;
    const em = (K) => {
      const s = data.slice().sort((a, b) => a - b), w = new Array(K).fill(1 / K), mu = [], sd = new Array(K).fill(1);
      for (let j = 0; j < K; j++) mu.push(s[Math.floor((j + 0.5) / K * s.length)]);
      for (let it = 0; it < 200; it++) {
        const R = data.map((x) => { const q = mu.map((m, j) => w[j] * Math.exp(-0.5 * ((x - m) / sd[j]) ** 2) / sd[j]); const t = q.reduce((a, b) => a + b, 0) || 1e-300; return q.map((v) => v / t); });
        for (let j = 0; j < K; j++) { const n = R.reduce((a, q) => a + q[j], 0); w[j] = n / data.length; mu[j] = R.reduce((a, q, i) => a + q[j] * data[i], 0) / n; sd[j] = Math.max(0.08, Math.sqrt(R.reduce((a, q, i) => a + q[j] * (data[i] - mu[j]) ** 2, 0) / n)); }
      }
      return { w, mu, sd };
    };
    const fits = {}; MODELS.forEach((m, i) => { fits[m] = em([1, 2, 4][i]); });
    const dens = (x) => { const f = fits[model]; return f.w.reduce((s, w, j) => s + w * Math.exp(-0.5 * ((x - f.mu[j]) / f.sd[j]) ** 2) / (f.sd[j] * Math.sqrt(2 * Math.PI)), 0); };
    const sample = (n) => { const rr = rng(1000 + seed++), f = fits[model], out = []; for (let i = 0; i < n; i++) { let u = rr(), j = 0; while (j < f.w.length - 1 && u > f.w[j]) { u -= f.w[j]; j++; } out.push(f.mu[j] + f.sd[j] * rr.normal()); } return out; };
    const P = plot(box, [-3.5, 4.5], [0, 0.55], { ratio: 0.5, maxWidth: 680 });
    const out = readout(box), NB = 32, BW = 8 / NB;
    const draw = () => {
      const k = C(); P.clear(); P.axes("measured quantity", "density", ticks(-3, 4, 7), ticks(0, 0.5, 5));
      P.clip(() => {
        hist(P, data, -3.5, 4.5, NB, rgba(k.a, 0.28), null, 1 / (data.length * BW));
        if (fake.length) { const h = new Array(NB).fill(0); fake.forEach((v) => { const i = Math.floor((v + 3.5) / BW); if (i >= 0 && i < NB) h[i]++; }); const pts = []; h.forEach((n, i) => { const y = n / (fake.length * BW); pts.push([-3.5 + i * BW, y], [-3.5 + (i + 1) * BW, y]); }); P.line(pts, k.r, 2); }
        const g = []; for (let x = -3.5; x <= 4.5; x += 0.02) g.push([x, dens(x)]); P.line(g, k.ink, 2.2);
      });
      legend(P, [["real data (histogram)", rgba(k.a, 0.5), null, "box"], ["learned density p̂(x)", k.ink], ...(fake.length ? [["generated samples", k.r]] : [])], "right");
      const tll = test.reduce((s, x) => s + Math.log(Math.max(1e-300, dens(x))), 0) / test.length;
      out.innerHTML = `Model: ${model}. Average log-likelihood of 500 <i>new</i> real measurements = <b>${tll.toFixed(3)}</b> (higher is better). ` +
        (fake.length ? `Red: ${fake.length} samples generated by the model. ` : "Press Generate to draw new samples from the learned density. ") +
        `A single normal cannot make two peaks, so its samples look wrong; the mixture of 2 matches the data. Once a model has learned p(x), generating is just sampling from it.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "model", MODELS, model, (v) => { model = v; fake = []; draw(); });
    button(c, "Generate 500 samples", () => { fake = sample(500); draw(); });
    draw(); return draw;
  };

  // 46. Exploration versus exploitation: an ε-greedy agent on three slot machines
  W.bandit = (box) => {
    const TRUE = [0.3, 0.5, 0.7], N = 600;
    let eps = 0.1, seed = 1, Q = [0, 0, 0], n = [0, 0, 0], rewards = [], playing = false, t = 0, rr = rng(1);
    const wrap = el("div", { class: "mlw-pair" }, box), L = el("div", {}, wrap), R = el("div", {}, wrap);
    const B = plot(L, [0, 3], [0, 1], { ratio: 0.85, maxWidth: 300 }), P = plot(R, [0, N], [0, 1], { ratio: 0.62, maxWidth: 440 });
    const out = readout(box);
    const reset = () => { Q = [0, 0, 0]; n = [0, 0, 0]; rewards = []; t = 0; rr = rng(100 + seed); };
    const pull = () => {
      const a = rr() < eps ? Math.floor(rr() * 3) : Q.indexOf(Math.max(...Q)), rw = rr() < TRUE[a] ? 1 : 0;
      n[a]++; Q[a] += (rw - Q[a]) / n[a]; rewards.push(rw); t++;
    };
    const draw = () => {
      const k = C(); B.clear(); B.axes("machine", "chance of reward", [], ticks(0, 1, 4));
      const c = B.ctx;
      for (let a = 0; a < 3; a++) {
        c.fillStyle = rgba(k.a, 0.6); c.fillRect(B.X(a + 0.2), B.Y(Q[a]), B.X(a + 0.8) - B.X(a + 0.2), B.Y(0) - B.Y(Q[a]));
        B.line([[a + 0.12, TRUE[a]], [a + 0.88, TRUE[a]]], k.r, 2.4, [5, 3]);
        B.text(["A", "B", "C"][a], B.X(a + 0.5), B.h - B.pad.b + 12, k.ink, "center"); B.text(`${n[a]}×`, B.X(a + 0.5), B.Y(Math.max(Q[a], TRUE[a])) - 10, k.muted, "center");
      }
      legend(B, [["estimated Q", rgba(k.a, 0.6), null, "box"], ["true value", k.r, [5, 3]]], "left");
      P.clear(); P.axes("pull", "average reward so far", ticks(0, N, 6), ticks(0, 1, 4));
      P.clip(() => {
        P.line([[0, 0.7], [N, 0.7]], k.g, 1.4, [5, 3]);
        let s = 0; const pts = rewards.map((v, i) => { s += v; return [i + 1, s / (i + 1)]; }); if (pts.length > 1) P.line(pts, k.a, 2.2);
      });
      legend(P, [["this run", k.a], ["best possible (always C)", k.g, [5, 3]]], "bottom-right");
      const avg = rewards.length ? rewards.reduce((a, b) => a + b, 0) / rewards.length : 0;
      out.innerHTML = `ε = ${eps.toFixed(2)}: the agent explores (a random machine) with probability ε and otherwise exploits the machine with the highest estimate. ` +
        `After ${t} pulls the average reward is <b>${avg.toFixed(3)}</b>; machine C was chosen ${t ? (100 * n[2] / t).toFixed(0) : 0}% of the time. ` +
        `With ε = 0 the agent can lock onto a poor machine forever; with ε large it wastes pulls on machines it already knows are poor.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "exploration ε", 0, 0.6, 0.01, eps, (v) => v.toFixed(2), (v) => { eps = v; });
    const runB = button(c, "Run 600 pulls", () => {
      if (playing) { playing = false; runB.textContent = "Run 600 pulls"; return; }
      reset(); playing = true; runB.textContent = "Stop";
      const f = () => { if (!playing) return; for (let q = 0; q < 6 && t < N; q++) pull(); draw(); if (t < N) requestAnimationFrame(f); else { playing = false; runB.textContent = "Run 600 pulls"; seed++; } };
      requestAnimationFrame(f);
    });
    reset(); for (let i = 0; i < N; i++) pull(); seed++;
    draw(); return draw;
  };

  // 47. Physics-informed fit: data term plus λ × residual of the oscillator equation (solved exactly by least squares)
  W.pinn = (box) => {
    const d0 = 2, w0 = 20, om = Math.sqrt(w0 * w0 - d0 * d0), xt = (t) => Math.exp(-d0 * t) * (Math.cos(om * t) + d0 / om * Math.sin(om * t));
    const r = rng(47), TD = [], XD = []; for (let i = 0; i < 12; i++) { const t = 0.35 * i / 11; TD.push(t); XD.push(xt(t) + 0.03 * r.normal()); }
    const DEG = 30, TC = []; for (let j = 0; j < 120; j++) TC.push(j / 119);
    const cheb = (t) => {
      const s = 2 * t - 1, T = [1, s], dT = [0, 1], ddT = [0, 0];
      for (let n = 1; n < DEG; n++) { T.push(2 * s * T[n] - T[n - 1]); dT.push(2 * T[n] + 2 * s * dT[n] - dT[n - 1]); ddT.push(4 * dT[n] + 2 * s * ddT[n] - ddT[n - 1]); }
      return [T, dT.map((v) => 2 * v), ddT.map((v) => 4 * v)];
    };
    const BD = TD.map((t) => cheb(t)[0]), BC = TC.map(cheb), G = []; for (let i = 0; i <= 300; i++) G.push(i / 300);
    const BG = G.map((t) => cheb(t)[0]);
    let ll = 0, dl = 2;
    const P = plot(box, [0, 1], [-1.3, 1.3], { ratio: 0.46, maxWidth: 700 });
    const out = readout(box);
    const draw = () => {
      const k = C(), lam = ll <= -4.99 ? 0 : Math.pow(10, ll), rows = [], y = [];
      BD.forEach((b, i) => { rows.push(b.map((v) => v / Math.sqrt(12))); y.push(XD[i] / Math.sqrt(12)); });
      if (lam > 0) BC.forEach(([T, dT, ddT]) => { rows.push(T.map((_, n) => (ddT[n] + 2 * dl * dT[n] + w0 * w0 * T[n]) / (w0 * w0) * Math.sqrt(lam / 120))); y.push(0); });
      const c = lsq(rows, y, 1e-7), f = BG.map((b) => b.reduce((s, v, n) => s + v * c[n], 0));
      P.clear(); P.axes("time t (s)", "position x", ticks(0, 1, 10), ticks(-1, 1, 2));
      const cx = P.ctx; cx.fillStyle = rgba(k.muted, 0.12); cx.fillRect(P.X(0), P.Y(1.3), P.X(0.35) - P.X(0), P.Y(-1.3) - P.Y(1.3));
      P.clip(() => { P.line(G.map((t) => [t, xt(t)]), k.muted, 1.6, [5, 4]); P.line(G.map((t, i) => [t, f[i]]), lam > 0 ? k.g : k.r, 2.4); TD.forEach((t, i) => P.dot(t, XD[i], k.a, 4)); });
      legend(P, [["true motion", k.muted, [5, 4]], ["12 measurements (grey band)", k.a, null, "dot"], [lam > 0 ? "physics-informed fit" : "fit to the data only", lam > 0 ? k.g : k.r]], "right");
      let e = 0, ne = 0; G.forEach((t, i) => { if (t > 0.35) { e += (f[i] - xt(t)) ** 2; ne++; } });
      const de = Math.sqrt(BD.reduce((s, b, i) => s + (b.reduce((q, v, n) => q + v * c[n], 0) - XD[i]) ** 2, 0) / 12);
      out.innerHTML = `λ = <b>${lam === 0 ? "0" : lam.toPrecision(2)}</b>, damping in the law δ = ${dl.toFixed(1)} s⁻¹ (true 2.0). RMS error on the 12 measurements = ${de.toFixed(3)}; ` +
        `RMS error after 0.35 s, where there are no data = <b>${Math.sqrt(e / ne).toFixed(3)}</b>. ` +
        (lam === 0 ? "With λ = 0 only the data count: the curve passes through the points and is free to do anything beyond them." :
          Math.abs(dl - 2) > 0.3 ? "The law is wrong, and the fit follows the wrong law confidently: a PINN is only as good as the physics you give it." :
            "The data fix the start; the equation, checked at 120 collocation times across the whole second, carries the solution forward.");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "physics weight log₁₀ λ", -5, 2, 0.1, ll, (v) => (v <= -4.99 ? "λ = 0" : "λ = " + Math.pow(10, v).toPrecision(2)), (v) => { ll = v; draw(); });
    slider(c, "damping δ in the law", 0, 6, 0.1, dl, (v) => v.toFixed(1), (v) => { dl = v; draw(); });
    draw(); return draw;
  };

  // 48. Outside the training range: models fitted where data exist can fail where they do not
  W.datashift = (box) => {
    const truth = (x) => 0.4 * x + 1.5 * Math.sin(0.9 * x), r = rng(48), ALL = [];
    for (let i = 0; i < 160; i++) { const x = 10 * r(); ALL.push([x, truth(x) + 0.35 * r.normal()]); }
    const MODELS = ["polynomial", "nearest neighbours (k = 5)"];
    let a = 6, deg = 4, model = MODELS[0];
    const P = plot(box, [0, 10], [-2, 7], { ratio: 0.5, maxWidth: 700 });
    const out = readout(box), G = []; for (let x = 0; x <= 10.0001; x += 0.02) G.push(x);
    const draw = () => {
      const k = C(), tr = ALL.filter((p) => p[0] <= a), te = ALL.filter((p) => p[0] > a);
      let f;
      if (model === MODELS[0]) { const g = polyfit(tr.map((p) => p[0] / 5 - 1), tr.map((p) => p[1]), deg, 1e-7); f = (x) => g(x / 5 - 1); }
      else f = (x) => tr.map((p) => [Math.abs(p[0] - x), p[1]]).sort((p, q) => p[0] - q[0]).slice(0, 5).reduce((s, p) => s + p[1] / 5, 0);
      P.clear(); P.axes("x (e.g. temperature, energy, time)", "y", ticks(0, 10, 10), ticks(-2, 6, 4));
      const c = P.ctx; c.fillStyle = rgba(k.g, 0.1); c.fillRect(P.X(0), P.Y(7), P.X(a) - P.X(0), P.Y(-2) - P.Y(7));
      P.text("training data cover this range", P.X(0) + 8, P.Y(6.6), k.g);
      P.clip(() => { P.line(G.map((x) => [x, truth(x)]), k.muted, 1.4, [5, 4]); tr.forEach((p) => P.dot(p[0], p[1], k.a, 3)); te.forEach((p) => P.dot(p[0], p[1], k.b, 3)); P.line(G.map((x) => [x, f(x)]), k.r, 2.4); });
      legend(P, [["training data", k.a, null, "dot"], ["new data, outside the range", k.b, null, "dot"], ["model", k.r]], "bottom-right");
      const rm = (D) => Math.sqrt(D.reduce((s, p) => s + (p[1] - f(p[0])) ** 2, 0) / Math.max(1, D.length));
      out.innerHTML = `RMS error inside the training range = <b>${rm(tr).toFixed(2)}</b>; on new data outside it = <b style="color:${k.r}">${te.length ? rm(te).toFixed(2) : "—"}</b> (noise 0.35). ` +
        `The model looks excellent on data like its training data and can be badly wrong elsewhere: a polynomial shoots off, nearest neighbours stay flat. ` +
        `Test a model on data from the conditions where it will be used, and say where it was trained.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "model", MODELS, model, (v) => { model = v; draw(); });
    slider(c, "training data up to x =", 3, 10, 0.1, a, (v) => v.toFixed(1), (v) => { a = v; draw(); });
    slider(c, "polynomial degree", 1, 9, 1, deg, (v) => v.toFixed(0), (v) => { deg = v; draw(); });
    draw(); return draw;
  };

  // 49. Bias and variance seen directly: many training sets, many fits
  W.biasvar = (box) => {
    const truth = (x) => Math.sin(2.6 * x) + 0.3 * x, SD = 0.3, NSET = 40, N = 20, G = []; for (let i = 0; i <= 120; i++) G.push(-1 + i / 60);
    const sets = []; for (let s = 0; s < NSET; s++) { const r = rng(500 + s), xs = [], ys = []; for (let i = 0; i < N; i++) { const x = -1 + 2 * r(); xs.push(x); ys.push(truth(x) + SD * r.normal()); } sets.push([xs, ys]); }
    const DEGS = 11, stats = [], curves = [];
    for (let d = 0; d < DEGS; d++) {
      const F = sets.map(([xs, ys]) => { const f = polyfit(xs, ys, d, 1e-6); return G.map((x) => Math.max(-6, Math.min(6, f(x)))); });
      const mean = G.map((_, j) => F.reduce((s, f) => s + f[j], 0) / NSET);
      const b2 = G.reduce((s, x, j) => s + (mean[j] - truth(x)) ** 2, 0) / G.length, v = G.reduce((s, _, j) => s + F.reduce((q, f) => q + (f[j] - mean[j]) ** 2, 0) / NSET, 0) / G.length;
      stats.push([b2, v]); curves.push([F, mean]);
    }
    let deg = 1;
    const wrap = el("div", { class: "mlw-pair" }, box), L = el("div", {}, wrap), R = el("div", {}, wrap);
    const P = plot(L, [-1, 1], [-2, 2.2], { ratio: 0.75, maxWidth: 420 }), Q = plot(R, [0, DEGS - 1], [0, 0.6], { ratio: 0.75, maxWidth: 360 });
    const out = readout(box);
    const draw = () => {
      const k = C(), [F, mean] = curves[deg];
      P.clear(); P.axes("x", "y", ticks(-1, 1, 4), ticks(-2, 2, 4));
      P.clip(() => { F.forEach((f) => P.line(G.map((x, j) => [x, f[j]]), rgba(k.a, 0.22), 1.2)); P.line(G.map((x) => [x, truth(x)]), k.ink, 2, [5, 4]); P.line(G.map((x, j) => [x, mean[j]]), k.r, 2.6); });
      legend(P, [[`${NSET} fits, each to a new training set`, rgba(k.a, 0.6)], ["average fit", k.r], ["true f(x)", k.ink, [5, 4]]], "bottom-right");
      Q.clear(); Q.axes("polynomial degree", "error", ticks(0, 10, 5), ticks(0, 0.6, 3));
      Q.clip(() => {
        const b = stats.map((s, d) => [d, s[0]]), v = stats.map((s, d) => [d, s[1]]), t = stats.map((s, d) => [d, s[0] + s[1] + SD * SD]);
        Q.line([[0, SD * SD], [10, SD * SD]], k.muted, 1.2, [3, 3]); Q.line(b, k.a, 2.2); Q.line(v, k.b, 2.2); Q.line(t, k.r, 2.6);
        Q.line([[deg, 0], [deg, 0.6]], k.grid, 1); Q.dot(deg, t[deg][1], k.r, 5.5);
      });
      legend(Q, [["bias²", k.a], ["variance", k.b], ["noise σ²", k.muted, [3, 3]], ["expected test MSE", k.r]], "right");
      out.innerHTML = `Degree ${deg}: bias² = <b>${stats[deg][0].toFixed(3)}</b> (how far the <span style="color:${k.r}">average fit</span> is from the truth), ` +
        `variance = <b>${stats[deg][1].toFixed(3)}</b> (how much the <span style="color:${k.a}">fits</span> scatter around their average), noise = ${(SD * SD).toFixed(2)}. ` +
        `Expected test MSE = bias² + variance + noise = <b>${(stats[deg][0] + stats[deg][1] + SD * SD).toFixed(3)}</b>. Low degree: the fits agree but are all wrong; high degree: right on average, but each one is wild.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "flexibility (polynomial degree)", 0, DEGS - 1, 1, deg, (v) => v.toFixed(0), (v) => { deg = v; draw(); });
    draw(); return draw;
  };

  // 50. The Bayes classifier in one dimension: priors, class densities and the decision boundary
  W.bayes1d = (box) => {
    let pi1 = 0.5, s1 = 1, m1 = 1.5;
    const P = plot(box, [-4, 5], [0, 0.45], { ratio: 0.42, maxWidth: 680 }), Q = plot(box, [-4, 5], [0, 1], { ratio: 0.2, maxWidth: 680 });
    const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
    const out = readout(box), G = []; for (let x = -4; x <= 5.0001; x += 0.01) G.push(x);
    const draw = () => {
      const k = C(), f0 = (x) => (1 - pi1) * pdf(x, -1, 1), f1 = (x) => pi1 * pdf(x, m1, s1);
      P.yr = [0, Math.max(0.2, ...G.map((x) => Math.max(f0(x), f1(x)))) * 1.12];
      P.clear(); P.axes("", "π × density", [], []);
      const c = P.ctx; let err = 0; const cuts = [];
      G.forEach((x, i) => { const a = f0(x), b = f1(x); err += Math.min(a, b) * 0.01; c.fillStyle = b > a ? k.fillA : k.fillB; c.fillRect(P.X(x), P.Y(Math.min(a, b)), P.X(x + 0.01) - P.X(x) + 0.5, P.Y(0) - P.Y(Math.min(a, b))); if (i && (f1(G[i - 1]) > f0(G[i - 1])) !== (b > a)) cuts.push(x); });
      P.line(G.map((x) => [x, f0(x)]), k.b, 2.4); P.line(G.map((x) => [x, f1(x)]), k.a, 2.4);
      cuts.forEach((x) => P.line([[x, 0], [x, P.yr[1]]], k.ink, 1.8, [5, 4]));
      legend(P, [["class 0: (1 − π₁) f₀(x)", k.b], ["class 1: π₁ f₁(x)", k.a], ["Bayes boundary", k.ink, [5, 4]], ["shaded: the errors", k.muted, null, "box"]], "right");
      Q.clear(); Q.axes("x", "P(Y = 1 | x)", ticks(-4, 5, 9), [0, 0.5, 1]);
      Q.clip(() => { Q.line([[-4, 0.5], [5, 0.5]], k.grid, 1, [3, 3]); Q.line(G.map((x) => [x, f1(x) / (f0(x) + f1(x))]), k.a, 2.4); cuts.forEach((x) => Q.line([[x, 0], [x, 1]], k.ink, 1.4, [5, 4])); });
      out.innerHTML = `The Bayes classifier picks the class with the larger π<sub>k</sub> f<sub>k</sub>(x), i.e. P(Y = 1 | x) > 0.5. ` +
        `Boundary at x = <b>${cuts.map((x) => x.toFixed(2)).join(" and ") || "none (one class always wins)"}</b>. Bayes error rate (the shaded area) = <b>${(100 * err).toFixed(1)}%</b>: no classifier can do better on these classes. ` +
        `Make class 1 rarer and the boundary moves into its territory; give it a different spread and the boundary splits in two.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "prior π₁ (share of class 1)", 0.02, 0.98, 0.01, pi1, (v) => v.toFixed(2), (v) => { pi1 = v; draw(); });
    slider(c, "class 1 mean", -1, 4, 0.05, m1, (v) => v.toFixed(2), (v) => { m1 = v; draw(); });
    slider(c, "class 1 spread", 0.4, 2.5, 0.05, s1, (v) => v.toFixed(2), (v) => { s1 = v; draw(); });
    draw(); return draw;
  };

  // 51. The same data, three kinds of question: regression, classification, clustering
  W.mltypes = (box) => {
    const r = rng(51), D = [];
    for (let i = 0; i < 70; i++) { const f = i < 45 ? 0 : 1, v = f ? 4 + 1.1 * r.normal() : 2.2 + 0.8 * r.normal(); D.push({ v, T: (f ? 52 : 40) + 3.2 * v + 3 * r.normal(), f }); }
    const TASKS = ["regression: predict a number", "classification: predict a label", "clustering: no labels at all"];
    let task = TASKS[0], km = null;
    const P = plot(box, [0, 7], [35, 80], { ratio: 0.55, maxWidth: 640 });
    const out = readout(box);
    const fitL = lsq(D.map((d) => [1, d.v]), D.map((d) => d.T));
    const kmeans = () => {
      let c = [[1.5, 42], [5, 70]]; const sx = 2, sy = 10, lab = new Array(D.length).fill(0);
      for (let it = 0; it < 20; it++) {
        D.forEach((d, i) => { lab[i] = ((d.v - c[0][0]) / sx) ** 2 + ((d.T - c[0][1]) / sy) ** 2 < ((d.v - c[1][0]) / sx) ** 2 + ((d.T - c[1][1]) / sy) ** 2 ? 0 : 1; });
        c = [0, 1].map((j) => { const m = D.filter((_, i) => lab[i] === j); return [m.reduce((s, d) => s + d.v, 0) / m.length, m.reduce((s, d) => s + d.T, 0) / m.length]; });
      }
      return { lab, c };
    };
    const lda = (() => { const m0 = [0, 0], m1 = [0, 0], n = [0, 0]; D.forEach((d) => { const m = d.f ? m1 : m0; m[0] += d.v; m[1] += d.T; n[d.f]++; }); m0[0] /= n[0]; m0[1] /= n[0]; m1[0] /= n[1]; m1[1] /= n[1]; const w = [(m1[0] - m0[0]) / 1, (m1[1] - m0[1]) / 16]; const mid = [(m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2]; return [w[0], w[1], -(w[0] * mid[0] + w[1] * mid[1])]; })();
    const draw = () => {
      const k = C(); P.clear(); P.axes("vibration (mm/s)", "temperature (°C)", ticks(0, 7, 7), ticks(40, 80, 4));
      P.clip(() => {
        if (task === TASKS[0]) { D.forEach((d) => P.dot(d.v, d.T, k.ink, 3.4)); P.line([[0, fitL[0]], [7, fitL[0] + 7 * fitL[1]]], k.r, 2.4); }
        else if (task === TASKS[1]) { regions(P, (x) => lda[0] * x[0] + lda[1] * x[1] + lda[2] > 0, 70, 45); D.forEach((d) => P.dot(d.v, d.T, d.f ? k.b : k.a, 3.6)); lineEq(P, lda[0], lda[1], lda[2], k.ink, 2.2); }
        else { if (!km) km = kmeans(); D.forEach((d, i) => P.dot(d.v, d.T, km.lab[i] ? k.g : k.r, 3.6)); km.c.forEach((m) => { P.dot(m[0], m[1], k.ink, 7); }); }
      });
      const L = task === TASKS[0] ? [["machines", k.ink, null, "dot"], ["fitted line: temperature from vibration", k.r]] :
        task === TASKS[1] ? [["healthy", k.a, null, "dot"], ["faulty", k.b, null, "dot"], ["decision boundary", k.ink]] : [["group 1 (found)", k.r, null, "dot"], ["group 2 (found)", k.g, null, "dot"], ["group centres", k.ink, null, "dot"]];
      legend(P, L, "left");
      out.innerHTML = task === TASKS[0] ? "<b>Regression</b> (supervised): the output Y is a number, here the temperature, and is known for the training machines. The model predicts it for a new vibration level." :
        task === TASKS[1] ? "<b>Classification</b> (supervised): the output is a category, healthy or faulty, known for the training machines. The model draws a boundary and labels new machines by the side they fall on." :
          "<b>Clustering</b> (unsupervised): there is no output at all, only the measurements. k-means finds two groups by itself; whether they mean healthy and faulty is for us to check.";
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "question", TASKS, task, (v) => { task = v; draw(); });
    draw(); return draw;
  };

  // 52. A data table and its scatter plot: each row is a point; Y = f(X) + ε
  W.table = (box) => {
    const f = (x) => 20 + 6 * x - 0.35 * x * x, r = rng(52), rows = [];
    for (let i = 0; i < 10; i++) { const x = +(1 + i * 0.9 + 0.3 * r()).toFixed(1), e = +(2.2 * r.normal()).toFixed(1); rows.push({ x, e, y: +(f(x) + e).toFixed(1) }); }
    let sel = 3, reveal = false;
    const wrap = el("div", { class: "mlw-pair" }, box), L = el("div", { class: "mlw-col-narrow" }, wrap), R = el("div", {}, wrap);
    const tb = el("table", { class: "mlw-cm" }, L);
    const P = plot(R, [0, 11], [15, 50], { ratio: 0.75, maxWidth: 440 });
    const out = readout(box);
    const draw = () => {
      const k = C();
      tb.innerHTML = `<tr><th>i</th><th>x<sub>i</sub> (load, kN)</th><th>y<sub>i</sub> (strain)</th>${reveal ? "<th>f(x<sub>i</sub>)</th><th>ε<sub>i</sub></th>" : ""}</tr>` +
        rows.map((q, i) => `<tr data-i="${i}" style="cursor:pointer;${i === sel ? `background:${rgba(k.a, 0.15)};font-weight:bold` : ""}"><td>${i + 1}</td><td>${q.x}</td><td>${q.y}</td>${reveal ? `<td>${f(q.x).toFixed(1)}</td><td>${q.e > 0 ? "+" : ""}${q.e}</td>` : ""}</tr>`).join("");
      tb.querySelectorAll("tr[data-i]").forEach((tr) => tr.addEventListener("click", () => { sel = +tr.dataset.i; draw(); }));
      P.clear(); P.axes("x (load)", "y (strain)", ticks(0, 10, 5), ticks(20, 50, 3));
      P.clip(() => {
        if (reveal) { const g = []; for (let x = 0; x <= 11; x += 0.05) g.push([x, f(x)]); P.line(g, k.g, 2.2); const q = rows[sel]; P.line([[q.x, f(q.x)], [q.x, q.y]], k.r, 2.4); }
        rows.forEach((q, i) => P.dot(q.x, q.y, i === sel ? k.b : k.a, i === sel ? 6.5 : 4));
      });
      if (reveal) legend(P, [["true f(x), normally unknown", k.g], ["ε: the noise in this row", k.r]], "bottom-right");
      const q = rows[sel];
      out.innerHTML = `Row ${sel + 1} is the point (x<sub>${sel + 1}</sub>, y<sub>${sel + 1}</sub>) = (${q.x}, ${q.y}). ` + (reveal ?
        `It splits as y = f(x) + ε = ${f(q.x).toFixed(1)} ${q.e < 0 ? "−" : "+"} ${Math.abs(q.e)}. In real data we see only the first three columns: estimating f from them is the whole job of statistical learning.` :
        "Click a row or a point. Then tick the box to see what the data hide: the true function f and the noise ε of every row.");
    };
    P.cv.addEventListener("click", (e) => { const rc = P.cv.getBoundingClientRect(), px = e.clientX - rc.left, py = e.clientY - rc.top; let b = 0, bd = Infinity; rows.forEach((q, i) => { const d = Math.hypot(P.X(q.x) - px, P.Y(q.y) - py); if (d < bd) { bd = d; b = i; } }); sel = b; draw(); });
    const c = el("div", { class: "mlw-controls" }, box);
    checkbox(c, "reveal the true f and the noise ε", reveal, (v) => { reveal = v; draw(); });
    draw(); return draw;
  };

  // 53. Notation for a data matrix: n rows (observations), p columns (variables)
  W.notation = (box) => {
    const VARS = ["vibration", "temperature", "current", "noise", "hours"], r = rng(53), vals = [];
    for (let i = 0; i < 8; i++) vals.push([2 + 3 * r(), 40 + 30 * r(), 8 + 6 * r(), 60 + 20 * r(), 100 + 900 * r()].map((v) => +v.toFixed(v > 99 ? 0 : 1)));
    const MODES = ["one entry xᵢⱼ", "one row xᵢ (an observation)", "one column xⱼ (a variable)", "the transpose Xᵀ"];
    let n = 5, p = 3, i0 = 1, j0 = 0, mode = MODES[0];
    const holder = el("div", { class: "mlw-matwrap" }, box);
    const out = readout(box);
    const draw = () => {
      const k = C(), T = mode === MODES[3], R = T ? p : n, Cc = T ? n : p, hi = rgba(k.a, 0.22), hj = rgba(k.b, 0.25);
      let h = `<table class="mlw-cm" style="text-align:center"><tr><th></th>${Array.from({ length: Cc }, (_, c) => `<th>${T ? `obs ${c + 1}` : VARS[c]}<br><small>j = ${c + 1}</small></th>`).join("")}</tr>`;
      for (let a = 0; a < R; a++) {
        h += `<tr><th>${T ? VARS[a] : `i = ${a + 1}`}</th>`;
        for (let b = 0; b < Cc; b++) {
          const i = T ? b : a, j = T ? a : b;
          const on = (mode === MODES[0] && i === i0 && j === j0) || (mode === MODES[1] && i === i0) || (mode === MODES[2] && j === j0);
          h += `<td data-i="${i}" data-j="${j}" style="cursor:pointer;${on ? `background:${mode === MODES[2] ? hj : hi};font-weight:bold` : ""}">${vals[i][j]}</td>`;
        }
        h += "</tr>";
      }
      holder.innerHTML = h + "</table>";
      holder.querySelectorAll("td[data-i]").forEach((td) => td.addEventListener("click", () => { i0 = +td.dataset.i; j0 = +td.dataset.j; draw(); }));
      const row = vals[i0].slice(0, p), col = vals.slice(0, n).map((v) => v[j0]);
      out.innerHTML = mode === MODES[0] ? `x<sub>${i0 + 1}${j0 + 1}</sub> = <b>${vals[i0][j0]}</b>: row i = ${i0 + 1} (machine ${i0 + 1}), column j = ${j0 + 1} (${VARS[j0]}). First index: the row; second: the column. X has n = ${n} rows and p = ${p} columns: it is ${n} × ${p}.` :
        mode === MODES[1] ? `x<sub>${i0 + 1}</sub> = (${row.join(", ")})<sup>T</sup>: all p = ${p} measurements on machine ${i0 + 1}, a vector of length p. Vectors are columns by convention, hence the transpose when written in a line.` :
          mode === MODES[2] ? `x<sub>${j0 + 1}</sub> = (${col.join(", ")})<sup>T</sup>: the ${VARS[j0]} of all n = ${n} machines, a vector of length n. The same symbol style as a row, so the text always says which is meant.` :
            `Xᵀ swaps rows and columns: it is ${p} × ${n}. Entry (j, i) of Xᵀ is entry (i, j) of X. Now each column is one machine.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "show", MODES, mode, (v) => { mode = v; draw(); });
    slider(c, "n (observations)", 2, 8, 1, n, (v) => v.toFixed(0), (v) => { n = v; i0 = Math.min(i0, n - 1); draw(); });
    slider(c, "p (variables)", 1, 5, 1, p, (v) => v.toFixed(0), (v) => { p = v; j0 = Math.min(j0, p - 1); draw(); });
    el("div", { class: "mlw-hint" }, box, "Click any number in the table to select its row and column.");
    draw(); return draw;
  };

  // 54. Gradient descent on the cost surface J(β₀, β₁), with raw or standardised input
  W.losssurface = (box) => {
    const r = rng(54), X = [], Y = []; for (let i = 0; i < 30; i++) { const x = 10 * r(); X.push(x); Y.push(2 + 0.5 * x + 0.6 * r.normal()); }
    const mx = X.reduce((a, b) => a + b, 0) / 30, sx = Math.sqrt(X.reduce((a, x) => a + (x - mx) ** 2, 0) / 30);
    const MODES = ["raw input x (0 to 10)", "standardised input (mean 0, sd 1)"];
    let mode = MODES[0], alpha = 0.03, path, running = false;
    const xs = () => (mode === MODES[0] ? X : X.map((x) => (x - mx) / sx));
    const geo = () => {
      const x = xs(), n = x.length, H = [[1, x.reduce((a, b) => a + b, 0) / n], [0, x.reduce((a, b) => a + b * b, 0) / n]]; H[1][0] = H[0][1];
      const bh = lsq(x.map((v) => [1, v]), Y); return { x, H, bh, E: eigSym(H) };
    };
    let g = geo();
    const J = (b) => g.x.reduce((s, v, i) => s + (b[0] + b[1] * v - Y[i]) ** 2, 0) / (2 * g.x.length);
    const grad = (b) => { let a = 0, c = 0; g.x.forEach((v, i) => { const e = b[0] + b[1] * v - Y[i]; a += e; c += e * v; }); return [a / g.x.length, c / g.x.length]; };
    const startAt = () => [g.bh[0] - 2.5, g.bh[1] + 2.2];
    path = [startAt()];
    const wrap = el("div", { class: "mlw-pair" }, box), L = el("div", {}, wrap), R = el("div", {}, wrap);
    const P = plot(L, [0, 1], [0, 1], { ratio: 0.9, maxWidth: 400 }), Q = plot(R, [0, 10], [0, 9], { ratio: 0.9, maxWidth: 360 });
    const out = readout(box);
    const draw = () => {
      const k = C(); P.xr = [g.bh[0] - 3.5, g.bh[0] + 3.5]; P.yr = [g.bh[1] - 3.5, g.bh[1] + 3.5];
      P.clear(); P.axes("intercept β₀", "slope β₁", ticks(Math.ceil(P.xr[0]), Math.ceil(P.xr[0]) + 6, 3), ticks(Math.ceil(P.yr[0]), Math.ceil(P.yr[0]) + 6, 3));
      P.clip(() => {
        [0.05, 0.2, 0.5, 1, 2, 4, 8, 16].forEach((lev, i) => {
          const pts = []; for (let t = 0; t <= 2 * Math.PI + 0.01; t += 0.03) { const a = Math.sqrt(2 * lev / g.E.vals[0]) * Math.cos(t), b = Math.sqrt(2 * lev / g.E.vals[1]) * Math.sin(t); pts.push([g.bh[0] + a * g.E.vecs[0][0] + b * g.E.vecs[1][0], g.bh[1] + a * g.E.vecs[0][1] + b * g.E.vecs[1][1]]); }
          P.line(pts, rgba(k.a, 0.25 + 0.06 * i), 1.2);
        });
        P.line(path, k.r, 1.6); path.forEach((b, i) => P.dot(b[0], b[1], i === path.length - 1 ? k.b : k.r, i === path.length - 1 ? 5.5 : 2.6));
        P.dot(g.bh[0], g.bh[1], k.ink, 4);
      });
      const b = path[path.length - 1], sc = mode === MODES[0];
      Q.clear(); Q.axes("x", "y", ticks(0, 10, 5), ticks(0, 8, 4));
      Q.clip(() => { X.forEach((x, i) => Q.dot(x, Y[i], k.ink, 3)); Q.line([0, 10].map((x) => [x, sc ? b[0] + b[1] * x : b[0] + b[1] * (x - mx) / sx]), k.b, 2.4); });
      const ratio = g.E.vals[0] / g.E.vals[1], amax = 2 / g.E.vals[0];
      out.innerHTML = `Step ${path.length - 1}: J = <b>${J(b).toFixed(3)}</b> (minimum ${J(g.bh).toFixed(3)}). The contours are ellipses; their long-to-short axis ratio is ${Math.sqrt(ratio).toFixed(1)}. ` +
        `Largest stable step α = 2/λ<sub>max</sub> = ${amax.toFixed(3)}. ` +
        (sc ? "With the raw input the valley is long and narrow: a step small enough not to blow up across the valley crawls along it." : "Standardised, the contours are nearly circles and gradient descent heads straight for the minimum.") +
        (Math.hypot(b[0], b[1]) > 1e3 ? " <b>Diverged</b>: α is too large." : "");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "input", MODES, mode, (v) => { mode = v; g = geo(); path = [startAt()]; draw(); });
    slider(c, "step size α", 0.005, 1.2, 0.005, alpha, (v) => v.toFixed(3), (v) => { alpha = v; path = [path[0]]; draw(); });
    const stepN = (m) => { for (let q = 0; q < m; q++) { const b = path[path.length - 1]; if (Math.hypot(b[0], b[1]) > 1e3) break; const d = grad(b); path.push([b[0] - alpha * d[0], b[1] - alpha * d[1]]); } };
    button(c, "One step", () => { stepN(1); draw(); });
    const runB = button(c, "Run 100 steps", () => {
      if (running) return; running = true; let m = 0;
      const f = () => { stepN(2); m += 2; draw(); if (m < 100) requestAnimationFrame(f); else running = false; };
      requestAnimationFrame(f);
    });
    button(c, "Restart", () => { path = [path[0]]; draw(); });
    P.cv.addEventListener("click", (e) => { const rc = P.cv.getBoundingClientRect(); path = [[P.invX(e.clientX - rc.left), P.invY(e.clientY - rc.top)]]; draw(); });
    el("div", { class: "mlw-hint" }, box, "Click on the contour plot to start from another point. Try α = 0.03 with the raw input, then switch to the standardised input and try α = 0.5.");
    runB.title = "100 steps of gradient descent";
    draw(); return draw;
  };

  // 55. The sampling distribution of the slope: new samples, new slopes; the standard error is their spread
  W.slopese = (box) => {
    const B0 = 1, B1 = 2, SD = 1.5;
    let n = 15, seed = 1, slopes = [], lines = [], cur = null;
    const wrap = el("div", { class: "mlw-pair" }, box), L = el("div", {}, wrap), R = el("div", {}, wrap);
    const P = plot(L, [0, 4], [-3, 13], { ratio: 0.8, maxWidth: 380 }), Q = plot(R, [0, 4], [0, 1], { ratio: 0.8, maxWidth: 380 });
    const out = readout(box);
    const one = () => {
      const r = rng(700 + seed++), x = [], y = []; for (let i = 0; i < n; i++) { const xi = 4 * r(); x.push(xi); y.push(B0 + B1 * xi + SD * r.normal()); }
      const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n, sxx = x.reduce((a, v) => a + (v - mx) ** 2, 0);
      const b1 = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0) / sxx, b0 = my - b1 * mx;
      const rse = Math.sqrt(y.reduce((a, v, i) => a + (v - b0 - b1 * x[i]) ** 2, 0) / (n - 2));
      cur = { x, y, b0, b1, se: rse / Math.sqrt(sxx) }; slopes.push(b1); lines.push([b0, b1]); if (lines.length > 40) lines.shift();
    };
    const draw = () => {
      const k = C(); P.clear(); P.axes("x", "y", ticks(0, 4, 4), ticks(0, 12, 3));
      P.clip(() => {
        lines.forEach(([a, b]) => P.line([[0, a], [4, a + 4 * b]], rgba(k.a, 0.18), 1.2));
        P.line([[0, B0], [4, B0 + 4 * B1]], k.ink, 1.8, [5, 4]);
        if (cur) { cur.x.forEach((x, i) => P.dot(x, cur.y[i], k.ink, 3.2)); P.line([[0, cur.b0], [4, cur.b0 + 4 * cur.b1]], k.r, 2.4); }
      });
      legend(P, [["true line (β₁ = 2)", k.ink, [5, 4]], ["fit to this sample", k.r], ["earlier fits", rgba(k.a, 0.5)]], "left");
      const se = SD / (Math.sqrt(n) * (4 / Math.sqrt(12))), NB = 32, lo = 0, hi = 4, bw = (hi - lo) / NB;
      const cnt = new Array(NB).fill(0); slopes.forEach((s) => { const i = Math.floor((s - lo) / bw); if (i >= 0 && i < NB) cnt[i]++; });
      const pk = Math.max(1 / (se * Math.sqrt(2 * Math.PI)), ...cnt.map((c) => c / (slopes.length * bw)));
      Q.yr = [0, pk * 1.15];
      Q.clear(); Q.axes("estimated slope β̂₁", "", ticks(0, 4, 4), []);
      Q.clip(() => {
        hist(Q, slopes, lo, hi, NB, rgba(k.a, 0.45), null, 1 / (slopes.length * bw));
        const g = []; for (let s = lo; s <= hi; s += 0.02) g.push([s, Math.exp(-0.5 * ((s - B1) / se) ** 2) / (se * Math.sqrt(2 * Math.PI))]); Q.line(g, k.r, 2);
        if (cur) Q.line([[cur.b1, 0], [cur.b1, Q.yr[1]]], k.b, 2, [4, 3]);
      });
      legend(Q, [[`${slopes.length} slopes so far`, rgba(k.a, 0.6), null, "box"], ["theory: normal, sd = SE", k.r], ["this sample", k.b, [4, 3]]], "right");
      const m = slopes.reduce((a, b) => a + b, 0) / slopes.length, s = Math.sqrt(slopes.reduce((a, v) => a + (v - m) ** 2, 0) / Math.max(1, slopes.length - 1));
      out.innerHTML = `This sample: β̂₁ = <b>${cur.b1.toFixed(2)}</b>, and from this sample alone SE(β̂₁) = <b>${cur.se.toFixed(3)}</b>. ` +
        `Over ${slopes.length} samples the slopes average ${m.toFixed(3)} (unbiased: true 2) with spread ${slopes.length > 2 ? s.toFixed(3) : "—"}. ` +
        `The standard error estimates that spread from one sample, without ever drawing another. Increase n: the histogram narrows like 1/√n.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "sample size n", 5, 100, 1, n, (v) => v.toFixed(0), (v) => { n = v; slopes = []; lines = []; one(); draw(); });
    button(c, "New sample", () => { one(); draw(); });
    button(c, "Hundred samples", () => { for (let i = 0; i < 100; i++) one(); draw(); });
    for (let i = 0; i < 30; i++) one(); draw(); return draw;
  };

  // 56. LDA versus QDA: a shared covariance gives a straight boundary, separate ones a curved boundary
  W.ldaqda = (box) => {
    let t = 0.7, shadeBy = "QDA", tr, te;
    const make = () => {
      const r = rng(56), a = 0.6 + 1.3 * t, L1 = [[a, 0], [0.9 * t * a * 0.6, Math.max(0.25, 0.7 - 0.45 * t)]], L0 = [[0.7, 0], [0, 0.7]];
      tr = []; te = [];
      gauss2(r, 100, [-1, 0], L0).forEach((x) => tr.push({ x, y: 0 })); gauss2(r, 100, [1, 0.3], L1).forEach((x) => tr.push({ x, y: 1 }));
      gauss2(r, 800, [-1, 0], L0).forEach((x) => te.push({ x, y: 0 })); gauss2(r, 800, [1, 0.3], L1).forEach((x) => te.push({ x, y: 1 }));
    };
    const stats = () => {
      const M = [[0, 0], [0, 0]], S = [0, 1].map(() => [[0, 0], [0, 0]]), n = [0, 0];
      tr.forEach((d) => { n[d.y]++; M[d.y][0] += d.x[0]; M[d.y][1] += d.x[1]; }); M.forEach((m, y) => { m[0] /= n[y]; m[1] /= n[y]; });
      tr.forEach((d) => { const a = d.x[0] - M[d.y][0], b = d.x[1] - M[d.y][1], s = S[d.y]; s[0][0] += a * a; s[0][1] += a * b; s[1][1] += b * b; });
      const cov = (s, m) => [[s[0][0] / m, s[0][1] / m], [s[0][1] / m, s[1][1] / m]], pool = cov([[S[0][0][0] + S[1][0][0], S[0][0][1] + S[1][0][1]], [0, S[0][1][1] + S[1][1][1]]], tr.length - 2);
      return { M, C0: cov(S[0], n[0] - 1), C1: cov(S[1], n[1] - 1), pool, pi: n.map((v) => v / tr.length) };
    };
    const inv = (A) => { const d = A[0][0] * A[1][1] - A[0][1] * A[1][0]; return { I: [[A[1][1] / d, -A[0][1] / d], [-A[1][0] / d, A[0][0] / d]], ld: Math.log(d) }; };
    const qf = (I, x, m) => { const a = x[0] - m[0], b = x[1] - m[1]; return a * (I[0][0] * a + I[0][1] * b) + b * (I[1][0] * a + I[1][1] * b); };
    const P = plot(box, [-4, 5], [-3.5, 3.5], { ratio: 0.66, maxWidth: 640 });
    const out = readout(box);
    const draw = () => {
      const k = C(), s = stats(), Ip = inv(s.pool), I0 = inv(s.C0), I1 = inv(s.C1);
      const lda = (x) => -0.5 * qf(Ip.I, x, s.M[1]) + Math.log(s.pi[1]) > -0.5 * qf(Ip.I, x, s.M[0]) + Math.log(s.pi[0]) ? 1 : 0;
      const qda = (x) => -0.5 * qf(I1.I, x, s.M[1]) - 0.5 * I1.ld + Math.log(s.pi[1]) > -0.5 * qf(I0.I, x, s.M[0]) - 0.5 * I0.ld + Math.log(s.pi[0]) ? 1 : 0;
      P.clear(); regions(P, shadeBy === "QDA" ? qda : lda, 90, 60);
      P.axes("x₁", "x₂", ticks(-4, 5, 9), ticks(-3, 3, 6));
      const dm = [s.M[1][0] - s.M[0][0], s.M[1][1] - s.M[0][1]], w = [Ip.I[0][0] * dm[0] + Ip.I[0][1] * dm[1], Ip.I[1][0] * dm[0] + Ip.I[1][1] * dm[1]];
      const c0 = -0.5 * (qf(Ip.I, [0, 0], s.M[1]) - qf(Ip.I, [0, 0], s.M[0])) + Math.log(s.pi[1] / s.pi[0]);
      P.clip(() => { tr.forEach((d) => P.dot(d.x[0], d.x[1], d.y ? k.b : k.a, 3)); lineEq(P, w[0], w[1], c0, k.ink, 2.2, [6, 4]); });
      legend(P, [["class 0", k.a, null, "dot"], ["class 1", k.b, null, "dot"], ["LDA boundary (straight)", k.ink, [6, 4]], [`shading: ${shadeBy} prediction`, k.muted, null, "box"]], "right");
      const er = (f) => te.filter((d) => f(d.x) !== d.y).length / te.length;
      out.innerHTML = `Test error: LDA <b>${(100 * er(lda)).toFixed(1)}%</b>, QDA <b>${(100 * er(qda)).toFixed(1)}%</b>. ` +
        `LDA assumes both classes have the same covariance, so its boundary is a straight line; QDA estimates one covariance per class and its boundary curves. ` +
        (t < 0.2 ? "With equal spreads they agree, and LDA, with fewer parameters, is the safer choice." : "With different spreads the curved QDA boundary wraps around the tighter class and wins.");
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "difference between the class spreads", 0, 1, 0.05, t, (v) => v.toFixed(2), (v) => { t = v; make(); draw(); });
    choose(c, "shade by", ["QDA", "LDA"], shadeBy, (v) => { shadeBy = v; draw(); });
    make(); draw(); return draw;
  };

  // 57. Local regression: a weighted straight line around each target point
  W.loess = (box) => {
    const r = rng(57), f = (h) => 30 + 10 * Math.sin((h - 9) / 24 * 2 * Math.PI) + 8 * Math.exp(-((h - 19) ** 2) / 6), D = [];
    for (let i = 0; i < 90; i++) { const h = 24 * r(); D.push([h, f(h) + 3.5 * r.normal()]); }
    let span = 0.3, x0 = 12;
    const local = (x, wantW) => {
      const q = Math.max(3, Math.round(span * D.length)), dist = D.map((p) => Math.abs(p[0] - x)), h = dist.slice().sort((a, b) => a - b)[q - 1] + 1e-9;
      const w = dist.map((d) => (d < h ? (1 - (d / h) ** 3) ** 3 : 0));
      let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0; D.forEach((p, i) => { sw += w[i]; sx += w[i] * p[0]; sy += w[i] * p[1]; sxx += w[i] * p[0] * p[0]; sxy += w[i] * p[0] * p[1]; });
      const b = (sw * sxy - sx * sy) / (sw * sxx - sx * sx || 1e-9), a = (sy - b * sx) / sw;
      return wantW ? { a, b, w, h } : a + b * x;
    };
    const P = plot(box, [0, 24], [5, 60], { ratio: 0.5, maxWidth: 700 });
    const out = readout(box);
    const draw = () => {
      const k = C(), L = local(x0, true), g = []; for (let x = 0; x <= 24; x += 0.1) g.push([x, local(x)]);
      P.clear(); P.axes("hour of day", "demand (kW)", ticks(0, 24, 4), ticks(10, 60, 5));
      const c = P.ctx; c.fillStyle = rgba(k.g, 0.08); c.fillRect(P.X(Math.max(0, x0 - L.h)), P.Y(60), P.X(Math.min(24, x0 + L.h)) - P.X(Math.max(0, x0 - L.h)), P.Y(5) - P.Y(60));
      P.clip(() => {
        D.forEach((p, i) => P.dot(p[0], p[1], L.w[i] > 0 ? rgba(k.a, 0.25 + 0.75 * L.w[i]) : rgba(k.muted, 0.35), 2 + 3 * L.w[i]));
        P.line(g, k.r, 2.4);
        P.line([x0 - L.h * 0.7, x0 + L.h * 0.7].map((x) => [x, L.a + L.b * x]), k.g, 2.6); P.dot(x0, L.a + L.b * x0, k.g, 6);
      });
      legend(P, [["data (size = weight at the target)", k.a, null, "dot"], ["local straight line at the target", k.g], ["local regression curve", k.r]], "left");
      out.innerHTML = `Target hour ${x0.toFixed(1)}: a straight line is fitted to the nearest ${Math.round(span * 100)}% of the points (the green band), ` +
        `weighting each by how close it is; its value at the target, <b>${(L.a + L.b * x0).toFixed(1)} kW</b>, is one point of the red curve. Repeating this at every hour traces the curve. ` +
        `A small span follows the noise; a large span flattens the evening peak. The span is chosen by cross-validation.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "span s (share of data used)", 0.08, 1, 0.01, span, (v) => v.toFixed(2), (v) => { span = v; draw(); });
    slider(c, "target hour", 0, 24, 0.1, x0, (v) => v.toFixed(1), (v) => { x0 = v; draw(); });
    draw(); return draw;
  };

  // 58. A kernel classifier with the radial kernel: γ sets the reach of each point, λ the smoothing
  W.rbf = (box) => {
    const tr = moons(58, 90, 0.22), te = moons(59, 400, 0.22);
    let lg = 0.3, ll = -2, f = null;
    const fit = () => {
      const gam = Math.pow(10, lg), lam = Math.pow(10, ll), n = tr.length, K = tr.map((a) => tr.map((b) => Math.exp(-gam * ((a.x[0] - b.x[0]) ** 2 + (a.x[1] - b.x[1]) ** 2))));
      const A = K.map((row, i) => row.map((v, j) => v + (i === j ? n * lam : 0))), al = solveLin(A, tr.map((d) => (d.y ? 1 : -1)));
      f = (x) => tr.reduce((s, d, i) => s + al[i] * Math.exp(-gam * ((x[0] - d.x[0]) ** 2 + (x[1] - d.x[1]) ** 2)), 0);
    };
    const P = plot(box, [-1.6, 2.6], [-1.2, 1.6], { ratio: 0.62, maxWidth: 640 });
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); regions(P, (x) => f(x) > 0, 84, 52);
      P.axes("x₁", "x₂", ticks(-1.5, 2.5, 4), ticks(-1, 1.5, 5));
      P.clip(() => tr.forEach((d) => P.dot(d.x[0], d.x[1], d.y ? k.b : k.a, 3.4)));
      legend(P, [["class −1", k.a, null, "dot"], ["class +1", k.b, null, "dot"]], "bottom-left");
      const acc = (D) => D.filter((d) => (f(d.x) > 0) === !!d.y).length / D.length;
      out.innerHTML = `γ = ${Math.pow(10, lg).toPrecision(2)}, λ = ${Math.pow(10, ll).toPrecision(2)}: training accuracy <b>${(100 * acc(tr)).toFixed(0)}%</b>, test accuracy <b>${(100 * acc(te)).toFixed(1)}%</b>. ` +
        `f(x) = Σ αᵢ K(x, xᵢ) with K(x, xᵢ) = exp(−γ‖x − xᵢ‖²): each training point spreads its influence over a distance of about 1/√γ. ` +
        `Large γ and small λ give islands around single points (overfitting); small γ or large λ give a boundary that is almost straight.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "γ (log₁₀)", -1, 2, 0.05, lg, (v) => "γ = " + Math.pow(10, v).toPrecision(2), (v) => { lg = v; fit(); draw(); });
    slider(c, "smoothing λ (log₁₀)", -5, 0, 0.1, ll, (v) => "λ = " + Math.pow(10, v).toPrecision(2), (v) => { ll = v; fit(); draw(); });
    fit(); draw(); return draw;
  };

  // 59. More than two classes: one-versus-rest and one-versus-one
  W.multiclass = (box) => {
    const r = rng(59), D = [], M = [[-1.4, -0.6], [1.4, -0.8], [0, 1.4]];
    M.forEach((m, y) => gauss2(r, 45, m, [[0.65, 0], [0.1, 0.65]]).forEach((x) => D.push({ x, y })));
    const train = (sel, pos) => {     // logistic regression of class pos against the rest of sel
      const S = D.filter((d) => sel.includes(d.y)); let b = [0, 0, 0];
      for (let it = 0; it < 600; it++) { const g = [0, 0, 0]; S.forEach((d) => { const e = 1 / (1 + Math.exp(-(b[0] + b[1] * d.x[0] + b[2] * d.x[1]))) - (d.y === pos ? 1 : 0); g[0] += e; g[1] += e * d.x[0]; g[2] += e * d.x[1]; }); b = b.map((v, j) => v - 0.5 * g[j] / S.length); }
      return b;
    };
    const ovr = [0, 1, 2].map((c) => train([0, 1, 2], c)), ovo = [[0, 1], [0, 2], [1, 2]].map(([a, c]) => ({ a, c, b: train([a, c], a) }));
    const lin = (b, x) => b[0] + b[1] * x[0] + b[2] * x[1];
    const predOvr = (x) => { const s = ovr.map((b) => lin(b, x)); return s.indexOf(Math.max(...s)); };
    const predOvo = (x) => { const v = [0, 0, 0]; ovo.forEach((o) => { v[lin(o.b, x) > 0 ? o.a : o.c]++; }); const m = Math.max(...v); return v.indexOf(m); };
    const MODES = ["one-versus-rest", "one-versus-one"];
    let mode = MODES[0], show = 0, pt = [0.2, 0];
    const P = plot(box, [-3.5, 3.5], [-2.8, 3.2], { ratio: 0.72, maxWidth: 620 });
    const out = readout(box);
    const draw = () => {
      const k = C(), col = [k.a, k.b, k.g], pred = mode === MODES[0] ? predOvr : predOvo;
      P.clear(); const c = P.ctx, nx = 70, ny = 60, cw = (P.X(3.5) - P.X(-3.5)) / nx, ch = (P.Y(-2.8) - P.Y(3.2)) / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { c.fillStyle = rgba(col[pred([-3.5 + (i + 0.5) * 7 / nx, 3.2 - (j + 0.5) * 6 / ny])], 0.16); c.fillRect(P.X(-3.5) + i * cw, P.Y(3.2) + j * ch, cw + 0.6, ch + 0.6); }
      P.axes("x₁", "x₂", ticks(-3, 3, 6), ticks(-2, 3, 5));
      P.clip(() => {
        D.forEach((d) => P.dot(d.x[0], d.x[1], col[d.y], 3.4));
        if (mode === MODES[0]) { const b = ovr[show]; lineEq(P, b[1], b[2], b[0], col[show], 2.6, [6, 4]); }
        else { const o = ovo[show]; lineEq(P, o.b[1], o.b[2], o.b[0], k.ink, 2.6, [6, 4]); }
        P.dot(pt[0], pt[1], k.ink, 6); ring(P, pt[0], pt[1], k.bg, 6, 2);
      });
      const names = ["class 1", "class 2", "class 3"];
      legend(P, [...names.map((n, i) => [n, col[i], null, "dot"]), [mode === MODES[0] ? `${names[show]} versus the rest` : `${names[ovo[show].a]} versus ${names[ovo[show].c]}`, mode === MODES[0] ? col[show] : k.ink, [6, 4]]], "right");
      const txt = mode === MODES[0] ? `Scores of the clicked point: ${ovr.map((b, i) => `${names[i]} ${lin(b, pt).toFixed(2)}`).join(", ")} → <b>${names[predOvr(pt)]}</b> (the largest score). K classes need K classifiers, each trained on all the data.` :
        `Votes for the clicked point: ${ovo.map((o) => `${names[o.a]} v ${names[o.c]} → ${names[lin(o.b, pt) > 0 ? o.a : o.c]}`).join("; ")} → <b>${names[predOvo(pt)]}</b>. K classes need K(K − 1)/2 classifiers, each trained on two classes only.`;
      out.innerHTML = txt;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "method", MODES, mode, (v) => { mode = v; draw(); });
    slider(c, "show classifier number", 1, 3, 1, 1, (v) => v.toFixed(0), (v) => { show = v - 1; draw(); });
    P.cv.addEventListener("click", (e) => { const rc = P.cv.getBoundingClientRect(); pt = [P.invX(e.clientX - rc.left), P.invY(e.clientY - rc.top)]; draw(); });
    el("div", { class: "mlw-hint" }, box, "Click anywhere to classify a new sample and see the scores or votes behind the decision.");
    draw(); return draw;
  };

  // 60. A hyperplane in two dimensions: β₀ + β₁x₁ + β₂x₂ = 0, the sign of f(x) and the distance to the line
  W.hyperplane = (box) => {
    const r = rng(60), D = [];
    gauss2(r, 25, [-1.1, -0.8], [[0.5, 0], [0.1, 0.5]]).forEach((x) => D.push({ x, y: -1 })); gauss2(r, 25, [1.1, 0.9], [[0.5, 0], [0.1, 0.5]]).forEach((x) => D.push({ x, y: 1 }));
    let th = 60, b0 = 0, sc = 1, pt = [1.2, -1.4];
    const P = plot(box, [-3, 3], [-2.5, 2.5], { ratio: 0.72, maxWidth: 600 });
    const out = readout(box);
    const draw = () => {
      const k = C(), w = [sc * Math.cos(th * Math.PI / 180), sc * Math.sin(th * Math.PI / 180)], B0 = sc * b0, f = (x) => B0 + w[0] * x[0] + w[1] * x[1];
      P.clear(); regions(P, (x) => f(x) > 0, 72, 60);
      P.axes("density (standardised)", "conductivity (standardised)", ticks(-3, 3, 6), ticks(-2, 2, 4));
      P.clip(() => {
        lineEq(P, w[0], w[1], B0, k.ink, 2.6);
        const n = Math.hypot(w[0], w[1]), foot0 = [-B0 * w[0] / (n * n), -B0 * w[1] / (n * n)], c = P.ctx;
        const tip = [foot0[0] + w[0] / n, foot0[1] + w[1] / n]; P.line([foot0, tip], k.r, 2.4);
        const ang = Math.atan2(P.Y(tip[1]) - P.Y(foot0[1]), P.X(tip[0]) - P.X(foot0[0])); c.fillStyle = k.r; c.beginPath(); c.moveTo(P.X(tip[0]), P.Y(tip[1])); c.lineTo(P.X(tip[0]) - 10 * Math.cos(ang - 0.4), P.Y(tip[1]) - 10 * Math.sin(ang - 0.4)); c.lineTo(P.X(tip[0]) - 10 * Math.cos(ang + 0.4), P.Y(tip[1]) - 10 * Math.sin(ang + 0.4)); c.fill();
        P.text("β", P.X(tip[0]) + 8, P.Y(tip[1]) - 8, k.r);
        D.forEach((d) => P.dot(d.x[0], d.x[1], d.y > 0 ? k.b : k.a, 3.6));
        const fp = f(pt), ft = [pt[0] - fp * w[0] / (n * n), pt[1] - fp * w[1] / (n * n)];
        P.line([pt, ft], k.g, 2, [4, 3]); P.dot(pt[0], pt[1], k.ink, 6);
      });
      legend(P, [["pure (y = −1)", k.a, null, "dot"], ["adulterated (y = +1)", k.b, null, "dot"], ["hyperplane f(x) = 0", k.ink], ["β: points to f > 0", k.r], ["distance of the clicked point", k.g, [4, 3]]], "bottom-right");
      const fp = f(pt), n = Math.hypot(w[0], w[1]), wrong = D.filter((d) => d.y * f(d.x) <= 0).length;
      out.innerHTML = `f(x) = ${B0.toFixed(2)} + ${w[0].toFixed(2)}·x₁ + ${w[1].toFixed(2)}·x₂ (‖β‖ = ${n.toFixed(2)}). Clicked point: f = <b>${fp.toFixed(2)}</b>, ` +
        `so it is on the ${fp > 0 ? "orange (f > 0)" : "blue (f < 0)"} side, at distance |f| / ‖β‖ = <b>${(Math.abs(fp) / n).toFixed(2)}</b>. Misclassified samples: <b>${wrong}</b>. ` +
        `Scaling all the coefficients changes f but not the line or the distance: that is why the margin problem fixes ‖β‖ = 1.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    slider(c, "direction of β (degrees)", 0, 359, 1, th, (v) => v.toFixed(0) + "°", (v) => { th = v; draw(); });
    slider(c, "offset β₀", -2.5, 2.5, 0.05, b0, (v) => v.toFixed(2), (v) => { b0 = v; draw(); });
    slider(c, "scale all coefficients by", 0.3, 3, 0.05, sc, (v) => "× " + v.toFixed(2), (v) => { sc = v; draw(); });
    P.cv.addEventListener("click", (e) => { const rc = P.cv.getBoundingClientRect(); pt = [P.invX(e.clientX - rc.left), P.invY(e.clientY - rc.top)]; draw(); });
    el("div", { class: "mlw-hint" }, box, "Click anywhere to place a test point.");
    draw(); return draw;
  };

  // 61. Pooling: shrink a feature map by keeping the largest (or average) value in each window
  W.pooling = (box) => {
    const N = 8, r = rng(61), base = [];
    for (let i = 0; i < N + 1; i++) { base.push([]); for (let j = 0; j < N + 1; j++) base[i].push(Math.max(0, Math.round(9 * Math.exp(-(((i - 2.5) ** 2) + (j - 5) ** 2) / 4) + 7 * Math.exp(-(((i - 6) ** 2) + (j - 2) ** 2) / 3) + 2 * r()))); }
    const MODES = ["max pooling", "average pooling"];
    let mode = MODES[0], shift = false, sel = [0, 2];
    const cv = el("canvas", { class: "mlw-canvas" }, box);
    const out = readout(box);
    const fm = (s) => Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => base[i][j + (s ? 0 : 1)]));
    const pool = (F) => Array.from({ length: N / 2 }, (_, a) => Array.from({ length: N / 2 }, (_, b) => { const v = [F[2 * a][2 * b], F[2 * a][2 * b + 1], F[2 * a + 1][2 * b], F[2 * a + 1][2 * b + 1]]; return mode === MODES[0] ? Math.max(...v) : v.reduce((p, q) => p + q, 0) / 4; }));
    let geom = {};
    const draw = () => {
      const k = C(), w = Math.min(box.clientWidth || 640, 640), cs = Math.floor(Math.min(36, (w - 120) / 12)), h = N * cs + 40, d = window.devicePixelRatio || 1;
      cv.width = w * d; cv.height = h * d; cv.style.width = w + "px"; cv.style.height = h + "px";
      const c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
      const F = fm(shift), Pm = pool(F), P0 = pool(fm(false)), x0 = 10, x1 = x0 + N * cs + 60, y0 = 26;
      geom = { x0, x1, y0, cs };
      const cell = (x, y, s, v, vmax, hl) => { c.fillStyle = rgba(k.a, 0.08 + 0.75 * v / vmax); c.fillRect(x, y, s - 1, s - 1); if (hl) { c.strokeStyle = k.r; c.lineWidth = 2.5; c.strokeRect(x + 1, y + 1, s - 3, s - 3); } c.fillStyle = v / vmax > 0.55 ? "#fff" : k.ink; c.font = `${Math.round(s * 0.36)}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(mode === MODES[1] && s > cs ? v.toFixed(1) : String(v), x + s / 2, y + s / 2); };
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) cell(x0 + j * cs, y0 + i * cs, cs, F[i][j], 10, Math.floor(i / 2) === sel[0] && Math.floor(j / 2) === sel[1]);
      for (let i = 0; i <= N; i += 2) { c.strokeStyle = k.muted; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0 + i * cs); c.lineTo(x0 + N * cs, y0 + i * cs); c.moveTo(x0 + i * cs, y0); c.lineTo(x0 + i * cs, y0 + N * cs); c.stroke(); }
      let changed = 0;
      for (let a = 0; a < N / 2; a++) for (let b = 0; b < N / 2; b++) { cell(x1 + b * 2 * cs, y0 + a * 2 * cs, 2 * cs, Pm[a][b], 10, a === sel[0] && b === sel[1]); if (Pm[a][b] !== P0[a][b]) changed++; }
      c.fillStyle = k.ink; c.font = "13px sans-serif"; c.textAlign = "left"; c.textBaseline = "alphabetic";
      c.fillText(`feature map ${N} × ${N}${shift ? " (shifted 1 pixel)" : ""}`, x0, 16); c.fillText(`after ${mode}: ${N / 2} × ${N / 2}`, x1, 16);
      c.fillStyle = k.r; c.font = "22px sans-serif"; c.fillText("→", x0 + N * cs + 18, y0 + N * cs / 2);
      const F2 = F, a = sel[0], b = sel[1], v = [F2[2 * a][2 * b], F2[2 * a][2 * b + 1], F2[2 * a + 1][2 * b], F2[2 * a + 1][2 * b + 1]];
      out.innerHTML = `Window (${a + 1}, ${b + 1}) holds ${v.join(", ")} → ${mode === MODES[0] ? `largest = <b>${Math.max(...v)}</b>` : `average = <b>${(v.reduce((p, q) => p + q, 0) / 4).toFixed(2)}</b>`}. ` +
        `Each 2 × 2 window becomes one number, so the map shrinks to a quarter and the next layer sees a wider area. ` +
        (shift ? `After shifting the image by one pixel, ${changed} of the 16 pooled values changed${mode === MODES[0] ? ": max pooling keeps a strong feature as long as it stays inside the window" : ""}.` : "Tick the shift box to move the image one pixel and see how many pooled values change.");
    };
    cv.addEventListener("click", (e) => {
      const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top, g = geom;
      let i = Math.floor((y - g.y0) / g.cs), j = x < g.x1 ? Math.floor((x - g.x0) / g.cs) : Math.floor((x - g.x1) / g.cs);
      if (i >= 0 && i < N && j >= 0 && j < N) { sel = [Math.floor(i / 2), Math.floor(j / 2)]; draw(); }
    });
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "pooling", MODES, mode, (v) => { mode = v; draw(); });
    checkbox(c, "shift the image by one pixel", shift, (v) => { shift = v; draw(); });
    el("div", { class: "mlw-hint" }, box, "Click any cell to see which window it belongs to.");
    draw(); return draw;
  };

  // 62. Forecasting the next hour: naive rules versus an autoregressive model fitted by least squares
  W.forecast = (box) => {
    const r = rng(62), H = 24 * 21, y = []; let e = 0;
    for (let t = 0; t < H; t++) { const h = t % 24, day = Math.floor(t / 24); e = 0.75 * e + 1.6 * r.normal(); y.push(30 + 10 * Math.sin((h - 9) / 24 * 2 * Math.PI) + 7 * Math.exp(-((h - 19) ** 2) / 5) - (day % 7 >= 5 ? 6 : 0) + e); }
    const TR = 24 * 14, LAGS = [1, 2, 24], rows = [], ys = [];
    for (let t = 24; t < TR; t++) { rows.push([1, ...LAGS.map((l) => y[t - l])]); ys.push(y[t]); }
    const w = lsq(rows, ys);
    const M = { "same hour yesterday": (t) => y[t - 24], "last hour's value": (t) => y[t - 1], "AR model: lags 1, 2 and 24": (t) => w[0] + LAGS.reduce((s, l, i) => s + w[i + 1] * y[t - l], 0) };
    const names = Object.keys(M);
    let m = names[2], days = 4;
    const P = plot(box, [0, 96], [5, 60], { ratio: 0.42, maxWidth: 700 });
    const out = readout(box);
    const rmse = (f) => { let s = 0, n = 0; for (let t = TR; t < H; t++) { s += (y[t] - f(t)) ** 2; n++; } return Math.sqrt(s / n); };
    const draw = () => {
      const k = C(), T0 = H - 24 * days; P.xr = [0, 24 * days];
      P.clear(); P.axes("hour of the test period", "demand (kW)", ticks(0, 24 * days, days), ticks(10, 60, 5));
      P.clip(() => { const a = [], b = []; for (let t = T0; t < H; t++) { a.push([t - T0, y[t]]); b.push([t - T0, M[m](t)]); } P.line(a, k.ink, 1.8); P.line(b, k.r, 2, [5, 3]); });
      legend(P, [["actual", k.ink], [`forecast: ${m}`, k.r, [5, 3]]], "right");
      out.innerHTML = `One-hour-ahead forecasts on the last 7 days (not used for fitting). RMSE: ${names.map((n) => `${n} <b>${rmse(M[n]).toFixed(2)}</b> kW`).join(" · ")}. ` +
        `The AR model is ŷ<sub>t</sub> = ${w[0].toFixed(1)} + ${w[1].toFixed(2)}·y<sub>t−1</sub> ${w[2] < 0 ? "−" : "+"} ${Math.abs(w[2]).toFixed(2)}·y<sub>t−2</sub> + ${w[3].toFixed(2)}·y<sub>t−24</sub>, fitted by least squares on the first 14 days. ` +
        `Always compare a network with simple rules like these: a forecast is worth having only if it beats them.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "forecast", names, m, (v) => { m = v; draw(); });
    slider(c, "days shown", 1, 7, 1, days, (v) => v.toFixed(0), (v) => { days = v; draw(); });
    draw(); return draw;
  };

  // 63. Hierarchical clustering: merge the closest groups, then cut the tree
  W.dendrogram = (box) => {
    const r = rng(63), pts = [];
    [[1, 1.2, 6], [3.6, 3.2, 5], [4.2, 0.8, 5], [1.5, 3.8, 2]].forEach(([a, b, n]) => { for (let i = 0; i < n; i++) pts.push([a + 1.1 * (r() - 0.5), b + 1.1 * (r() - 0.5)]); });
    const LINKS = ["complete", "average", "single"];
    let link = LINKS[0], cut = 2, tree;
    const build = () => {
      let cl = pts.map((_, i) => ({ id: i, m: [i], h: 0 })); const merges = [], d = (a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
      const D = (A, B) => { const v = []; A.m.forEach((a) => B.m.forEach((b) => v.push(d(a, b)))); return link === "single" ? Math.min(...v) : link === "complete" ? Math.max(...v) : v.reduce((s, q) => s + q, 0) / v.length; };
      let next = pts.length;
      while (cl.length > 1) {
        let bi = 0, bj = 1, bd = Infinity; for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) { const q = D(cl[i], cl[j]); if (q < bd) { bd = q; bi = i; bj = j; } }
        const n = { id: next++, m: cl[bi].m.concat(cl[bj].m), h: bd, l: cl[bi], r: cl[bj] }; merges.push(n); cl = cl.filter((_, q) => q !== bi && q !== bj).concat([n]);
      }
      const root = cl[0], order = []; const walk = (n) => { if (n.l) { walk(n.l); walk(n.r); } else order.push(n.id); }; walk(root);
      tree = { root, order, hmax: root.h };
    };
    const labels = () => { const lab = new Array(pts.length).fill(0); let c = 0; const walk = (n) => { if (!n.l || n.h <= cut) { n.m.forEach((i) => { lab[i] = c; }); c++; } else { walk(n.l); walk(n.r); } }; walk(tree.root); return { lab, k: c }; };
    const wrap = el("div", { class: "mlw-pair" }, box), L = el("div", {}, wrap), R = el("div", {}, wrap);
    const P = plot(L, [-0.5, 5.5], [-0.5, 5], { ratio: 0.85, maxWidth: 340 }), Q = plot(R, [0, 1], [0, 1], { ratio: 0.85, maxWidth: 420 });
    const out = readout(box);
    const draw = () => {
      const k = C(), { lab, k: K } = labels(), col = PAL(k);
      P.clear(); P.axes("x₁", "x₂", ticks(0, 5, 5), ticks(0, 5, 5));
      P.clip(() => pts.forEach((p, i) => { P.dot(p[0], p[1], col[lab[i] % col.length], 5); }));
      Q.xr = [-0.5, pts.length - 0.5]; Q.yr = [0, tree.hmax * 1.08];
      Q.clear(); Q.axes("samples", "merge height", [], ticks(0, Math.floor(tree.hmax), Math.max(1, Math.floor(tree.hmax))));
      const pos = {}; tree.order.forEach((id, i) => { pos[id] = i; });
      const xy = (n) => (n.l ? [(xy(n.l)[0] + xy(n.r)[0]) / 2, n.h] : [pos[n.id], 0]);
      const drawN = (n) => { if (!n.l) return; const a = xy(n.l), b = xy(n.r), cc = n.h <= cut ? col[lab[n.m[0]] % col.length] : k.muted; Q.line([[a[0], a[1]], [a[0], n.h], [b[0], n.h], [b[0], b[1]]], cc, 1.8); drawN(n.l); drawN(n.r); };
      drawN(tree.root);
      Q.line([[-0.5, cut], [pts.length - 0.5, cut]], k.r, 2, [6, 4]); Q.text(`cut → ${K} clusters`, Q.w - Q.pad.r - 4, Q.Y(cut) - 9, k.r, "right");
      out.innerHTML = `${link} linkage, cut at height ${cut.toFixed(2)} → <b>${K} clusters</b>. Starting with every sample on its own, the two closest groups are merged again and again; the height of each join is the distance between the groups. ` +
        `Cutting the tree at one height gives the clusters, so one tree gives every number of clusters. Single linkage tends to chain samples into long straggly clusters; complete linkage gives compact ones.`;
    };
    const c = el("div", { class: "mlw-controls" }, box);
    choose(c, "linkage", LINKS, link, (v) => { link = v; build(); draw(); });
    slider(c, "cut height", 0.05, 6, 0.05, cut, (v) => v.toFixed(2), (v) => { cut = v; draw(); });
    build(); draw(); return draw;
  };

  function start() {
    document.querySelectorAll(".ml-widget[data-widget]").forEach((box) => {
      const name = box.dataset.widget;
      if (!W[name] || box.dataset.ready) return;
      box.dataset.ready = "1";
      const opts = {};
      for (const k in box.dataset) if (k !== "widget" && k !== "ready") opts[k] = isNaN(+box.dataset[k]) ? box.dataset[k] : +box.dataset[k];
      const body = el("div", { class: "mlw-body" }, box);
      try {
        const redraw = W[name](body, opts);
        if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
      } catch (e) { body.textContent = "This interactive figure could not start: " + e.message; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
