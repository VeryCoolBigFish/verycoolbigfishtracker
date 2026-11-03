// Insights tab and the printable doctor report (REQ I-01 to I-04; SPC §3.4, §4.2, §6, §7.6, §9).
const Report = (() => {
  const { h } = U;
  const range = { days: 30, from: null, to: null }; // custom range when days is null
  const IMPACT_SHORT = ['Worry about attacks', 'Changed what I did', 'Work, study, home', 'Social life, relationships'];
  const FOOTER = 'Patterns to discuss, not proof of cause. Many things change together.';

  function span() {
    if (range.days) { const to = U.today(); return { from: U.addDays(to, -(range.days - 1)), to }; }
    return { from: range.from, to: range.to };
  }
  const mods = () => M.settings().modules;
  const tile = (value, label, cls) => h('div', { class: 'tile ' + (cls || '') }, h('b', {}, value ?? '–'), h('span', {}, label));
  const tiles = (...t) => h('div', { class: 'tiles' }, t);

  // Pick two dates; resolves to {from, to} or null.
  async function pickRange(title, from, to) {
    const d = { from, to };
    const a = UI.input(d, 'from', { type: 'date', max: U.today() }), b = UI.input(d, 'to', { type: 'date', max: U.today() });
    const ok = await UI.dialog(title, h('div', { class: 'stack' }, UI.field('From', a), UI.field('To', b)), [['Cancel', false, 'ghost'], ['Continue', true, 'primary']]);
    if (!ok || !d.from || !d.to) return null;
    return d.from <= d.to ? d : { from: d.to, to: d.from };
  }

  function rangeBar() {
    const opts = [[7, '7 days'], [30, '30 days'], [90, '90 days'], ['custom', 'Custom']];
    const sel = { v: range.days || 'custom' };
    const { from, to } = span();
    return h('div', { class: 'range-bar' },
      UI.chips(sel, 'v', opts, { onChange: async () => {
        if (sel.v == null && range.days) { App.render(); return; } // tapping the active chip keeps the current range
        if (sel.v === 'custom' || sel.v == null) {
          const r = await pickRange('Custom range', from, to);
          if (r) Object.assign(range, { days: null, from: r.from, to: r.to });
        } else range.days = sel.v;
        App.render();
      } }),
      h('p', { class: 'hint' }, `${U.fmtDate(from, true)} – ${U.fmtDate(to, true)}`));
  }

  // --- cards ---
  function timelineCard(from, to) {
    const m = mods(), series = [];
    if (m.mind) series.push({ key: 'anxiety', label: 'Anxiety', cls: 's-anx' }, { key: 'mood', label: 'Mood', cls: 's-mood' });
    if (m.food) series.push({ key: 'gi', label: 'GI severity', cls: 's-gi' });
    if (m.cycle) series.push({ key: 'pain', label: 'Pelvic pain', cls: 's-pain' });
    if (!series.length) return null;
    return UI.card({}, h('h3', {}, 'Timeline'),
      Charts.timeline({ rows: Ins.daily(from, to), cyc: m.cycle ? Body.model() : null, series }),
      m.cycle ? h('p', { class: 'hint' }, 'Shading shows your estimated cycle phase.') : null);
  }

  function questionnaireCard(key, from, to) {
    const q = C.Q[key];
    const recs = M.recs(key).filter(r => r.data.score != null);
    if (!recs.length) return UI.card({}, h('h3', {}, q.title), UI.empty('No results yet.'),
      h('button', { class: 'ghost', onclick: () => Forms.open(key) }, `Take the ${q.name}`));
    const last = recs[recs.length - 1], b = Score.band(key, last.data.score);
    const inRange = recs.filter(r => r.date >= from && r.date <= to);
    const pts = (inRange.length >= 2 ? inRange : recs).map(r => ({ date: r.date, value: r.data.score }));
    return UI.card({}, h('h3', {}, q.title),
      h('p', { class: 'lead' }, `Latest: ${last.data.score} / ${q.max} · ${b.label}`, h('span', { class: 'hint' }, ` (${U.fmtDate(last.date)})`)),
      pts.length >= 2 ? Charts.line({ points: pts, from: pts[0].date, to: pts[pts.length - 1].date, max: q.max, bands: q.bands.map(x => ({ from: x[0], label: x[1] })), label: q.name, cls: 's-mood', unit: '' }) : null,
      h('p', { class: 'notdx' }, C.NOT_DX));
  }

  function panicCard(from, to) {
    const w = Ins.panicWeek(), prof = Ins.panicProfile(from, to);
    const trend = { up: `more than your 4-week average (${w.prevAvg}/week)`, down: `fewer than your 4-week average (${w.prevAvg}/week)`, flat: `about your 4-week average (${w.prevAvg}/week)` }[w.trend];
    const impact = w.weekly && w.weekly.data.impact;
    return UI.card({}, h('h3', {}, 'Panic this week'),
      tiles(tile(w.n, 'attacks'), tile(w.full, 'full'), tile(w.limited, 'limited'), tile(w.unexpected, 'out of the blue'), tile(w.nocturnal, 'at night'), tile(w.intensity, 'mean peak /10')),
      h('p', {}, `${w.n} attack${w.n === 1 ? '' : 's'} in the last 7 days — ${trend}.`),
      w.weekly ? h('p', {}, w.flagged.length ? `Situations flagged in your weekly check: ${w.flagged.map(a => a.label.toLowerCase()).join(', ')}.` : 'No situation groups flagged in your weekly check.')
        : h('p', { class: 'hint' }, 'Do the weekly panic check to track avoidance and worry.'),
      impact && impact.length ? h('dl', { class: 'stats' }, IMPACT_SHORT.map((l, i) => [h('dt', {}, l), h('dd', {}, impact[i] != null ? `${C.IMPACT_SCALE[impact[i]]} (${impact[i]}/4)` : '–')])) : null,
      prof.n ? [h('h4', {}, `Symptoms across ${prof.n} attack${prof.n === 1 ? '' : 's'} in this range`),
        Charts.bars(prof.rows.filter(r => r.count).sort((a, b) => b.count - a.count).map(r => ({ label: r.label, value: r.count, note: `${U.pct(r.count, prof.n)}%` })), { max: prof.n, unit: 'attacks', cls: 's-anx' })]
        : UI.empty('No panic attacks logged in this range.'));
  }

  function sleepCard(from, to) {
    const s = Ins.sleepSummary(from, to);
    if (!s.n) return UI.card({}, h('h3', {}, 'Sleep'), UI.empty('No sleep diary entries in this range.'));
    return UI.card({}, h('h3', {}, 'Sleep'),
      tiles(tile(s.n, 'nights'), tile(s.se != null ? s.se + '%' : null, 'efficiency', s.se != null && s.se < 85 ? 'warn' : ''), tile(U.fmtMins(s.tst), 'asleep'),
        tile(s.sol != null ? Math.round(s.sol) + 'm' : null, 'to fall asleep'), tile(s.waso != null ? Math.round(s.waso) + 'm' : null, 'awake in night')),
      h('p', {}, `Nights with efficiency under 85%: ${s.poorSE} · taking over 30 min to fall asleep: ${s.longSOL} · awake over 30 min: ${s.longWASO}.`),
      s.flag ? h('p', { class: 'lead' }, 'One or more of these happened on 3 or more nights a week — the usual sign of insomnia-type sleep. Worth raising if it continues.') : null,
      s.n >= 2 ? Charts.line({ points: s.nights.map(n => ({ date: n.date, value: n.se })), from, to, max: 100, bands: [{ from: 0, label: 'Below 85%' }, { from: 85, label: '85%+' }], label: 'Sleep efficiency', cls: 's-sleep', unit: '%' }) : null);
  }

  function ibsSentence(x) {
    if (x.stools < 10) return `Keep logging — the pattern summary needs at least 10 bowel motions in the last ${x.weeks} weeks (so far ${x.stools}).`;
    if (x.subtype === 'unclassified') return `Your last ${x.weeks} weeks do not fit an IBS-C, IBS-D or IBS-M stool pattern.`;
    return `Your last ${x.weeks} weeks look like an ${x.subtype} pattern. Only a doctor can diagnose IBS after ruling out other causes (e.g. coeliac disease, IBD).`;
  }
  function gutCard(to) {
    const x = Ins.ibs(to);
    return UI.card({}, h('h3', {}, 'Gut pattern (last 12 weeks)'),
      h('p', { class: 'lead' }, ibsSentence(x)),
      tiles(tile(x.perWeek, 'pain days / week'), tile(x.pHard + '%', 'hard (type 1–2)'), tile(x.pLoose + '%', 'loose (type 6–7)'), tile(x.linkedPct + '%', 'pain linked to going')),
      x.perWeek >= 1 ? h('p', { class: 'hint' }, 'Rome IV describes IBS pain on at least 1 day a week on average.') : null,
      x.stools ? Charts.bars(C.BRISTOL.map((b, i) => ({ label: `Type ${b.type}`, value: x.bristol[i], note: b.label })), { max: Math.max(...x.bristol, 1), unit: 'motions', cls: 's-gi' }) : null,
      h('p', { class: 'notdx' }, C.NOT_DX_PATTERN));
  }

  function phaseTable(rows) {
    return h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, ['Phase', 'Days', 'Mean anxiety', 'Panic / week', 'Mean GI'].map(t => h('th', {}, t)))),
      h('tbody', {}, rows.map(r => h('tr', {}, h('th', {}, r.label), h('td', {}, r.days), h('td', {}, r.anxiety ?? '–'), h('td', {}, r.panicRate), h('td', {}, r.gi ?? '–'))))));
  }
  function phaseCard(from, to) {
    const rows = Ins.byPhase(from, to, Body.model());
    return UI.card({}, h('h3', {}, 'By cycle phase'),
      rows.length ? [phaseTable(rows), h('p', { class: 'hint' }, 'Phases are estimated from your logged periods. Panic is shown as attacks per 7 days in that phase.')]
        : UI.empty('Log periods to compare how you feel across your cycle.'));
  }

  const assocText = x => `${x.title} ${x.a} of ${x.n} ${x.unit} (${Math.round(x.ra * 100)}%) vs ${x.b} of ${x.m} ${x.unit} otherwise (${Math.round(x.rb * 100)}%).`;
  function assocCard(from, to) {
    const list = Ins.associations(from, to);
    return UI.card({}, h('h3', {}, 'Possible associations'),
      list.length ? h('ul', { class: 'assoc' }, list.map(x => h('li', { class: 'a-' + x.kind }, assocText(x))))
        : UI.empty('Nothing to show yet. A pattern appears once something has happened at least 5 times, and not happened at least 5 times, in this range.'),
      h('p', { class: 'notdx' }, FOOTER));
  }

  function screen() {
    const { from, to } = span(), m = mods();
    return [
      h('div', { class: 'ins-head' }, rangeBar(),
        h('button', { class: 'primary', onclick: () => print(from, to) }, 'Doctor report')),
      h('div', { class: 'ins-grid' },
        timelineCard(from, to),
        m.mind ? ['gad7', 'phq9', 'phq15'].map(k => questionnaireCard(k, from, to)) : null,
        m.mind ? panicCard(from, to) : null,
        m.mind ? sleepCard(from, to) : null,
        m.food ? gutCard(to) : null,
        m.cycle ? phaseCard(from, to) : null,
        assocCard(from, to)),
    ];
  }

  // --- printable doctor report ---
  const sec = (title, ...kids) => h('section', { class: 'p-sec' }, h('h2', {}, title), ...kids);
  const table = (head, rows) => h('table', { class: 'data' }, h('thead', {}, h('tr', {}, head.map(t => h('th', {}, t)))),
    h('tbody', {}, rows.map(r => h('tr', {}, r.map((c, i) => h(i ? 'td' : 'th', {}, c ?? '–'))))));
  const none = t => h('p', { class: 'empty' }, t);

  function qSection(from, to) {
    const rows = [];
    for (const key of Object.keys(C.Q)) for (const r of M.recs(key, from, to)) if (r.data.score != null) {
      const b = Score.band(key, r.data.score);
      rows.push([r.date, C.Q[key].name, `${r.data.score} / ${C.Q[key].max}`, b.label]);
    }
    rows.sort((a, b) => a[0].localeCompare(b[0])).forEach(r => { r[0] = U.fmtDate(r[0], true); });
    const charts = Object.keys(C.Q).map(key => {
      const pts = M.recs(key, from, to).filter(r => r.data.score != null).map(r => ({ date: r.date, value: r.data.score }));
      return pts.length >= 2 ? h('div', { class: 'p-chart' }, h('h3', {}, C.Q[key].name),
        Charts.line({ points: pts, from, to, max: C.Q[key].max, bands: C.Q[key].bands.map(x => ({ from: x[0], label: x[1] })), label: C.Q[key].name, cls: 's-mood', unit: '' })) : null;
    });
    return sec('Questionnaire scores', rows.length ? table(['Date', 'Measure', 'Score', 'Band'], rows) : none('No questionnaires completed in this range.'), charts);
  }

  function panicSection(from, to) {
    const list = M.recs('panic', from, to), prof = Ins.panicProfile(from, to);
    if (!list.length) return sec('Panic attacks', none('No panic attacks logged in this range.'));
    const weeks = Math.max(1, (U.diffDays(to, from) + 1) / 7);
    const full = list.filter(p => Score.panicClass(p.data.symptoms).kind === 'full').length;
    const weekly = M.recs('weekly', from, to);
    const lastW = weekly[weekly.length - 1];
    return sec('Panic attacks',
      table(['Measure', 'Value'], [
        ['Attacks', `${list.length} (${U.round(list.length / weeks)} per week)`], ['Full / limited-symptom', `${full} / ${list.length - full}`],
        ['Out of the blue', list.filter(p => p.data.type === 'unexpected').length], ['Woke from sleep', list.filter(p => p.data.type === 'nocturnal').length],
        ['Mean peak intensity', `${U.round(U.mean(list.filter(p => p.data.intensity != null).map(p => U.num(p.data.intensity))) ?? 0)} / 10`],
        ['Avoided or changed something afterwards', list.filter(p => p.data.avoided).length],
      ]),
      h('h3', {}, 'Symptom profile'),
      Charts.bars(prof.rows.filter(r => r.count).sort((a, b) => b.count - a.count).map(r => ({ label: r.label, value: r.count, note: `${U.pct(r.count, prof.n)}%` })), { max: prof.n, unit: 'attacks', cls: 's-anx' }),
      lastW ? [h('h3', {}, `Latest weekly check (${U.fmtDate(lastW.date)})`),
        table(['Situation', 'Fear', 'Avoidance'], C.AGORA.map((a, i) => [a.label, C.FEAR_SCALE[lastW.data.fear?.[i]] ?? '–', C.AVOID_SCALE[lastW.data.avoid?.[i]] ?? '–'])),
        table(['Impact', 'Rating'], IMPACT_SHORT.map((l, i) => [l, lastW.data.impact?.[i] != null ? `${C.IMPACT_SCALE[lastW.data.impact[i]]} (${lastW.data.impact[i]}/4)` : '–']))] : null);
  }

  function cycleSection(from, to) {
    const cyc = Body.model(), ps = cyc.periods;
    const rows = [];
    ps.forEach((p, i) => {
      if (p.start < from || p.start > to) return;
      rows.push([U.fmtDate(p.start, true), ps[i + 1] ? `${U.diffDays(ps[i + 1].start, p.start)} days` : '(current)', `${p.days} days`]);
    });
    const notes = Cycle.notices(cyc, M.recs('period'));
    return sec('Menstrual cycle',
      rows.length ? table(['Period start', 'Cycle length', 'Period length'], rows) : none('No periods logged in this range.'),
      h('p', {}, `Average cycle ${cyc.avg ?? '–'} days · average period ${cyc.avgPeriod ?? '–'} days · ${cyc.usable.length} cycles logged in total.`),
      notes.length ? [h('h3', {}, 'Notices (FIGO 2018 limits)'), h('ul', {}, notes.map(n => h('li', {}, n)))] : null);
  }

  function pmddSection(from, to) {
    const res = Cycle.pmdd(Body.model(), M.recs('drsp'), M.recs('checkin'), M.recs('panic'));
    const show = res.full.filter(c => c.end >= from && c.start <= to).slice(-6);
    if (!show.length) return sec('Premenstrual pattern (DRSP)', none('Not enough DRSP ratings in this range (each cycle needs 3 of 7 days rated in the premenstrual week and on days 4–10 after the period).'));
    return sec('Premenstrual pattern (DRSP)',
      h('table', { class: 'heat' },
        h('thead', {}, h('tr', {}, h('th', {}, 'DSM area (period of)'), show.map(c => h('th', {}, U.fmtDate(c.period))))),
        h('tbody', {}, C.PMDD_AREAS.map(a => h('tr', {}, h('th', {}, a.label, a.core ? ' *' : ''),
          show.map(c => { const x = c.areas[a.code]; return h('td', { class: x.elevated ? 'hot' : '' }, `${x.L}/${x.F}`); }))),
          h('tr', { class: 'tot' }, h('th', {}, 'Matches DSM pattern'), show.map(c => h('td', { class: c.match ? 'hot' : '' }, c.match ? 'Yes' : c.mrmd ? '1–4 areas' : 'No'))))),
      h('p', { class: 'hint' }, `Cell = mean DRSP rating (1–6) on premenstrual days −7 to −1 / days 4–10 after the same period. Shaded = meets C-PASS (Eisenlohr-Moul et al., 2017): rise ≥ 30% of the range of scale used (${U.round(res.range * 0.3)} points), ≥ 2 premenstrual days ≥ 4, no postmenstrual day > 3. * core mood areas. DRSP: Endicott, Nee & Harrison, 2006.`),
      h('p', {}, `${show.filter(c => c.match).length} of ${show.length} cycles matched the DSM-5-TR PMDD pattern.`));
  }

  function gutSection(from, to) {
    const gis = M.recs('gi', from, to);
    const days = new Set(gis.filter(g => Ins.giMax(g) >= 1).map(g => g.date));
    const symRows = [];
    for (const it of [...M.catalog('gisym', true)]) {
      const vals = gis.map(g => U.num(g.data.sym?.[it.id])).filter(v => v > 0);
      if (vals.length) symRows.push([it.name, new Set(gis.filter(g => U.num(g.data.sym?.[it.id]) > 0).map(g => g.date)).size, U.round(U.mean(vals))]);
    }
    symRows.sort((a, b) => b[1] - a[1]);
    const x = Ins.ibs(to, Math.max(1, Math.round((U.diffDays(to, from) + 1) / 7)));
    return sec('Gut',
      h('p', {}, `Days with GI symptoms: ${days.size} of ${U.diffDays(to, from) + 1}.`),
      symRows.length ? table(['Symptom', 'Days', 'Mean severity /10'], symRows) : null,
      h('h3', {}, 'Stool form (Bristol)'),
      x.stools ? Charts.bars(C.BRISTOL.map((b, i) => ({ label: `Type ${b.type}`, value: x.bristol[i], note: b.label })), { max: Math.max(...x.bristol, 1), unit: 'motions', cls: 's-gi' }) : none('No bowel motions logged.'),
      h('p', {}, ibsSentence(x)),
      h('p', {}, `Pain days per week ${x.perWeek} · hard stools ${x.pHard}% · loose stools ${x.pLoose}% · pain linked to bowel motions ${x.linkedPct}%.`));
  }

  function sleepSection(from, to) {
    const s = Ins.sleepSummary(from, to);
    if (!s.n) return sec('Sleep', none('No sleep diary entries in this range.'));
    return sec('Sleep (Consensus Sleep Diary)',
      table(['Measure', 'Mean'], [['Nights logged', s.n], ['Total sleep', U.fmtMins(s.tst)], ['Sleep efficiency', s.se + '%'],
        ['Time to fall asleep', Math.round(s.sol) + ' min'], ['Awake after sleep onset', Math.round(s.waso) + ' min'],
        ['Nights < 85% efficiency / > 30 min to sleep / > 30 min awake', `${s.poorSE} / ${s.longSOL} / ${s.longWASO}`]]),
      s.n >= 2 ? Charts.line({ points: s.nights.map(n => ({ date: n.date, value: n.se })), from, to, max: 100, bands: [{ from: 0, label: 'Below 85%' }, { from: 85, label: '85%+' }], label: 'Sleep efficiency', cls: 's-sleep', unit: '%' }) : null);
  }

  function medSection(from, to) {
    const count = new Map();
    const add = (id, why) => { if (!id) return; const k = M.catName(id); const c = count.get(k) || { n: 0, why: new Set() }; c.n++; if (why) c.why.add(why); count.set(k, c); };
    for (const r of M.recs('med', from, to)) add(r.data.med, r.data.reason);
    for (const r of M.recs('checkin', from, to)) for (const id of r.data.meds || []) add(id, 'anxiety');
    for (const r of M.recs('pain', from, to)) add(r.data.med, 'pain');
    for (const r of M.recs('sleep', from, to)) add(r.data.sleepMed, 'sleep');
    const rows = [...count.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, v.n, [...v.why].join(', ')]);
    return sec('Medication taken', rows.length ? table(['Medication', 'Times logged', 'For'], rows) : none('No medication logged in this range.'));
  }

  function build(from, to) {
    const m = mods(), series = [];
    if (m.mind) series.push({ key: 'anxiety', label: 'Anxiety', cls: 's-anx' }, { key: 'mood', label: 'Mood', cls: 's-mood' });
    if (m.food) series.push({ key: 'gi', label: 'GI severity', cls: 's-gi' });
    if (m.cycle) series.push({ key: 'pain', label: 'Pelvic pain', cls: 's-pain' });
    return h('article', { class: 'p-report' },
      h('header', { class: 'p-head' }, h('h1', {}, 'Health summary'),
        h('p', {}, `${U.fmtLong(from)} – ${U.fmtLong(to)}`), h('p', { class: 'hint' }, `Generated ${U.fmtLong(U.today())} from self-recorded daily logs.`)),
      series.length ? sec('Overview', Charts.timeline({ rows: Ins.daily(from, to), cyc: m.cycle ? Body.model() : null, series })) : null,
      m.mind ? [qSection(from, to), panicSection(from, to), sleepSection(from, to)] : null,
      m.cycle ? [cycleSection(from, to), pmddSection(from, to)] : null,
      m.food ? gutSection(from, to) : null,
      medSection(from, to),
      h('footer', { class: 'p-foot' }, h('p', {}, C.NOT_DX), h('p', {}, C.NOT_DX_PATTERN),
        h('p', {}, 'Symptom lists paraphrase DSM-5-TR, Rome IV and FIGO criteria. Questionnaires: GAD-7, PHQ-9, PHQ-15 (Pfizer, free to use); DRSP (Endicott et al.); Consensus Sleep Diary (Carney et al.); Bristol Stool Form Scale (Lewis & Heaton).')));
  }

  async function print(from, to) {
    const r = await pickRange('Doctor report — date range', from || U.addDays(U.today(), -89), to || U.today());
    if (!r) return;
    let out = document.getElementById('print');
    if (!out) { out = h('div', { id: 'print' }); document.body.append(out); }
    out.replaceChildren(build(r.from, r.to));
    const clear = () => { out.replaceChildren(); removeEventListener('afterprint', clear); };
    addEventListener('afterprint', clear);
    setTimeout(() => window.print(), 60);
  }

  return { screen, print, build };
})();
