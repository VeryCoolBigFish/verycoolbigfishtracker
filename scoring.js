// Scoring rules from TL002-SPC-001: questionnaire totals and bands, panic classification, sleep diary maths.
const Score = (() => {
  // Total of answered items; null when any item is unanswered.
  function total(key, answers) {
    const q = C.Q[key];
    if (!answers || answers.length < q.items.length || answers.some(a => a == null)) return null;
    return answers.reduce((x, y) => x + y, 0);
  }
  function band(key, score) {
    if (score == null) return null;
    const bands = C.Q[key].bands;
    let b = bands[0];
    for (const x of bands) if (score >= x[0]) b = x;
    const i = bands.indexOf(b);
    return { label: b[1], text: b[2], level: i, of: bands.length };
  }
  // PHQ-9 item 9 above 0 opens the support card.
  const needsSupport = (key, answers) => !!C.Q[key].safetyItem && (answers?.[C.Q[key].safetyItem] || 0) > 0;

  // SPC §3.2 — 4 or more symptoms is a full attack, 1–3 a limited-symptom attack.
  function panicClass(symptoms) {
    const n = (symptoms || []).length;
    return n >= 4 ? { kind: 'full', label: `Full attack (${n} symptoms)`, n } : n > 0 ? { kind: 'limited', label: `Limited-symptom attack (${n})`, n } : { kind: 'none', label: 'No symptoms ticked', n: 0 };
  }

  // SPC §6 — times run bed ≤ try ≤ final wake ≤ out of bed, each wrapping past midnight when needed.
  function sleep(d) {
    const seq = [d.bed, d.tryAt, d.wake, d.up].map(U.mins);
    if (seq.some(v => v == null)) return null;
    for (let i = 1; i < 4; i++) while (seq[i] < seq[i - 1]) seq[i] += 1440;
    const sol = U.num(d.sol), waso = U.num(d.waso);
    const tib = seq[3] - seq[0];
    const tst = Math.max(0, seq[2] - seq[1] - sol - waso);
    const se = tib > 0 ? Math.min(100, (tst / tib) * 100) : null;
    return { tib, tst, sol, waso, se: se == null ? null : U.round(se, 0), poorSE: se != null && se < 85, longSOL: sol > 30, longWASO: waso > 30 };
  }

  return { total, band, needsSupport, panicClass, sleep };
})();
