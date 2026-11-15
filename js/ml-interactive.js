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
      Q.text("training", Q.X(8.5), Q.Y(0.08), k.a); Q.text("test", Q.X(8.5), Q.Y(0.9), k.r);
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
    const P = plot(box, [-2, 10], [0, 0.3], { ratio: 0.55 });
    let t = 1;
    const out = readout(box);
    const draw = () => {
      const k = C(); P.clear(); P.axes("vibration level", "Gini gain of the cut", ticks(-2, 10, 6), [0, 0.1, 0.2, 0.3]);
      const g = []; for (let x = -2; x <= 10; x += 0.02) g.push([x, gain(x)]);
      P.clip(() => {
        P.line(g, k.muted, 2);
        X.forEach(([x, l], i) => P.dot(x, 0.012 + (l ? 0.03 : 0) + 0.004 * (i % 4), l ? k.a : k.b, 3.5));
        P.line([[t, 0], [t, 0.3]], k.r, 2, [5, 4]);
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
        [[15, k.a], [35, k.b], [55, k.r]].forEach(([t, col]) => { P.line([[0, 0], [1000, model(1000, t)]], col, 1.6, [5, 4]); P.text(`${t} °C`, P.X(1000) - 4, P.Y(model(1000, t)) - 8, col, "right"); });
        data.forEach(([g, t, p]) => P.dot(g, p, k.muted, 3));
        P.dot(G, model(G, T), k.g, 8);
      });
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
    draw(); return draw;
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
    const P = plot(box, [-0.2, 1.6], [0, 4.5], { ratio: 0.45 });
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
      P.clip(() => { P.line(c0, k.a, 2.4); P.line(c1, k.b, 2.4); X.forEach((x, i) => P.dot(x, 0.12 + 0.1 * (i % 3), resp ? (resp[i] > 0.5 ? k.a : k.b) : k.muted, 2.6)); });
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
