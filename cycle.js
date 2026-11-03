// Cycle maths (SPC §5.2–5.3) and the PMDD pattern rule (SPC §4.2). Functions take plain record arrays so they can be unit-tested.
const Cycle = (() => {
  const BLEED = ['light', 'medium', 'heavy', 'vheavy']; // spotting is not counted as a period day
  const DEFAULT_LEN = 28;

  // Group bleeding days into periods: days up to 2 apart belong to the same period.
  function periods(periodRecs) {
    const days = [...new Set(periodRecs.filter(r => !r.deleted && !r.data.between && BLEED.includes(r.data.flow)).map(r => r.date))].sort();
    const out = [];
    for (const d of days) {
      const p = out[out.length - 1];
      if (p && U.diffDays(d, p.end) <= 2) p.end = d;
      else out.push({ start: d, end: d });
    }
    for (const p of out) p.days = U.diffDays(p.end, p.start) + 1;
    return out;
  }

  function compute(periodRecs, today = U.today()) {
    const ps = periods(periodRecs);
    const lengths = [];
    for (let i = 1; i < ps.length; i++) lengths.push(U.diffDays(ps[i].start, ps[i - 1].start));
    const usable = lengths.filter(n => n >= 10 && n <= 90); // gaps over 90 days are treated as missing data
    const recent = usable.slice(-6);
    const avg = recent.length ? U.mean(recent) : null;
    const spread = Math.max(2, Math.round(U.sd(recent)));
    const last = ps[ps.length - 1] || null;
    const len = avg ? Math.round(avg) : DEFAULT_LEN;
    let prediction = null;
    if (last && recent.length >= 2) {
      let next = U.addDays(last.start, Math.round(avg));
      while (next < today && U.diffDays(today, next) > spread) next = U.addDays(next, Math.round(avg)); // a missed log rolls forward
      prediction = { start: next, from: U.addDays(next, -spread), to: U.addDays(next, spread), spread };
    }
    return { periods: ps, lengths, usable, avg: avg && U.round(avg, 1), avgPeriod: ps.length ? U.round(U.mean(ps.map(p => p.days)), 1) : null, len, prediction, last, defaultLen: !avg };
  }

  // Cycle day and estimated phase for a date, or null before the first logged period.
  function phase(model, date) {
    const ps = model.periods;
    let i = -1;
    for (let k = 0; k < ps.length; k++) if (ps[k].start <= date) i = k;
    if (i < 0) return null;
    const p = ps[i];
    const day = U.diffDays(date, p.start) + 1;
    const nextActual = ps[i + 1] ? ps[i + 1].start : null;
    const next = nextActual || (model.prediction && i === ps.length - 1 ? model.prediction.start : U.addDays(p.start, model.len));
    if (day > 90) return null;
    const ov = U.addDays(next, -14);
    const toNext = U.diffDays(next, date);
    let ph;
    const ongoing = i === ps.length - 1 && U.diffDays(U.today(), p.end) <= 1; // a period still being logged is assumed to run 5 days
    if (date <= p.end || (ongoing && day <= 5)) ph = 'menstrual';
    else if (date >= U.addDays(ov, -2) && date <= U.addDays(ov, 1)) ph = 'ovulatory';
    else if (date < ov) ph = 'follicular';
    else ph = 'luteal';
    return { day, phase: ph, premenstrual: toNext >= 1 && toNext <= 7, toNext, next, estimated: !nextActual };
  }
  const PHASES = { menstrual: 'Menstrual', follicular: 'Follicular', ovulatory: 'Ovulatory window (est.)', luteal: 'Luteal' };

  // SPC §5.3 — FIGO 2018 notices; cycle-based ones need 3 or more cycles.
  function notices(model, periodRecs) {
    const out = [];
    const recent = model.usable.slice(-6);
    if (recent.length >= 3) {
      const typical = U.mean(recent);
      if (typical < 24) out.push('Your cycles are usually shorter than 24 days.');
      if (typical > 38) out.push('Your cycles are usually longer than 38 days.');
      if (Math.max(...recent) - Math.min(...recent) > 9) out.push('Your shortest and longest recent cycles are more than 9 days apart.');
    }
    if (model.periods.slice(-6).some(p => p.days > 8)) out.push('A recent period lasted longer than 8 days.');
    const since = U.addDays(U.today(), -180);
    const rec = periodRecs.filter(r => !r.deleted && r.date >= since);
    if (rec.some(r => r.data.between)) out.push('You logged bleeding between periods.');
    if (rec.some(r => r.data.flow === 'vheavy' || r.data.clots === 'large' || r.data.hourly)) out.push('You logged very heavy flow, large clots or changing products every 1–2 hours.');
    return out;
  }

  // SPC §4.2 — C-PASS (Eisenlohr-Moul et al., 2017). Each frame is one period start n: the premenstrual week
  // n−7..n−1 (L) against the postmenstrual week after that same period, cycle days 4–10 (F). A DRSP item meets
  // criteria when L rises by ≥ 30% of the person's range of scale used, no F day is above 3, and ≥ 2 L days are ≥ 4.
  // A DSM symptom area meets criteria when any of its items does (C-PASS does not say how items combine).
  function pmdd(model, drspRecs, checkins = [], panics = []) {
    const byDate = new Map(drspRecs.filter(r => !r.deleted).map(r => [r.date, r.data]));
    let maxUsed = 1; // range of scale used = highest rating ever given on any item − 1
    for (const d of byDate.values()) for (const v of d.items || []) if (v > maxUsed) maxUsed = v;
    const range = maxUsed - 1;
    const item = (d, i) => byDate.get(d).items?.[i];
    const cycles = [];
    for (const p of model.periods) {
      const n = p.start;
      const Ld = U.dayRange(U.addDays(n, -7), U.addDays(n, -1)), Fd = U.dayRange(U.addDays(n, 3), U.addDays(n, 9));
      const Lg = Ld.filter(d => byDate.has(d)), Fg = Fd.filter(d => byDate.has(d));
      const cyc = { period: n, start: Ld[0], end: Fd[6], enough: Lg.length >= 3 && Fg.length >= 3, areas: {} };
      if (cyc.enough) {
        const items = C.DRSP.map((it, i) => {
          const l = Lg.map(d => item(d, i)).filter(v => v != null), f = Fg.map(d => item(d, i)).filter(v => v != null);
          const L = U.mean(l) ?? 0, F = U.mean(f) ?? 0;
          const meets = range > 0 && l.length > 0 && f.length > 0 && (L - F) / range >= 0.3 && Math.max(...f) <= 3 && l.filter(v => v >= 4).length >= 2;
          return { area: it.area, L, F, meets };
        });
        for (const a of C.PMDD_AREAS) {
          const its = items.filter(x => x.area === a.code);
          const best = its.reduce((x, y) => (y.L - y.F > x.L - x.F ? y : x));
          cyc.areas[a.code] = { L: U.round(best.L), F: U.round(best.F), elevated: its.some(x => x.meets) };
        }
        const elev = C.PMDD_AREAS.filter(a => cyc.areas[a.code].elevated);
        cyc.nElevated = elev.length;
        cyc.core = elev.some(a => a.core);
        cyc.match = elev.length >= 5 && cyc.core;
        cyc.mrmd = !cyc.match && elev.length >= 1; // C-PASS: 1–4 symptoms is a menstrually-related mood disorder pattern
        // DSM-5 dropped the impairment requirement, so C-PASS leaves these items out; shown as extra information only.
        cyc.impairDays = Lg.filter(d => Math.max(...(byDate.get(d).impair || [0])) >= 4).length;
      }
      // Anxiety cross-link: same windows on daily anxiety and panic attacks.
      const anx = days => U.mean(checkins.filter(c => days.includes(c.date) && c.data.anxiety != null).map(c => c.data.anxiety));
      const pan = days => panics.filter(p => days.includes(p.date)).length / 7;
      cyc.anxiety = { L: anx(Ld), F: anx(Fd), panicL: pan(Ld), panicF: pan(Fd) };
      cycles.push(cyc);
    }
    const full = cycles.filter(c => c.enough);
    return { cycles, full, matches: full.filter(c => c.match).length, ready: full.length >= 2, range };
  }

  return { periods, compute, phase, PHASES, notices, pmdd, BLEED };
})();
