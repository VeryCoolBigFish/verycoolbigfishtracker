// More tab: backup and sync, personalisation, list editor, support, learn, about and privacy (REQ G-06, S-01 to S-07, P-01 to P-04).
const Settings = (() => {
  const { h } = U;

  // --- backup and sync ---
  async function exportFlow() {
    const pass = await UI.passphrase('Encrypted export',
      'Choose a passphrase. You will need it to open this file on your other device. It cannot be recovered if you forget it.', true);
    if (!pass) return;
    UI.toast('Encrypting…');
    try {
      const how = await Sync.exportFile(pass);
      if (how !== 'cancelled') UI.toast(how === 'shared' ? 'Export shared' : 'Export saved');
      App.render();
    } catch (e) { UI.alert('Export failed', String(e.message || e)); }
  }

  async function importFlow() {
    const file = await U.pickFile();
    if (!file) return;
    const pass = await UI.passphrase('Import', `Enter the passphrase used when “${file.name}” was exported.`);
    if (!pass) return;
    let res;
    try { res = await Sync.readFile(await file.text(), pass); }
    catch (e) { return UI.alert('Could not import', String(e.message || e)); }

    const rows = Sync.summary(res.records);
    const cat = res.catalog.add.length + res.catalog.update.length + res.catalog.del.length;
    const changes = Object.keys(rows).length + cat;
    const from = `From ${res.env.deviceName || 'another device'}, exported ${U.fmtLong(U.ymd(new Date(res.env.exportedAt)))}.`;
    if (!changes) return UI.alert('Nothing new', `${from} Everything in this file is already on this device.`);

    UI.sheet({
      title: 'Import preview', saveLabel: 'Merge',
      body: h('div', { class: 'form' },
        h('p', { class: 'lead' }, from),
        Object.keys(rows).length ? h('div', { class: 'tablewrap' }, h('table', { class: 'preview' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Type'), h('th', {}, 'New'), h('th', {}, 'Updated'), h('th', {}, 'Deleted'))),
          h('tbody', {}, Object.entries(rows).map(([type, n]) => h('tr', {}, h('th', {}, Forms.label(type)), h('td', {}, n.new), h('td', {}, n.updated), h('td', {}, n.deleted)))))) : null,
        cat ? h('p', {}, `${cat} change${cat === 1 ? '' : 's'} to your lists (foods, tags, medications and so on).`) : null,
        h('p', { class: 'hint' }, `${res.records.same + res.catalog.same} unchanged.` + (res.records.older + res.catalog.older ? ` ${res.records.older + res.catalog.older} older cop${res.records.older + res.catalog.older === 1 ? 'y' : 'ies'} skipped (this device has a newer version).` : '')),
        h('p', { class: 'hint' }, 'Merging adds and updates entries. Nothing on this device is replaced by an older version.')),
      onSave: async () => { await Sync.apply(res); UI.toast('Imported'); },
    });
  }

  async function csvFlow() {
    if (!(await UI.confirm('CSV is not encrypted', 'A CSV file can be read by anyone who has it. Use it for spreadsheets or to share with a clinician, and delete it when you’re done.', 'Continue'))) return;
    const types = Object.keys(Forms.defs).map(t => [t, Forms.label(t)]);
    const o = { type: types[0][0], range: 90 };
    UI.sheet({
      title: 'CSV export', saveLabel: 'Export CSV',
      body: h('div', { class: 'form' },
        UI.field('What', UI.chips(o, 'type', types)),
        UI.field('Range', UI.chips(o, 'range', [[30, '30 days'], [90, '90 days'], [365, '1 year'], [0, 'All']]))),
      onSave: async () => {
        if (!o.type) { UI.toast('Choose what to export.'); return false; }
        const from = o.range ? U.addDays(U.today(), -o.range + 1) : null;
        await U.saveFile(`healthtracker-${o.type}-${U.today()}.csv`, Sync.csv(o.type, from, null), 'text/csv');
      },
    });
  }

  function backupCard() {
    const s = M.settings();
    const d = { deviceName: s.deviceName };
    const ago = s.lastExport ? U.diffDays(U.today(), U.ymd(new Date(s.lastExport))) : null;
    return UI.card({ class: 'set' }, h('h3', {}, 'Backup & sync'),
      h('p', {}, s.lastExport ? `Last export: ${U.fmtLong(U.ymd(new Date(s.lastExport)))} (${ago === 0 ? 'today' : ago + ' day' + (ago === 1 ? '' : 's') + ' ago'})` : 'Last export: never'),
      UI.field('This device’s name', UI.input(d, 'deviceName', { type: 'text', onchange: () => M.saveSettings({ deviceName: d.deviceName.trim() || 'Device' }) }),
        'Shown on the other device when you import this device’s export.'),
      h('div', { class: 'btnrow' },
        h('button', { class: 'primary', onclick: exportFlow }, 'Export (encrypted)'),
        h('button', { class: 'ghost', onclick: importFlow }, 'Import'),
        h('button', { class: 'ghost', onclick: csvFlow }, 'CSV export')),
      h('p', { class: 'hint' }, 'To sync: export on one device, move the file yourself (AirDrop, Files, USB), then import on the other. Import merges, and the newest version of each entry wins. Do the same in the other direction to bring both devices level.'));
  }

  // --- personalise ---
  function personaliseCard() {
    const s = M.settings();
    const mods = { ...s.modules };
    const sch = { ...s.schedule };
    const o = { gadTicks: s.gadTicks, drspMode: s.drspMode, lateMeal: s.lateMeal, theme: s.theme };
    const saveMods = async () => { await M.saveSettings({ modules: { ...mods } }); App.render(); };
    const saveSch = async () => { for (const k in sch) if (sch[k] == null) sch[k] = 0; await M.saveSettings({ schedule: { ...sch } }); App.render(); };
    const SCH = [[0, 'Off'], [7, 'Weekly'], [14, 'Fortnightly'], [30, 'Monthly']];
    return UI.card({ class: 'set' }, h('h3', {}, 'Personalise'),
      UI.section('Modules',
        UI.toggle(mods, 'mind', 'Mind & sleep', saveMods), UI.toggle(mods, 'cycle', 'Cycle & women’s health', saveMods), UI.toggle(mods, 'food', 'Food & gut', saveMods)),
      UI.section('Check-in schedules',
        [['gad7', 'GAD-7 anxiety check'], ['phq9', 'PHQ-9 mood check'], ['phq15', 'PHQ-15 body symptoms'], ['weekly', 'Weekly panic check']]
          .map(([k, l]) => UI.field(l, UI.chips(sch, k, SCH, { onChange: saveSch })))),
      UI.section('Daily check-in',
        UI.toggle(o, 'gadTicks', 'Add the 6 anxiety symptom ticks (GAD) to the daily check-in', () => M.saveSettings({ gadTicks: o.gadTicks }))),
      UI.section('Cycle',
        UI.field('Ask for the DRSP', UI.chips(o, 'drspMode', [['daily', 'Every day'], ['luteal', 'Premenstrual week only']], { onChange: () => M.saveSettings({ drspMode: o.drspMode || 'daily' }).then(App.render) }),
          'Every day gives the most reliable PMDD pattern, because it compares the week before your period with the days after.')),
      UI.section('Food',
        UI.field('Late meal after', UI.input(o, 'lateMeal', { type: 'time', onchange: () => M.saveSettings({ lateMeal: o.lateMeal || '20:30' }) }),
          'Meals logged after this time get the “Late meal” tag automatically.')),
      UI.section('Appearance',
        UI.field('Theme', UI.chips(o, 'theme', [['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']], { onChange: async () => { await M.saveSettings({ theme: o.theme || 'auto' }); App.applyTheme(); } }))),
      UI.section('Your lists', h('p', { class: 'hint' }, 'Add your own items, hide built-in ones you don’t use, and change the order. Built-in clinical items can be hidden but not reworded.'),
        h('div', { class: 'listbtns' }, Object.entries(C.KINDS).map(([kind, label]) => h('button', { class: 'ghost', onclick: () => listEditor(kind) }, label)))));
  }

  // --- list editor ---
  async function editItem(it) {
    const o = { name: it.name || '', phone: it.phone || '', tags: [...(it.tags || [])] };
    const content = h('div', { class: 'stack' },
      UI.input(o, 'name', { type: 'text', placeholder: 'Name' }),
      it.kind === 'contact' ? UI.input(o, 'phone', { type: 'tel', placeholder: 'Phone' }) : null,
      it.kind === 'food' ? [h('p', { class: 'hint' }, 'Default tags, added automatically when you log this food:'), UI.chips(o, 'tags', M.catalog('tag'), { multi: true })] : null);
    const ok = await UI.dialog(it.id ? 'Edit' : 'Add ' + C.KINDS[it.kind].replace(/s$/, '').toLowerCase(), content, [['Cancel', false, 'ghost'], ['Save', true, 'primary']]);
    if (!ok || !o.name.trim()) return null;
    const patch = { ...it, name: o.name.trim() };
    if (it.kind === 'contact') patch.phone = o.phone.trim();
    if (it.kind === 'food') patch.tags = o.tags;
    return M.catSave(patch);
  }

  function listEditor(kind) {
    const wrap = h('div', { class: 'form' });
    async function move(items, i, d) {
      const j = i + d;
      if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]];
      for (let k = 0; k < items.length; k++) if (items[k].order !== k) await M.catSave({ ...items[k], order: k });
      draw();
    }
    function draw() {
      const items = M.catalog(kind, true);
      wrap.replaceChildren(
        items.length ? h('ul', { class: 'edlist' }, items.map((it, i) => h('li', { class: it.hidden ? 'off' : '' },
          h('span', { class: 'nm' }, it.name,
            it.hint ? h('small', {}, it.hint) : null,
            kind === 'food' && it.tags && it.tags.length ? h('small', {}, it.tags.map(M.catName).join(', ')) : null,
            kind === 'contact' && it.phone ? h('small', {}, it.phone) : null,
            it.hidden ? h('small', {}, 'Hidden') : null),
          h('span', { class: 'acts' },
            h('button', { class: 'ghost small', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(items, i, -1) }, '↑'),
            h('button', { class: 'ghost small', 'aria-label': 'Move down', disabled: i === items.length - 1, onclick: () => move(items, i, 1) }, '↓'),
            it.builtin
              ? h('button', { class: 'ghost small', onclick: async () => { await M.catSave({ ...it, hidden: !it.hidden }); draw(); } }, it.hidden ? 'Show' : 'Hide')
              : [h('button', { class: 'ghost small', onclick: async () => { if (await editItem(it)) draw(); } }, 'Edit'),
                h('button', { class: 'ghost small danger', onclick: async () => {
                  if (await UI.confirm(`Delete “${it.name}”?`, 'Past entries that use it keep their record.', 'Delete')) { await M.catRemove(it.id); draw(); }
                } }, 'Delete')])))) : UI.empty('Nothing here yet.'),
        h('button', { class: 'primary', onclick: async () => {
          const it = kind === 'food' || kind === 'contact' ? await editItem({ kind }) : await UI.addCatalog(kind);
          if (it) draw();
        } }, '+ Add'));
    }
    draw();
    UI.sheet({ title: C.KINDS[kind], body: wrap });
  }

  // --- learn, about ---
  function learnCard() {
    return UI.card({ class: 'set learn' }, h('h3', {}, 'Learn'),
      C.LEARN.map(([t, txt]) => h('details', {}, h('summary', {}, t), h('p', {}, txt))),
      h('p', { class: 'hint' }, 'Criteria are reworded in plain English from DSM-5-TR, Rome IV and FIGO 2018. They are a guide to what clinicians look for, not a way to diagnose yourself.'));
  }

  function aboutCard() {
    const persist = h('span', {}, 'Checking…'), usage = h('span', {}, '–');
    const askBtn = h('button', { class: 'ghost small', hidden: true, onclick: async () => {
      const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false;
      UI.toast(ok ? 'Storage is now persistent' : 'The browser declined. Keep exporting regularly.');
      App.render();
    } }, 'Ask the browser to keep it');
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => {
      persist.textContent = p ? 'Persistent: the browser won’t clear it on its own' : 'Not persistent: export regularly';
      askBtn.hidden = p;
    }); else persist.textContent = 'Unknown';
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { usage.textContent = `${U.round((e.usage || 0) / 1048576, 1)} MB used`; });
    const count = M.recs().length;

    return UI.card({ class: 'set about' }, h('h3', {}, 'About & privacy'),
      h('dl', { class: 'stats' },
        h('dt', {}, 'Version'), h('dd', {}, App.VERSION),
        h('dt', {}, 'Entries'), h('dd', {}, count),
        h('dt', {}, 'Storage'), h('dd', {}, persist, ' ', askBtn),
        h('dt', {}, 'Space'), h('dd', {}, usage)),
      h('p', {}, 'Your data stays on this device. The app makes no network connections and has no accounts, analytics or cloud. The only way data leaves is an export file that you create and move yourself. Exports are encrypted with your passphrase. CSV exports are not.'),
      h('p', { class: 'notdx' }, C.NOT_DX),
      h('div', { class: 'danger-zone' },
        h('button', { class: 'danger', onclick: eraseFlow }, 'Erase all data on this device'),
        h('p', { class: 'hint' }, 'Settings stay. Export first if you want to keep anything.')));
  }

  async function eraseFlow() {
    const inp = h('input', { type: 'text', placeholder: 'Type ERASE', autocomplete: 'off', autocapitalize: 'characters' });
    const v = await UI.dialog('Erase all data?', h('div', { class: 'stack' },
      h('p', {}, 'This removes every entry and your own lists from this device. It cannot be undone. Your other device is not affected.'), inp),
      [['Cancel', null, 'ghost'], ['Erase', () => inp.value.trim(), 'danger']]);
    if (v == null) return;
    if (v !== 'ERASE') return UI.alert('Not erased', 'You need to type ERASE exactly.');
    await M.wipe();
    UI.toast('All data erased');
    App.render();
  }

  function screen() {
    return [
      backupCard(),
      UI.card({ class: 'set support-card' }, h('h3', {}, 'Support'),
        h('p', {}, 'Crisis lines and your own support contacts, available at any time.'),
        h('button', { class: 'primary', onclick: () => Mind.support() }, 'Open support card')),
      Feedback.card(),
      personaliseCard(),
      learnCard(),
      aboutCard(),
    ];
  }

  return { screen, exportFlow, importFlow, csvFlow, listEditor };
})();
