// Form widgets, sheets, dialogs and toasts. Widgets edit a plain data object in place: widget(obj, key, ...).
const UI = (() => {
  const { h, s } = U;

  // --- icons (24 × 24 stroke paths) ---
  const ICONS = {
    today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    log: 'M12 5v14M5 12h14',
    cycle: 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z',
    insights: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    more: 'M4 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M10.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M17 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
    close: 'M6 6l12 12M18 6L6 18',
    back: 'M15 5l-7 7 7 7',
    leaf: 'M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l8-8',
    // one per log form, for the quick-log tiles
    checkin: 'M4 5h16v11H9l-5 4z',
    panic: 'M3 12h4l2-5 4 10 2-5h6',
    sleep: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    med: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7zM8.5 8.5l7 7',
    weekly: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    gad7: 'M8 4h8v3H8zM6 5H5v16h14V5h-1M8 12h8M8 16h5',
    period: 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z',
    drsp: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
    pain: 'M12 3a9 9 0 1 0 .01 0zM12 8v5M12 16h.01',
    meal: 'M3 11h18a9 9 0 0 1-18 0zM9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4',
    gi: 'M8 3v4a4 4 0 0 0 4 4 4 4 0 0 1 4 4v1a5 5 0 0 1-5 5H8',
    stool: 'M5 19h14M6.5 19c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5M9 14.5c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5M11 11c0-1.5.5-2.5 1.5-3.5',
    water: 'M6 3h12l-1.5 17a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1zM6.5 9h11',
    feedback: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  };
  ICONS.phq9 = ICONS.phq15 = ICONS.gad7;
  const icon = (name, cls) => s('svg', { viewBox: '0 0 24 24', class: 'ic ' + (cls || ''), 'aria-hidden': 'true' }, s('path', { d: ICONS[name] }));
  // A quick-log tile: coloured rounded square with the form's icon, label underneath.
  const tile = (type, label, onclick, extra) => h('button', { type: 'button', class: 'qbtn', onclick },
    h('span', { class: 'qi ' + type }, icon(type)), h('span', {}, label), extra || null);

  // --- layers: sheet (full-screen form), dialog, toast ---
  const layers = [];
  function sheet({ title, body, onSave, saveLabel = 'Save', onDelete, wide }) {
    const panel = h('div', { class: 'sheet' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const close = () => { panel.classList.remove('in'); setTimeout(() => panel.remove(), 200); layers.splice(layers.indexOf(close), 1); };
    const save = async () => {
      if (!onSave) return close();
      btn.disabled = true;
      try { if ((await onSave()) !== false) close(); } finally { btn.disabled = false; }
    };
    const btn = h('button', { class: 'primary', onclick: save }, saveLabel);
    panel.append(
      h('header', { class: 'sheet-head' },
        h('button', { class: 'ghost', onclick: close }, onSave ? 'Cancel' : 'Close'),
        h('h2', {}, title),
        onSave ? btn : h('span')),
      h('div', { class: 'sheet-body' }, body,
        onDelete ? h('div', { class: 'danger-zone' }, h('button', { class: 'danger', onclick: async () => {
          if (await confirm('Delete this entry?', 'It will also be removed from your other device after the next import.', 'Delete')) { await onDelete(); close(); }
        } }, 'Delete entry')) : null));
    document.body.append(panel);
    requestAnimationFrame(() => panel.classList.add('in'));
    layers.push(close);
    return close;
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && layers.length) layers[layers.length - 1](); });

  // Returns the value of the chosen button (or null when dismissed).
  function dialog(title, content, buttons) {
    return new Promise(res => {
      const back = h('div', { class: 'dlg-back' });
      const done = v => { back.remove(); layers.splice(layers.indexOf(closeFn), 1); res(v); };
      const closeFn = () => done(null);
      const box = h('div', { class: 'dlg', role: 'alertdialog', 'aria-modal': 'true' },
        h('h3', {}, title), typeof content === 'string' ? h('p', {}, content) : content,
        h('div', { class: 'dlg-btns' }, buttons.map(([label, value, cls]) => h('button', { class: cls || '', onclick: () => done(typeof value === 'function' ? value() : value) }, label))));
      back.append(box);
      back.addEventListener('click', e => { if (e.target === back) closeFn(); });
      document.body.append(back);
      layers.push(closeFn);
      const f = box.querySelector('input'); if (f) f.focus();
    });
  }
  const confirm = (title, text, ok = 'OK') => dialog(title, text, [['Cancel', false, 'ghost'], [ok, true, ok === 'Delete' ? 'danger' : 'primary']]);
  const alert = (title, text) => dialog(title, text, [['OK', true, 'primary']]);

  async function passphrase(title, text, twice) {
    const a = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Passphrase' });
    const b = twice ? h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Repeat passphrase' }) : null;
    const msg = h('p', { class: 'err' });
    for (;;) {
      const v = await dialog(title, h('div', { class: 'stack' }, h('p', {}, text), a, b, msg), [['Cancel', null, 'ghost'], ['Continue', () => a.value, 'primary']]);
      if (v == null) return null;
      if (twice && v.length < 8) msg.textContent = 'Use at least 8 characters.';
      else if (twice && v !== b.value) msg.textContent = 'The two passphrases do not match.';
      else if (!v) msg.textContent = 'Enter the passphrase.';
      else return v;
    }
  }

  function toast(text) {
    const t = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(t);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2600);
  }

  // --- form widgets ---
  const field = (label, control, hint) => h('div', { class: 'field' }, label ? h('label', { class: 'lbl' }, label) : null, control, hint ? h('p', { class: 'hint' }, hint) : null);
  const section = (title, ...kids) => h('section', { class: 'fs' }, title ? h('h3', {}, title) : null, ...kids);

  function slider(obj, key, label, { min = 0, max = 10, low, high, onInput } = {}) {
    const out = h('output', { class: 'val' }, obj[key] ?? '–');
    const inp = h('input', { type: 'range', min, max, step: 1, value: obj[key] ?? min, 'aria-label': label,
      class: obj[key] == null ? 'unset' : '',
      oninput: () => { obj[key] = +inp.value; out.textContent = inp.value; inp.classList.remove('unset'); onInput && onInput(); } });
    return h('div', { class: 'field slider' },
      h('div', { class: 'row' }, h('label', { class: 'lbl' }, label), out), inp,
      low || high ? h('div', { class: 'ends' }, h('span', {}, low || ''), h('span', {}, high || '')) : null);
  }

  function stepper(obj, key, label, { min = 0, max = 99, step = 1, unit = '' } = {}) {
    const out = h('output', { class: 'val' });
    const show = () => out.replaceChildren(String(obj[key] ?? 0), unit ? h('small', {}, ' ' + unit) : '');
    const go = d => { obj[key] = U.clamp((obj[key] ?? 0) + d, min, max); show(); };
    show();
    return h('div', { class: 'field stepper' }, h('label', { class: 'lbl' }, label),
      h('div', { class: 'step' }, h('button', { type: 'button', 'aria-label': 'Less', onclick: () => go(-step) }, '−'), out, h('button', { type: 'button', 'aria-label': 'More', onclick: () => go(step) }, '+')));
  }

  // Chips: options are [value, label] or {id, name}. multi → obj[key] is an array.
  function chips(obj, key, options, { multi, onChange, add } = {}) {
    const wrap = h('div', { class: 'chips', role: multi ? 'group' : 'radiogroup' });
    const norm = options.map(o => Array.isArray(o) ? { v: o[0], l: o[1] } : { v: o.id, l: o.name });
    const isOn = v => multi ? (obj[key] || []).includes(v) : obj[key] === v;
    function render() {
      wrap.replaceChildren(...norm.map(o => h('button', { type: 'button', class: 'chip' + (isOn(o.v) ? ' on' : ''), 'aria-pressed': String(isOn(o.v)), onclick: () => {
        if (multi) { const a = obj[key] = obj[key] || []; const i = a.indexOf(o.v); i >= 0 ? a.splice(i, 1) : a.push(o.v); }
        else obj[key] = isOn(o.v) ? null : o.v;
        render(); onChange && onChange();
      } }, o.l)), add ? h('button', { type: 'button', class: 'chip add', onclick: async () => {
        const item = await add();
        if (item) { norm.push({ v: item.id, l: item.name }); if (multi) (obj[key] = obj[key] || []).push(item.id); else obj[key] = item.id; render(); onChange && onChange(); }
      } }, '+ Add') : '');
    }
    render();
    return wrap;
  }
  const toggle = (obj, key, label, onChange) => h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', checked: !!obj[key], onchange: e => { obj[key] = e.target.checked; onChange && onChange(); } }), h('span', { class: 'track' }), h('span', {}, label));

  const input = (obj, key, attrs = {}) => h('input', { ...attrs, value: obj[key] ?? '', oninput: e => { obj[key] = attrs.type === 'number' ? (e.target.value === '' ? null : +e.target.value) : e.target.value; } });
  const textarea = (obj, key, placeholder) => h('textarea', { rows: 2, placeholder: placeholder || '', oninput: e => { obj[key] = e.target.value; } }, obj[key] || '');

  // A questionnaire item: the question and one button per answer (value = index).
  function scaleQ(arr, i, text, scale, { onChange, offset = 0, compact } = {}) {
    const wrap = h('div', { class: 'scaleq' + (compact ? ' compact' : '') });
    const render = () => wrap.replaceChildren(h('p', { class: 'q' }, text), h('div', { class: 'opts' },
      scale.map((l, v) => h('button', { type: 'button', class: arr[i] === v + offset ? 'on' : '', 'aria-pressed': String(arr[i] === v + offset), onclick: () => { arr[i] = v + offset; render(); onChange && onChange(); } },
        compact ? h('span', {}, v + offset) : null, h('span', { class: compact ? 'sr' : '' }, l)))));
    render();
    return wrap;
  }

  // Date and time row used at the top of most forms.
  const when = (rec, { time = true, label = 'When' } = {}) => h('div', { class: 'field when' }, h('label', { class: 'lbl' }, label),
    h('div', { class: 'row' }, input(rec, 'date', { type: 'date', max: U.addDays(U.today(), 1) }), time ? input(rec, 'time', { type: 'time' }) : null));

  // Ask for a name and save a new catalog item of `kind`.
  async function addCatalog(kind, extra) {
    const inp = h('input', { type: 'text', placeholder: 'Name' });
    const name = await dialog('Add ' + C.KINDS[kind].replace(/s$/, '').toLowerCase(), h('div', { class: 'stack' }, inp), [['Cancel', null, 'ghost'], ['Add', () => inp.value.trim(), 'primary']]);
    if (!name) return null;
    return M.catSave({ kind, name, ...(extra || {}) });
  }

  const card = (attrs, ...kids) => h('div', { ...attrs, class: 'card ' + (attrs?.class || '') }, ...kids);
  const pill = (text, cls) => h('span', { class: 'pill ' + (cls || '') }, text);
  const empty = text => h('p', { class: 'empty' }, text);

  return { icon, tile, sheet, dialog, confirm, alert, passphrase, toast, field, section, slider, stepper, chips, toggle, input, textarea, scaleQ, when, addCatalog, card, pill, empty, layers };
})();
