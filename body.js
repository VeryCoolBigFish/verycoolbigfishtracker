// Cycle and women's health: period log, DRSP, pelvic pain log and the Cycle tab (SPC §4, §5).
const Body = (() => {
  const { h, s } = U;
  let cache = null;
  M.onChange(() => { cache = null; });
  const model = () => cache || (cache = Cycle.compute(M.recs('period')));
  const phase = date => M.settings().modules.cycle ? Cycle.phase(model(), date) : null;

  // --- period day (SPC §5.1) ---
  Forms.register('period', {
    label: 'Period day', module: 'cycle', single: true, time: false,
    defaults: { flow: 'medium', clots: 'none', products: {}, pain: null },
    build(d, meta) {
      d.products = d.products || {};
      return [
        UI.when(meta, { time: false, label: 'Day' }),
        UI.field('Flow', UI.chips(d, 'flow', C.FLOW)),
        UI.field('Clots', UI.chips(d, 'clots', C.CLOTS)),
        UI.section('Products used', h('div', { class: 'grid2' }, C.PRODUCTS.map(([k, l]) => UI.stepper(d.products, k, l))),
          UI.toggle(d, 'hourly', 'Changing products every 1–2 hours')),
        UI.slider(d, 'pain', 'Period pain', { low: 'None', high: 'Worst imaginable' }),
        UI.toggle(d, 'between', 'This is bleeding between periods (not my period)'),
        UI.field('Note', UI.textarea(d, 'note')),
      ];
    },
    afterSave(rec) {
      if (rec.data.flow === 'vheavy' || rec.data.clots === 'large' || rec.data.hourly)
        UI.alert('Worth mentioning to your GP', 'Very heavy flow, large clots or changing products every 1–2 hours can be a sign of heavy menstrual bleeding, which is common and treatable.');
      else UI.toast('Saved');
    },
    summary: d => [d.between ? 'Between-period bleeding' : null, (C.FLOW.find(f => f[0] === d.flow) || [])[1], d.clots && d.clots !== 'none' ? 'clots' : null, d.pain != null ? `pain ${d.pain}` : null].filter(Boolean).join(' · '),
  });

  // --- DRSP (SPC §4.1) ---
  Forms.register('drsp', {
    label: 'Premenstrual ratings (DRSP)', module: 'cycle', single: true, time: false,
    defaults: { items: [], impair: [] },
    build(d, meta) {
      const ph = phase(meta.date);
      const list = h('div');
      const draw = () => list.replaceChildren(
        UI.section('How much did you experience each of these today?', C.DRSP.map((it, i) => UI.scaleQ(d.items, i, `${i + 1}. ${it.label}`, C.DRSP_SCALE, { compact: true, offset: 1 }))),
        UI.section('Impact', C.DRSP_IMPAIR.map((t, i) => UI.scaleQ(d.impair, i, t, C.DRSP_SCALE, { compact: true, offset: 1 }))));
      draw();
      return [
        UI.when(meta, { time: false, label: 'Day' }),
        ph ? h('p', { class: 'phase-chip ' + ph.phase }, `Cycle day ${ph.day} · ${Cycle.PHASES[ph.phase]}${ph.premenstrual ? ' · premenstrual week' : ''}`) : null,
        h('p', { class: 'hint' }, '1 Not at all · 2 Minimal · 3 Mild · 4 Moderate · 5 Severe · 6 Extreme'),
        h('button', { type: 'button', class: 'ghost small', onclick: () => {
          C.DRSP.forEach((_, i) => { if (d.items[i] == null) d.items[i] = 1; });
          C.DRSP_IMPAIR.forEach((_, i) => { if (d.impair[i] == null) d.impair[i] = 1; });
          draw();
        } }, 'Set unanswered to “Not at all”'),
        list,
        h('p', { class: 'cite' }, 'Daily Record of Severity of Problems · © Jean Endicott & Wilma Harrison (Endicott, Nee & Harrison, 2006). For personal tracking.'),
      ];
    },
    validate: d => C.DRSP.some((_, i) => d.items[i] == null) || C.DRSP_IMPAIR.some((_, i) => d.impair[i] == null) ? 'Please rate every item (or use “Set unanswered”).' : null,
    summary: d => { const hi = Math.max(...d.items); const n = d.items.filter(v => v >= 4).length; return `Highest ${C.DRSP_SCALE[hi - 1] || '–'} · ${n} item${n === 1 ? '' : 's'} moderate or worse`; },
  });

  // --- pelvic pain (SPC §5.4) ---
  // Simple front and back figures; each region toggles the matching location chip.
  const REGIONS = [
    ['shoulder', 'front', 'M38 22a5 5 0 1 0 0.1 0zM82 22a5 5 0 1 0 0.1 0z'],
    ['upper', 'front', 'M44 46h32v20H44z'],
    ['lowl', 'front', 'M44 70h10v22H44z'], ['lowc', 'front', 'M55 70h10v22H55z'], ['lowr', 'front', 'M66 70h10v22H66z'],
    ['vulva', 'front', 'M54 96h12l-6 10z'],
    ['thigh', 'front', 'M42 104h14v26H42zM64 104h14v26H64z'],
    ['back', 'back', 'M144 64h32v20h-32z'], ['butt', 'back', 'M142 88h36v14h-36z'], ['rectum', 'back', 'M155 104h10v8h-10z'],
  ];
  const OUTLINE = 'M60 4a9 9 0 1 1 -0.1 0zM40 22h40l6 40-4 34-6 42H64l-4-30-4 30H44l-6-42-4-34z';
  function bodyMap(d, onChange) {
    const svg = s('svg', { viewBox: '0 0 220 140', class: 'bodymap', role: 'group', 'aria-label': 'Pain locations: tap to select' });
    const draw = () => {
      svg.replaceChildren(
        s('path', { d: OUTLINE, class: 'outline' }), s('path', { d: OUTLINE, class: 'outline', transform: 'translate(100 0)' }),
        s('text', { x: 60, y: 138, class: 'cap' }, 'Front'), s('text', { x: 160, y: 138, class: 'cap' }, 'Back'),
        REGIONS.map(([k, , path]) => s('path', { d: path, class: 'region' + ((d.locs || []).includes(k) ? ' on' : ''), tabindex: 0, role: 'button',
          'aria-label': C.PAIN_LOC.find(l => l[0] === k)[1], onclick: () => toggle(k), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(k); } } },
        s('title', {}, C.PAIN_LOC.find(l => l[0] === k)[1]))));
    };
    const toggle = k => { const a = d.locs = d.locs || []; const i = a.indexOf(k); i >= 0 ? a.splice(i, 1) : a.push(k); draw(); onChange(); };
    draw();
    return { svg, draw };
  }
  Forms.register('pain', {
    label: 'Pelvic pain', module: 'cycle',
    defaults: { locs: [], types: [], links: [], severity: null },
    build(d, meta) {
      const chipWrap = h('div');
      let map;
      const drawChips = () => chipWrap.replaceChildren(UI.chips(d, 'locs', C.PAIN_LOC, { multi: true, onChange: () => map.draw() }));
      map = bodyMap(d, drawChips);
      drawChips();
      const ph = phase(meta.date);
      return [
        UI.when(meta),
        ph ? h('p', { class: 'phase-chip ' + ph.phase }, `Cycle day ${ph.day} · ${Cycle.PHASES[ph.phase]}`) : null,
        UI.section('Where', map.svg, chipWrap),
        UI.field('Pain type', UI.chips(d, 'types', C.PAIN_TYPE.map(t => [t, t]), { multi: true })),
        UI.slider(d, 'severity', 'Severity', { low: 'None', high: 'Worst imaginable' }),
        UI.field('Linked to', UI.chips(d, 'links', C.PAIN_LINK, { multi: true })),
        UI.section('Medication',
          UI.field('Taken', UI.chips(d, 'med', M.catalog('med'), { add: () => UI.addCatalog('med') })),
          UI.field('Relief', UI.chips(d, 'relief', C.RELIEF.map((l, i) => [i, l])))),
        UI.section('Impact', UI.toggle(d, 'missed', 'Missed or cut short work, study or plans'),
          UI.slider(d, 'function', 'How much did it limit what you could do?', { low: 'Not at all', high: 'Completely' })),
        UI.field('Note', UI.textarea(d, 'note')),
      ];
    },
    validate: d => d.severity == null ? 'Set the severity.' : null,
    summary: d => [`Pain ${d.severity}/10`, (d.locs || []).map(k => (C.PAIN_LOC.find(l => l[0] === k) || [])[1]).join(', '), (d.links || []).filter(l => l !== 'none').map(k => (C.PAIN_LINK.find(l => l[0] === k) || [])[1].toLowerCase()).join(', ')].filter(Boolean).join(' · '),
  });

  // --- Cycle tab ---
  let month = null;
  function calendar(cyc) {
    month = month || U.today().slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`, start = U.addDays(first, -new Date(y, m - 1, 1).getDay());
    const flows = new Map(M.recs('period').map(r => [r.date, r.data]));
    const painDays = new Set(M.recs('pain').map(r => r.date)), drspDays = new Set(M.recs('drsp').map(r => r.date));
    const pred = cyc.prediction, today = U.today();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = U.addDays(start, i);
      const f = flows.get(d), p = Cycle.phase(cyc, d);
      const cls = ['day'];
      if (d.slice(0, 7) !== month) cls.push('out');
      if (f && f.between) cls.push('between');
      else if (f && Cycle.BLEED.includes(f.flow)) cls.push('flow', f.flow);
      else if (f) cls.push('spot');
      else if (pred && d > today && d >= pred.from && d <= pred.to) cls.push('pred');
      if (!f && p && p.phase === 'ovulatory' && d >= today) cls.push('ovu');
      if (d === today) cls.push('today');
      cells.push(h('button', { class: cls.join(' '), 'aria-label': U.fmtLong(d) + (f ? ', ' + Forms.summary({ type: 'period', data: f }) : ''), onclick: () => dayMenu(d) },
        h('span', {}, U.parse(d).getDate()), h('i', { class: 'marks' }, painDays.has(d) ? h('b', { class: 'm-pain' }) : null, drspDays.has(d) ? h('b', { class: 'm-drsp' }) : null)));
    }
    const nav = n => { const dt = new Date(y, m - 1 + n, 1); month = `${dt.getFullYear()}-${U.pad(dt.getMonth() + 1)}`; App.render(); };
    return UI.card({ class: 'cal' },
      h('div', { class: 'cal-head' }, h('button', { class: 'ghost', 'aria-label': 'Previous month', onclick: () => nav(-1) }, '‹'),
        h('h3', {}, `${U.MONTHS[m - 1]} ${y}`), h('button', { class: 'ghost', 'aria-label': 'Next month', onclick: () => nav(1) }, '›')),
      h('div', { class: 'cal-grid' }, U.DAYS.map(x => h('span', { class: 'dow' }, x[0])), cells),
      h('div', { class: 'legend' }, h('span', { class: 'k flow' }, 'Period'), h('span', { class: 'k spot' }, 'Spotting'), h('span', { class: 'k pred' }, 'Predicted'),
        h('span', { class: 'k ovu' }, 'Ovulation (est.)'), h('span', { class: 'k m-pain' }, 'Pain'), h('span', { class: 'k m-drsp' }, 'DRSP')));
  }
  async function dayMenu(d) {
    const v = await UI.dialog(U.fmtLong(d), 'What would you like to log for this day?',
      [['Period', 'period'], ['DRSP', 'drsp'], ['Pelvic pain', 'pain'], ['Cancel', null, 'ghost']]);
    if (v) Forms.open(v, v === 'pain' ? null : M.one(v, d), d);
  }

  function pmddView(cyc) {
    const res = Cycle.pmdd(cyc, M.recs('drsp'), M.recs('checkin'), M.recs('panic'));
    const show = res.full.slice(-6);
    const body = [];
    if (!res.ready) body.push(UI.empty(`Keep logging — 2 cycles are needed, each with at least 3 of 7 days rated in the week before the period and on days 4–10 after it. So far: ${res.full.length}.`));
    if (show.length) {
      body.push(h('div', { class: 'tablewrap' }, h('table', { class: 'heat' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Period of'), show.map(c => h('th', {}, U.fmtDate(c.period))))),
        h('tbody', {}, C.PMDD_AREAS.map(a => h('tr', {}, h('th', {}, a.label, a.core ? ' *' : ''),
          show.map(c => { const x = c.areas[a.code]; return h('td', { class: x.elevated ? 'hot' : '', title: `Premenstrual ${x.L} vs after ${x.F}` }, `${x.L}/${x.F}`); }))),
        h('tr', { class: 'tot' }, h('th', {}, 'Matches DSM pattern'), show.map(c => h('td', { class: c.match ? 'hot' : '' }, c.match ? 'Yes' : c.mrmd ? 'Partly' : 'No')))))));
      body.push(h('p', { class: 'hint' }, `Each cell: mean rating in the week before the period / mean on days 4–10 after it. Shaded = meets the C-PASS rules: a rise of at least 30% of the range of ratings you use (${U.round(res.range * 0.3)} points), at least 2 premenstrual days rated moderate (4) or worse, and no day above mild (3) afterwards. A cycle matches with 5 or more shaded areas including a * core mood area; “Partly” means 1–4.`));
    }
    if (res.ready) body.push(h('p', { class: 'lead' }, `In ${res.matches} of ${res.full.length} logged cycles your premenstrual ratings matched the pattern DSM-5-TR describes for PMDD${res.matches >= 2 ? ' (DSM asks for at least 2)' : ''}.${res.matches ? ' This is worth showing your GP.' : ''}`));
    const ax = res.cycles.filter(c => c.anxiety.L != null && c.anxiety.F != null).slice(-6);
    if (ax.length >= 2) {
      const L = U.mean(ax.map(c => c.anxiety.L)), F = U.mean(ax.map(c => c.anxiety.F));
      const pL = U.mean(ax.map(c => c.anxiety.panicL)) * 7, pF = U.mean(ax.map(c => c.anxiety.panicF)) * 7;
      const up = L - F >= 1.5 && (L - F) / Math.max(L, 1) >= 0.3;
      body.push(h('p', {}, `Anxiety averages ${U.round(L)} in the premenstrual week vs ${U.round(F)} on days 4–10; panic attacks ${U.round(pL)} vs ${U.round(pF)} per week.`
        + (up ? ' Your anxiety rises before your period. That can be premenstrual worsening of an existing anxiety condition, which is different from PMDD.' : '')));
    }
    body.push(h('p', { class: 'notdx' }, C.NOT_DX_PATTERN));
    return UI.card({}, h('h3', {}, 'PMS / PMDD pattern'), body);
  }

  function screen() {
    const cyc = model(), today = U.today(), p = Cycle.phase(cyc, today);
    const notes = Cycle.notices(cyc, M.recs('period'));
    return [
      h('div', { class: 'hero cycle-hero' },
        p ? h('div', {}, h('p', { class: 'big' }, `Day ${p.day}`), h('p', {}, Cycle.PHASES[p.phase] + (p.premenstrual ? ' · premenstrual week' : ''))) : h('p', {}, 'Log your period to start cycle tracking.'),
        cyc.prediction ? h('p', {}, `Next period ≈ ${U.fmtDate(cyc.prediction.start, true)} (±${cyc.prediction.spread} days)`) : cyc.periods.length ? h('p', { class: 'hint' }, 'Predictions start after 2 full cycles.') : null),
      UI.card({ class: 'qgroup' }, h('div', { class: 'quick' }, [['period', 'Period day'], ['drsp', 'DRSP'], ['pain', 'Pelvic pain']].map(([t, l]) => UI.tile(t, l, () => Forms.open(t))))),
      calendar(cyc),
      UI.card({}, h('h3', {}, 'Your cycle'), h('dl', { class: 'stats' },
        h('dt', {}, 'Average cycle'), h('dd', {}, cyc.avg ? `${cyc.avg} days` : '–'),
        h('dt', {}, 'Average period'), h('dd', {}, cyc.avgPeriod ? `${cyc.avgPeriod} days` : '–'),
        h('dt', {}, 'Cycles logged'), h('dd', {}, cyc.usable.length),
        h('dt', {}, 'Recent lengths'), h('dd', {}, cyc.usable.slice(-6).join(', ') || '–'))),
      notes.length ? UI.card({ class: 'notice' }, h('h3', {}, 'Worth mentioning to your GP'), h('ul', {}, notes.map(n => h('li', {}, n))),
        h('p', { class: 'hint' }, 'Based on FIGO 2018 normal limits: cycles 24–38 days, periods up to 8 days, cycles within 9 days of each other.')) : null,
      pmddView(cyc),
      UI.card({}, h('h3', {}, 'Pelvic pain by cycle day'), Charts.cycleStrip(cyc, M.recs('pain')), h('p', { class: 'notdx' }, C.NOT_DX_PATTERN)),
    ];
  }

  return { model, phase, screen };
})();
