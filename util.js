// Small helpers shared by the rest of the app: DOM building, ids, dates and statistics.
const U = (() => {
  const SVGNS = 'http://www.w3.org/2000/svg';

  function setAttrs(el, attrs, isSvg) {
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (!isSvg && (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled')) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k instanceof Node ? k : String(k));
    }
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    setAttrs(el, attrs, false);
    append(el, kids);
    return el;
  }
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    setAttrs(el, attrs, true);
    append(el, kids);
    return el;
  }

  // IDs must be unique across devices, so use a real UUID.
  const uid = () => (crypto.randomUUID ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const round = (n, d = 1) => { const f = 10 ** d; return Math.round(n * f) / f; };
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const norm = t => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const esc = t => String(t ?? '');

  // --- dates: stored as local 'YYYY-MM-DD' and 'HH:MM' ---
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = () => ymd(new Date());
  const nowTime = () => hm(new Date());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5); // a − b
  const ts = (date, time) => new Date(date + 'T' + (time || '12:00')).getTime();
  const mins = t => { if (!t) return null; const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  const dayRange = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmtDate = (s, withDay) => { if (!s) return ''; const d = parse(s); return (withDay ? DAYS[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
  const fmtLong = s => { const d = parse(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const fmtMins = m => m == null || !isFinite(m) ? '–' : `${Math.floor(m / 60)}h ${pad(Math.round(m % 60))}m`;

  // --- statistics ---
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => a.length ? sum(a) / a.length : null;
  const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / (a.length - 1)); };
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

  function download(filename, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' });
    const a = h('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  // On iPhone the share sheet is the way to get a file out (AirDrop, Save to Files); fall back to a download.
  async function saveFile(filename, data, type) {
    const file = new File([data], filename, { type: type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
      catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
    }
    download(filename, file, type);
    return 'downloaded';
  }
  function pickFile(accept) {
    return new Promise(res => {
      const inp = h('input', { type: 'file', accept: accept || null, hidden: true });
      inp.onchange = () => { res(inp.files[0] || null); inp.remove(); };
      inp.addEventListener('cancel', () => { res(null); inp.remove(); });
      document.body.append(inp);
      inp.click();
    });
  }

  return { h, s, uid, num, round, clamp, debounce, norm, esc, pad, ymd, hm, today, nowTime, parse, addDays, diffDays, ts, mins, dayRange,
    fmtDate, fmtLong, fmtMins, MONTHS, DAYS, sum, mean, sd, pct, download, saveFile, pickFile };
})();
