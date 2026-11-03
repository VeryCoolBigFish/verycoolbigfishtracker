// Today tab (quick logging, due items, today's entries) and Log tab (all forms and history).
const Today = (() => {
  const { h } = U;
  const GROUPS = [
    ['mind', 'Mind & sleep', ['checkin', 'panic', 'sleep', 'med', 'weekly', 'gad7', 'phq9', 'phq15']],
    ['cycle', 'Cycle', ['period', 'drsp', 'pain']],
    ['food', 'Food & gut', ['meal', 'gi', 'stool']],
  ];
  const moduleOf = type => (Forms.defs[type] || {}).module || '';
  const on = mod => M.settings().modules[mod] !== false;
  // Tile captions are short; each still contains a word of the form's full name.
  const SHORT = { checkin: 'Check-in', panic: 'Panic', sleep: 'Sleep', med: 'Medication', weekly: 'Weekly panic', gad7: 'GAD-7', phq9: 'PHQ-9', phq15: 'PHQ-15',
    period: 'Period', drsp: 'DRSP', pain: 'Pain', meal: 'Meal', gi: 'GI symptoms', stool: 'Bowel', water: 'Water' };
  const short = x => SHORT[x] || Forms.label(x);

  // Tiles for every enabled form, grouped by module. Food gets a one-tap water counter.
  function launcher(withWater) {
    const t = U.today();
    return GROUPS.filter(([mod]) => on(mod)).map(([mod, title, types]) => h('div', { class: 'qgroup card' },
      h('h3', {}, title),
      h('div', { class: 'quick' },
        types.filter(x => Forms.defs[x] && Forms.enabled(x)).map(x => UI.tile(x, short(x), () => Forms.open(x))),
        withWater && mod === 'food' && typeof Food !== 'undefined' ? UI.tile('water', 'Water +1', async () => { await Food.addWater(t); },
          h('span', { class: 'count' }, `${(M.one('water', t)?.data.glasses) || 0} today`)) : null)));
  }

  // Cycle day on a leaf.
  const leaf = day => h('div', { class: 'leaf', role: 'img', 'aria-label': `Cycle day ${day}` },
    U.s('svg', { viewBox: '0 0 78 78', 'aria-hidden': 'true' },
      U.s('path', { class: 'blade', d: 'M39 4C61 10 74 29 70 50 66 67 49 75 39 73 29 75 12 67 8 50 4 29 17 10 39 4Z' }),
      U.s('path', { class: 'vein', d: 'M39 13V66' })),
    h('span', { class: 'num', 'aria-hidden': 'true' }, h('small', {}, 'DAY'), h('b', {}, day)));

  function entryRow(rec) {
    return h('button', { class: 'entry', onclick: () => Forms.open(rec.type, rec) },
      h('span', { class: 't' }, rec.time || ''),
      h('span', { class: 'dot ' + moduleOf(rec.type), 'aria-hidden': 'true' }),
      h('span', { class: 'what' }, h('b', {}, Forms.label(rec.type)), h('small', {}, Forms.summary(rec))));
  }

  function dueItems(t) {
    const s = M.settings(), out = [];
    if (on('mind')) {
      if (Forms.enabled('checkin') && !M.one('checkin', t)) out.push({ type: 'checkin', label: 'Daily check-in', note: 'About 30 seconds' });
      if (Forms.enabled('sleep') && !M.one('sleep', t)) out.push({ type: 'sleep', label: 'Sleep diary', note: 'For last night' });
      for (const d of Mind.due()) out.push({ type: d.type, label: d.label, note: d.overdue == null ? 'Not done yet' : d.overdue > 0 ? `${d.overdue} day${d.overdue === 1 ? '' : 's'} overdue` : 'Due today' });
    }
    if (on('cycle') && Forms.enabled('drsp') && !M.one('drsp', t)) {
      const ph = Body.phase(t);
      if (s.drspMode === 'daily' || (ph && ph.premenstrual)) out.push({ type: 'drsp', label: 'Premenstrual ratings (DRSP)', note: ph && ph.premenstrual ? 'Premenstrual week' : 'Daily rating' });
    }
    return out;
  }

  function screen() {
    const t = U.today(), s = M.settings();
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const ph = on('cycle') ? Body.phase(t) : null;
    const pred = on('cycle') ? Body.model().prediction : null;

    const lastExp = s.lastExport ? U.diffDays(t, U.ymd(new Date(s.lastExport))) : null;
    const needBackup = M.state.records.size > 0 && (lastExp == null || lastExp > 7);
    const due = dueItems(t);
    const entries = M.recs(null, t, t).filter(r => r.type !== 'feedback');

    return [
      h('div', { class: 'today-top' },
        h('div', { class: 'hero today-hero' }, h('p', { class: 'greet' }, greet), h('p', { class: 'big' }, U.fmtLong(t))),
        ph ? leaf(ph.day) : null),
      ph || pred ? h('div', { class: 'chips today-chips' },
        ph ? h('span', { class: 'phase-chip ' + ph.phase }, Cycle.PHASES[ph.phase] + (ph.premenstrual ? ' · premenstrual week' : '')) : null,
        pred ? h('span', { class: 'phase-chip menstrual' }, `Period ≈ ${U.fmtDate(pred.start)} ±${pred.spread}`) : null) : null,

      needBackup ? UI.card({ class: 'notice backup' },
        h('h3', {}, 'Time to back up'),
        h('p', {}, lastExp == null ? 'You haven’t exported yet. An encrypted export protects your data and moves it to your other device.'
          : `Your last export was ${lastExp} days ago.`),
        h('button', { class: 'primary', onclick: () => Settings.exportFlow() }, 'Export now')) : null,

      due.length ? UI.card({ class: 'due' }, h('h3', {}, 'Due'),
        h('ul', { class: 'due-list' }, due.map(d => h('li', {}, h('button', { class: 'due-item', onclick: () => Forms.open(d.type) },
          h('span', { class: 'dot ' + moduleOf(d.type), 'aria-hidden': 'true' }), h('span', { class: 'what' }, h('b', {}, d.label), h('small', {}, d.note)), h('span', { class: 'go', 'aria-hidden': 'true' }, '›')))))) : null,

      h('section', { class: 'quicklog' }, h('h2', { class: 'sec' }, 'Quick log'), launcher(true)),

      UI.card({ class: 'entries-card' }, h('h3', {}, 'Today’s diary'),
        entries.length ? h('div', { class: 'entries' }, entries.map(entryRow)) : UI.empty('Nothing logged yet today.')),

      h('p', { class: 'support-link' }, h('button', { class: 'link', onclick: () => Mind.support() }, 'Need support now? Crisis lines and contacts')),
      h('p', { class: 'support-link' }, h('button', { class: 'link', onclick: () => Feedback.open() }, 'Suggest a change to this app')),
    ];
  }

  // --- Log tab ---
  const filt = { type: null, range: 30 };
  let limit = 200;
  function history() {
    const wrap = h('div', { class: 'hist' });
    const draw = () => {
      const from = filt.range ? U.addDays(U.today(), -filt.range + 1) : null;
      const list = M.recs(filt.type || null, from).filter(r => r.type !== 'feedback').reverse();
      const rows = [];
      let lastDate = null;
      for (const r of list.slice(0, limit)) {
        if (r.date !== lastDate) { rows.push(h('h4', { class: 'hdate' }, U.fmtLong(r.date))); lastDate = r.date; }
        rows.push(entryRow(r));
      }
      wrap.replaceChildren(
        h('p', { class: 'hint' }, `${list.length} entr${list.length === 1 ? 'y' : 'ies'}`),
        rows.length ? h('div', { class: 'entries' }, rows) : UI.empty('No entries in this range.'),
        list.length > limit ? h('button', { class: 'ghost', onclick: () => { limit += 200; draw(); } }, `Show more (${list.length - limit} left)`) : '');
    };
    const types = Object.keys(Forms.defs).filter(x => x !== 'feedback' && Forms.enabled(x)).map(x => [x, Forms.label(x)]);
    const reset = () => { limit = 200; draw(); };
    draw();
    return [
      h('div', { class: 'filters' },
        UI.field('Show', UI.chips(filt, 'type', types, { onChange: reset })),
        UI.field('Range', UI.chips(filt, 'range', [[7, '7 days'], [30, '30 days'], [90, '90 days'], [0, 'All']], { onChange: () => { if (filt.range == null) filt.range = 0; reset(); } }))),
      wrap,
    ];
  }

  function log() {
    return [
      h('h2', { class: 'sec' }, 'Log something'),
      launcher(false),
      UI.card({ class: 'history' }, h('h3', {}, 'History'), history()),
    ];
  }

  return { screen, log };
})();
