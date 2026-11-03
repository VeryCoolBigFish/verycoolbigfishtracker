// Summaries and pattern finding (REQ M-05, F-06, I-01, I-02; SPC §3.4, §6, §7.6, §9). Read-only over M.
const Ins = (() => {
  const giMax = r => Math.max(0, ...Object.values(r.data.sym || {}).map(Number));
  const H = 3600e3;

  // One row per day for charts and the report.
  function daily(from, to) {
    const rows = new Map(U.dayRange(from, to).map(d => [d, { date: d, anxiety: null, mood: null, panics: 0, se: null, gi: null, pain: null }]));
    for (const r of M.recs(['checkin', 'panic', 'sleep', 'gi', 'pain'], from, to)) {
      const row = rows.get(r.date);
      if (r.type === 'checkin') { row.anxiety = r.data.anxiety ?? null; row.mood = r.data.mood ?? null; }
      else if (r.type === 'panic') row.panics++;
      else if (r.type === 'sleep') { const s = Score.sleep(r.data); if (s) row.se = s.se; }
      else if (r.type === 'gi') row.gi = Math.max(row.gi ?? 0, giMax(r));
      else if (r.type === 'pain') row.pain = Math.max(row.pain ?? 0, U.num(r.data.severity));
    }
    return [...rows.values()];
  }

  // SPC §3.4 weekly summary for the 7 days ending `to`, with a trend against the 4 weeks before.
  function panicWeek(to = U.today()) {
    const from = U.addDays(to, -6);
    const list = M.recs('panic', from, to);
    const prev = M.recs('panic', U.addDays(from, -28), U.addDays(from, -1)).length / 4;
    const full = list.filter(p => Score.panicClass(p.data.symptoms).kind === 'full').length;
    const weekly = M.recs('weekly', from, to).pop() || null;
    const flagged = weekly ? C.AGORA.filter((a, i) => (weekly.data.fear?.[i] ?? 0) >= 2 || (weekly.data.avoid?.[i] ?? 0) >= 2) : [];
    return {
      from, to, n: list.length, full, limited: list.length - full,
      unexpected: list.filter(p => p.data.type === 'unexpected').length,
      nocturnal: list.filter(p => p.data.type === 'nocturnal').length,
      intensity: list.length ? U.round(U.mean(list.map(p => U.num(p.data.intensity)))) : null,
      prevAvg: U.round(prev), trend: list.length > prev + 0.5 ? 'up' : list.length < prev - 0.5 ? 'down' : 'flat',
      weekly, flagged,
    };
  }
  // How often each DSM symptom appears across attacks in a range.
  function panicProfile(from, to) {
    const list = M.recs('panic', from, to);
    return { n: list.length, rows: C.PANIC_SYMPTOMS.map(s => ({ ...s, count: list.filter(p => (p.data.symptoms || []).includes(s.code)).length })) };
  }

  // SPC §6 summary; weekly flag when a measure is out of range on 3 or more nights.
  function sleepSummary(from, to) {
    const nights = M.recs('sleep', from, to).map(r => ({ date: r.date, q: r.data.quality, ...Score.sleep(r.data) })).filter(n => n.tib != null);
    const m = k => nights.length ? U.mean(nights.map(n => n[k])) : null;
    const weeks = Math.max(1, U.diffDays(to, from) / 7);
    const count = k => nights.filter(n => n[k]).length;
    return {
      n: nights.length, nights, se: m('se') && U.round(m('se'), 0), tst: m('tst'), sol: m('sol'), waso: m('waso'),
      poorSE: count('poorSE'), longSOL: count('longSOL'), longWASO: count('longWASO'),
      flag: ['poorSE', 'longSOL', 'longWASO'].some(k => count(k) / weeks >= 3),
    };
  }

  // SPC §7.6 — Rome IV-style IBS pattern over the last `weeks` weeks.
  function ibs(to = U.today(), weeks = 12) {
    const from = U.addDays(to, -weeks * 7 + 1);
    const painDays = new Set();
    for (const g of M.recs('gi', from, to)) if (U.num(g.data.sym?.['gisym:pain']) >= 1) painDays.add(g.date);
    for (const p of M.recs('pain', from, to)) if ((p.data.locs || []).some(l => ['lowc', 'lowl', 'lowr'].includes(l)) && U.num(p.data.severity) >= 1) painDays.add(p.date);
    const stools = M.recs('stool', from, to).filter(s => s.data.bristol);
    const hard = stools.filter(s => s.data.bristol <= 2).length, loose = stools.filter(s => s.data.bristol >= 6).length;
    const pH = U.pct(hard, stools.length), pL = U.pct(loose, stools.length);
    let subtype = null;
    if (stools.length >= 10) subtype = pH > 25 && pL < 25 ? 'IBS-C' : pL > 25 && pH < 25 ? 'IBS-D' : pH > 25 && pL > 25 ? 'IBS-M' : 'unclassified';
    const linked = [...painDays].filter(d => stools.some(s => s.date === d && s.data.painChange)).length;
    const perWeek = U.round(painDays.size / weeks);
    return { from, to, weeks, painDays: painDays.size, perWeek, stools: stools.length, pHard: pH, pLoose: pL, subtype, linkedPct: U.pct(linked, painDays.size),
      bristol: [1, 2, 3, 4, 5, 6, 7].map(t => stools.filter(s => s.data.bristol === t).length) };
  }

  // SPC §9 — possible associations; only shown with ≥ 5 exposures and ≥ 5 non-exposures.
  function associations(from, to) {
    const out = [];
    const MIN = 5;
    const push = (kind, title, a, n, b, m, unit) => {
      if (n < MIN || m < MIN) return;
      const ra = a / n, rb = b / m;
      if (ra - rb < 0.15) return;
      out.push({ kind, title, a, n, b, m, ra, rb, unit });
    };
    // Food tags → GI symptom ≥ 4 within 2–24 h.
    const meals = M.recs('meal', from, to), gis = M.recs('gi', from, U.addDays(to, 1)).filter(g => giMax(g) >= 4).map(g => U.ts(g.date, g.time));
    const hit = meal => { const t = U.ts(meal.date, meal.time); return gis.some(g => g >= t + 2 * H && g <= t + 24 * H); };
    const tags = new Set(meals.flatMap(m => m.data.tags || []));
    for (const tag of tags) {
      const ex = meals.filter(m => (m.data.tags || []).includes(tag)), no = meals.filter(m => !(m.data.tags || []).includes(tag));
      push('food', `After ${M.catName(tag)} meals, GI symptoms followed`, ex.filter(hit).length, ex.length, no.filter(hit).length, no.length, 'times');
    }
    // Poor night → next-day anxiety ≥ 6 or a panic attack (the sleep record is dated the morning after).
    const check = new Map(M.recs('checkin', from, to).map(c => [c.date, c.data]));
    const panicDays = new Set(M.recs('panic', from, U.addDays(to, 1)).map(p => p.date));
    const badDay = d => (check.get(d)?.anxiety ?? 0) >= 6 || panicDays.has(d);
    const nights = M.recs('sleep', from, to).map(r => ({ date: r.date, s: Score.sleep(r.data), q: r.data.quality })).filter(n => n.s);
    const poor = nights.filter(n => n.s.se < 85 || (n.q != null && n.q <= 1)), good = nights.filter(n => !poor.includes(n));
    push('sleep', 'After a poor night, high anxiety or panic followed', poor.filter(n => badDay(n.date)).length, poor.length, good.filter(n => badDay(n.date)).length, good.length, 'days');
    // Caffeine ≥ 3 drinks / any alcohol → panic the same or next day.
    const days = [...check.entries()];
    const panicNear = d => panicDays.has(d) || panicDays.has(U.addDays(d, 1));
    for (const [key, test, label] of [['caffeine', v => U.num(v.caffeine) >= 3, '3 or more caffeine drinks'], ['alcohol', v => U.num(v.alcohol) > 0, 'drinking alcohol']]) {
      const ex = days.filter(([, v]) => test(v)), no = days.filter(([, v]) => !test(v));
      push(key, `On days after ${label}, a panic attack followed (same or next day)`, ex.filter(([d]) => panicNear(d)).length, ex.length, no.filter(([d]) => panicNear(d)).length, no.length, 'days');
    }
    return out.sort((x, y) => (y.ra - y.rb) - (x.ra - x.rb));
  }

  // Mean anxiety, panic rate and GI severity by estimated cycle phase.
  function byPhase(from, to, cyc) {
    const rows = daily(from, to);
    const tracked = new Set(M.recs(['meal', 'gi'], from, to).map(r => r.date));
    const groups = {};
    for (const r of rows) {
      const p = Cycle.phase(cyc, r.date);
      if (!p) continue;
      const g = groups[p.phase] = groups[p.phase] || { days: 0, anx: [], panics: 0, gi: [] };
      g.days++; g.panics += r.panics;
      if (r.anxiety != null) g.anx.push(r.anxiety);
      if (tracked.has(r.date)) g.gi.push(r.gi ?? 0);
    }
    return Object.keys(Cycle.PHASES).filter(k => groups[k]).map(k => {
      const g = groups[k];
      return { phase: k, label: Cycle.PHASES[k], days: g.days, anxiety: g.anx.length ? U.round(U.mean(g.anx)) : null, panicRate: U.round(g.panics / g.days * 7), gi: g.gi.length ? U.round(U.mean(g.gi)) : null };
    });
  }

  return { daily, panicWeek, panicProfile, sleepSummary, ibs, associations, byPhase, giMax };
})();
