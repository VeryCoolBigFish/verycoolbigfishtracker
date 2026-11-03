// Plain SVG charts (REQ I-01, I-04): combined timeline with cycle phase shading, single-series line with bands,
// horizontal bars, and the pelvic-pain cycle-day strip. Colours come from CSS classes so light and dark themes both work.
const Charts = (() => {
  const { h, s } = U;
  // The SVG is drawn at about the width it is shown at, so text keeps its real size on a phone.
  const width = () => Math.round(U.clamp((document.getElementById('view')?.clientWidth || innerWidth) - 40, 280, 760));
  const svgX = (e, svg, W) => { const r = svg.getBoundingClientRect(); return (e.clientX - r.left) * W / r.width; };
  const svgY = (e, svg, H) => { const r = svg.getBoundingClientRect(); return (e.clientY - r.top) * H / r.height; };

  function frame(cls, caption) {
    const fig = h('figure', { class: 'chart ' + (cls || '') }, caption ? h('figcaption', {}, caption) : null);
    const tip = h('div', { class: 'chart-tip', role: 'status', hidden: true });
    fig.append(tip);
    return { fig, tip };
  }
  function showTip(fig, tip, e, content) {
    tip.replaceChildren(...content.filter(Boolean));
    tip.hidden = false;
    const fr = fig.getBoundingClientRect();
    const px = e.clientX - fr.left, py = e.clientY - fr.top;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = px + 14;
    if (left + tw > fr.width - 4) left = px - tw - 14;
    tip.style.left = Math.max(4, left) + 'px';
    tip.style.top = U.clamp(py - th - 8, 0, Math.max(0, fr.height - th)) + 'px';
  }
  const hideTip = tip => { tip.hidden = true; };
  // Mouse leaves hide the tooltip; on touch it stays until the next tap.
  function hover(svg, fig, tip, onMove, onHide) {
    const move = e => onMove(e);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hideTip(tip); onHide && onHide(); } });
  }
  function tableToggle(fig, build) {
    let wrap = null;
    const btn = h('button', { type: 'button', class: 'link small table-toggle', 'aria-expanded': 'false', onclick: () => {
      if (wrap) { wrap.remove(); wrap = null; btn.textContent = 'Show table'; btn.setAttribute('aria-expanded', 'false'); return; }
      wrap = h('div', { class: 'tablewrap chart-table' }, build());
      fig.append(wrap); btn.textContent = 'Hide table'; btn.setAttribute('aria-expanded', 'true');
    } }, 'Show table');
    return btn;
  }
  const table = (head, rows) => h('table', {}, h('thead', {}, h('tr', {}, head.map(c => h('th', {}, c)))),
    h('tbody', {}, rows.map(r => h('tr', {}, r.map((c, i) => i ? h('td', {}, c ?? '–') : h('th', {}, c))))));
  const key = (cls, label) => h('span', { class: 'key' }, h('i', { class: 'sw ' + cls }), label);

  // Spread direct labels so they never overlap (min gap in px), keeping their order.
  function spread(items, gap, lo, hi) {
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
    const over = items.length ? items[items.length - 1].y - hi : 0;
    if (over > 0) for (const it of items) it.y = Math.max(lo, it.y - over);
    return items;
  }

  // --- combined daily timeline, 0–10 scale ---
  function timeline({ rows, cyc, series }) {
    const { fig, tip } = frame('timeline');
    const n = rows.length;
    const has = n && (series.some(se => rows.some(r => r[se.key] != null)) || rows.some(r => r.panics));
    if (!has) { fig.append(UI.empty('Nothing logged in this range yet.')); return fig; }
    const shade = !!cyc && M.settings().modules.cycle;
    const W = width(), direct = W >= 420, H = 214, L = 28, R = direct ? 78 : 10, T = 10, PB = 20, B = 22;
    const pw = W - L - R, ph = H - T - PB - B, cw = pw / n;
    const X = i => L + (i + 0.5) * cw, Y = v => T + ph * (1 - v / 10);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img',
      'aria-label': `Daily ${series.map(se => se.label.toLowerCase()).join(', ')} and panic attacks from ${U.fmtDate(rows[0].date)} to ${U.fmtDate(rows[n - 1].date)}` });

    // Cycle phase shading behind everything (follicular days stay plain).
    const phases = shade ? rows.map(r => Cycle.phase(cyc, r.date)) : [];
    const seen = new Set();
    if (shade) {
      let run = null;
      const runs = [];
      phases.forEach((p, i) => {
        const k = p && p.phase !== 'follicular' ? p.phase : null;
        if (run && run.k === k) run.end = i; else runs.push(run = { k, start: i, end: i });
      });
      for (const r of runs) if (r.k) {
        seen.add(r.k);
        svg.append(s('rect', { x: L + r.start * cw, y: T, width: (r.end - r.start + 1) * cw, height: ph, class: 'ph ph-' + (r.k === 'ovulatory' ? 'ovu' : r.k) }));
      }
    }
    for (const v of [0, 5, 10]) svg.append(
      s('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), class: v ? 'grid' : 'axis' }),
      s('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'yl' }, v));

    // Series: lines break at missing days; dots on every point for short ranges, on isolated points otherwise.
    for (const se of series) {
      let d = '', pen = false;
      rows.forEach((r, i) => { const v = r[se.key]; if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
      if (d) svg.append(s('path', { d, class: 'line ' + se.cls }));
      rows.forEach((r, i) => {
        const v = r[se.key];
        if (v == null) return;
        const lone = rows[i - 1]?.[se.key] == null && rows[i + 1]?.[se.key] == null;
        if (n <= 45 || lone) svg.append(s('circle', { cx: X(i), cy: Y(v), r: 4, class: 'dot ' + se.cls }));
      });
    }

    // Panic attacks as ticks in their own row under the plot.
    const py = T + ph + 5;
    svg.append(s('text', { x: L - 6, y: py + 10, 'text-anchor': 'end', class: 'yl small' }, 'Panic'));
    rows.forEach((r, i) => {
      if (!r.panics) return;
      const w = U.clamp(cw * 0.6, 3, 10);
      svg.append(s('rect', { x: X(i) - w / 2, y: py, width: w, height: 12, rx: 2, class: 'panic-tick' }));
      if (r.panics > 1 && cw >= 14) svg.append(s('text', { x: X(i), y: py - 2, 'text-anchor': 'middle', class: 'yl small' }, r.panics));
    });

    // Date labels, about one per 70 px.
    const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 70))));
    rows.forEach((r, i) => { if (i % step === 0) svg.append(s('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', class: 'xl' }, U.fmtDate(r.date))); });

    // Direct labels at each series' last point (wide screens only; the legend covers narrow ones).
    if (direct) {
      const labels = series.map(se => {
        let i = n - 1; while (i >= 0 && rows[i][se.key] == null) i--;
        return i < 0 ? null : { se, y: Y(rows[i][se.key]), x: X(i) };
      }).filter(Boolean);
      for (const it of spread(labels, 13, T + 4, T + ph)) svg.append(
        s('line', { x1: L + pw + 4, x2: L + pw + 12, y1: it.y, y2: it.y, class: 'line ' + it.se.cls }),
        s('text', { x: L + pw + 15, y: it.y + 4, class: 'dl' }, it.se.label));
    }

    // Hover layer: crosshair, highlighted values and a tooltip for the day under the pointer.
    const cross = s('line', { x1: 0, x2: 0, y1: T, y2: T + ph + PB, class: 'cross', visibility: 'hidden' });
    const hl = s('g', { class: 'hl' });
    svg.append(cross, hl, s('rect', { x: L, y: T, width: pw, height: ph + PB, class: 'hit' }));
    hover(svg, fig, tip, e => {
      const i = U.clamp(Math.floor((svgX(e, svg, W) - L) / cw), 0, n - 1), r = rows[i];
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
      hl.replaceChildren(...series.filter(se => r[se.key] != null).map(se => s('circle', { cx: X(i), cy: Y(r[se.key]), r: 5, class: 'dot ' + se.cls })));
      const p = phases[i];
      showTip(fig, tip, e, [h('b', {}, U.fmtDate(r.date, true)),
        p ? h('div', { class: 'muted' }, `Cycle day ${p.day} · ${Cycle.PHASES[p.phase]}`) : null,
        ...series.map(se => h('div', {}, h('i', { class: 'sw ' + se.cls }), `${se.label}: ${r[se.key] ?? '–'}`)),
        h('div', {}, h('i', { class: 'sw panic' }), `Panic attacks: ${r.panics}`)]);
    }, () => { cross.setAttribute('visibility', 'hidden'); hl.replaceChildren(); });

    const legend = h('div', { class: 'chart-legend' }, series.length >= 2 ? series.map(se => key(se.cls, se.label)) : null, key('panic', 'Panic attack'),
      seen.has('menstrual') ? key('ph-menstrual', 'Period') : null, seen.has('ovulatory') ? key('ph-ovu', 'Ovulation (est.)') : null, seen.has('luteal') ? key('ph-luteal', 'Luteal') : null);
    fig.append(legend, svg, tableToggle(fig, () => table(['Date', ...series.map(se => se.label), 'Panic'], rows.map(r => [U.fmtDate(r.date, true), ...series.map(se => r[se.key]), r.panics]))));
    return fig;
  }

  // --- single series over dates, with optional severity bands ---
  function line({ points, from, to, max, bands, label, cls = 's-sleep', unit = '' }) {
    const { fig, tip } = frame('line', label);
    const pts = (points || []).filter(p => p.value != null).sort((a, b) => a.date.localeCompare(b.date));
    if (!pts.length) { fig.append(UI.empty('Nothing logged in this range yet.')); return fig; }
    from = from || pts[0].date; to = to || pts[pts.length - 1].date;
    const span = Math.max(1, U.diffDays(to, from));
    max = max ?? Math.max(1, ...pts.map(p => p.value));
    const W = width(), H = 176, L = 32, R = 12, T = 10, B = 22;
    const pw = W - L - R, ph = H - T - B;
    const X = d => L + pw * U.clamp(U.diffDays(d, from) / span, 0, 1), Y = v => T + ph * (1 - U.clamp(v, 0, max) / max);
    const bandFor = v => { let b = null; for (const x of bands || []) if (v >= x.from) b = x; return b; };
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img', 'aria-label': `${label || 'Values'} from ${U.fmtDate(from)} to ${U.fmtDate(to)}` });

    if (bands && bands.length) {
      const bs = [...bands].sort((a, b) => a.from - b.from);
      bs.forEach((b, i) => {
        const hi = i + 1 < bs.length ? bs[i + 1].from : max;
        const y0 = Y(hi), y1 = Y(b.from);
        svg.append(s('rect', { x: L, y: y0, width: pw, height: Math.max(0, y1 - y0), class: 'band b' + (i % 2) }));
        if (y1 - y0 >= 13) svg.append(s('text', { x: L + pw - 4, y: y0 + 11, 'text-anchor': 'end', class: 'bl' }, b.label));
      });
    }
    const ticks = bands && bands.length ? [...new Set([...bands.map(b => b.from), max])] : [0, U.round(max / 2, 0), max];
    for (const v of ticks) svg.append(
      s('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), class: v ? 'grid' : 'axis' }),
      s('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'yl' }, v));
    const nx = Math.max(2, Math.min(6, Math.floor(pw / 80)));
    for (let k = 0; k <= nx; k++) {
      const d = U.addDays(from, Math.round(span * k / nx));
      svg.append(s('text', { x: X(d), y: H - 6, 'text-anchor': k === 0 ? 'start' : k === nx ? 'end' : 'middle', class: 'xl' }, U.fmtDate(d)));
    }
    if (pts.length > 1) svg.append(s('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(p.date).toFixed(1) + ' ' + Y(p.value).toFixed(1)).join(''), class: 'line ' + cls }));
    for (const p of pts) svg.append(s('circle', { cx: X(p.date), cy: Y(p.value), r: 4.5, class: 'dot ring ' + cls }));

    const hl = s('circle', { r: 6, class: 'dot ring ' + cls, visibility: 'hidden' });
    svg.append(hl, s('rect', { x: L, y: T, width: pw, height: ph, class: 'hit' }));
    hover(svg, fig, tip, e => {
      const x = svgX(e, svg, W);
      const p = pts.reduce((a, b) => Math.abs(X(b.date) - x) < Math.abs(X(a.date) - x) ? b : a);
      hl.setAttribute('cx', X(p.date)); hl.setAttribute('cy', Y(p.value)); hl.setAttribute('visibility', 'visible');
      const b = bandFor(p.value);
      showTip(fig, tip, e, [h('b', {}, U.fmtDate(p.date, true)), h('div', {}, `${p.value}${unit}`), b ? h('div', { class: 'muted' }, b.label) : null]);
    }, () => hl.setAttribute('visibility', 'hidden'));
    fig.append(svg, tableToggle(fig, () => table(['Date', label || 'Value'], pts.map(p => [U.fmtDate(p.date, true), `${p.value}${unit}` + (bandFor(p.value) ? ` (${bandFor(p.value).label})` : '')]))));
    return fig;
  }

  // --- horizontal bars (HTML, so labels wrap on small screens) ---
  function bars(rows, { max, unit = '', cls = 's-anx' } = {}) {
    const { fig, tip } = frame('bars');
    if (!rows || !rows.length) { fig.append(UI.empty('Nothing to show yet.')); return fig; }
    max = max ?? Math.max(1, ...rows.map(r => r.value));
    const list = h('div', { class: 'bar-list', role: 'list' }, rows.map(r => {
      const row = h('div', { class: 'bar-row', role: 'listitem', 'aria-label': `${r.label}: ${r.value}${unit ? ' ' + unit : ''}` },
        h('span', { class: 'bar-lbl' }, r.label),
        h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill ' + cls, style: { width: (U.clamp(r.value / max, 0, 1) * 100) + '%' } })),
        h('span', { class: 'bar-val' }, r.value + (unit ? ' ' + unit : '')));
      const show = e => showTip(fig, tip, e, [h('b', {}, r.label), h('div', {}, `${r.value}${unit ? ' ' + unit : ''}`), r.note ? h('div', { class: 'muted' }, r.note) : null]);
      row.addEventListener('pointerenter', show);
      row.addEventListener('pointerdown', show);
      row.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hideTip(tip); });
      return row;
    }));
    fig.append(list);
    return fig;
  }

  // --- pelvic pain by cycle day: one row per recent cycle ---
  function cycleStrip(cyc, painRecs) {
    const { fig, tip } = frame('strip');
    const all = cyc.periods;
    if (!all.length) { fig.append(UI.empty('Log your period to see pain by cycle day.')); return fig; }
    const pain = new Map();
    for (const r of painRecs || []) if (!r.deleted) pain.set(r.date, Math.max(pain.get(r.date) || 0, U.num(r.data.severity)));
    const rows = all.slice(-6).map(p => {
      const next = all[all.indexOf(p) + 1];
      const end = next ? U.addDays(next.start, -1) : U.today();
      return { start: p.start, pEnd: p.end, len: Math.min(60, U.diffDays(end, p.start) + 1) };
    }).filter(r => r.len > 0);
    const inRows = [...pain.keys()].some(d => rows.some(r => d >= r.start && U.diffDays(d, r.start) < r.len));
    if (!inRows) { fig.append(UI.empty('No pelvic pain logged in these cycles yet.')); return fig; }
    const D = Math.max(35, ...rows.map(r => r.len));
    const W = width(), L = 52, R = 6, T = 18, rh = 18, gapY = 3, H = T + rows.length * (rh + gapY) + 4;
    const cw = (W - L - R) / D, gap = cw > 6 ? 2 : 1;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img', 'aria-label': `Pelvic pain severity by cycle day for the last ${rows.length} cycles` });
    for (const d of [1, 7, 14, 21, 28, 35, 42, 49, 56]) if (d <= D) svg.append(s('text', { x: L + (d - 0.5) * cw, y: 12, 'text-anchor': 'middle', class: 'xl' }, d));
    rows.forEach((r, j) => {
      const y = T + j * (rh + gapY);
      svg.append(s('text', { x: L - 6, y: y + rh - 5, 'text-anchor': 'end', class: 'yl' }, U.fmtDate(r.start)));
      for (let day = 1; day <= r.len; day++) {
        const date = U.addDays(r.start, day - 1), v = pain.get(date);
        const q = v ? Math.min(5, Math.ceil(v / 2)) : 0;
        const x = L + (day - 1) * cw + gap / 2;
        svg.append(s('rect', { x, y, width: Math.max(1, cw - gap), height: rh, rx: Math.min(3, cw / 4), class: 'cell q' + q }));
        if (date <= r.pEnd) svg.append(s('rect', { x, y: y + rh - 3, width: Math.max(1, cw - gap), height: 3, class: 'pd' }));
      }
    });
    const hl = s('rect', { width: Math.max(1, cw - gap) + 2, height: rh + 2, rx: 3, class: 'cell-hl', visibility: 'hidden' });
    svg.append(hl, s('rect', { x: L, y: T, width: W - L - R, height: rows.length * (rh + gapY), class: 'hit' }));
    hover(svg, fig, tip, e => {
      const j = Math.floor((svgY(e, svg, H) - T) / (rh + gapY)), day = Math.floor((svgX(e, svg, W) - L) / cw) + 1;
      const r = rows[j];
      if (!r || day < 1 || day > r.len) { hideTip(tip); hl.setAttribute('visibility', 'hidden'); return; }
      const date = U.addDays(r.start, day - 1), v = pain.get(date);
      hl.setAttribute('x', L + (day - 1) * cw + gap / 2 - 1); hl.setAttribute('y', T + j * (rh + gapY) - 1); hl.setAttribute('visibility', 'visible');
      showTip(fig, tip, e, [h('b', {}, `Cycle day ${day}`), h('div', { class: 'muted' }, U.fmtDate(date, true) + (date <= r.pEnd ? ' · period' : '')),
        h('div', {}, v ? `Pain ${v}/10` : 'No pain logged')]);
    }, () => hl.setAttribute('visibility', 'hidden'));
    const legend = h('div', { class: 'chart-legend scale' }, h('span', { class: 'muted' }, 'Worst pain:'),
      [['q0', 'None'], ['q1', '1–2'], ['q2', '3–4'], ['q3', '5–6'], ['q4', '7–8'], ['q5', '9–10']].map(([c, l]) => key('cell ' + c, l)), key('pd', 'Period day'));
    fig.append(svg, legend);
    return fig;
  }

  return { timeline, line, bars, cycleStrip };
})();
