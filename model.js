// In-memory model over IndexedDB. Every record and catalog item carries id, updatedAt and deviceId so two devices can merge.
const M = (() => {
  const state = { records: new Map(), catalog: new Map(), settings: null };
  const listeners = [];
  const DEFAULTS = {
    deviceName: /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : 'Desktop',
    modules: { mind: true, cycle: true, food: true },
    schedule: { gad7: 14, phq9: 14, phq15: 30, weekly: 7 },
    gadTicks: false, drspMode: 'daily', lateMeal: '20:30', theme: 'auto', lastExport: null,
  };

  async function load() {
    for (const r of await DB.all('records')) state.records.set(r.id, r);
    for (const c of await DB.all('catalog')) state.catalog.set(c.id, c);
    const s = await DB.get('kv', 'settings');
    state.settings = { ...DEFAULTS, ...(s ? s.value : {}) };
    state.settings.modules = { ...DEFAULTS.modules, ...state.settings.modules };
    state.settings.schedule = { ...DEFAULTS.schedule, ...state.settings.schedule };
    if (!state.settings.deviceId) { state.settings.deviceId = U.uid(); await saveSettings(); }
  }
  const onChange = fn => listeners.push(fn);
  const changed = () => listeners.forEach(fn => fn());

  const settings = () => state.settings;
  async function saveSettings(patch) {
    Object.assign(state.settings, patch || {});
    await DB.put('kv', { id: 'settings', value: state.settings });
  }
  const stamp = rec => Object.assign(rec, { updatedAt: new Date().toISOString(), deviceId: state.settings.deviceId });

  // --- records ---
  const byWhen = (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
  function recs(type, from, to) {
    const out = [];
    for (const r of state.records.values()) {
      if (r.deleted || (type && (Array.isArray(type) ? !type.includes(r.type) : r.type !== type))) continue;
      if ((from && r.date < from) || (to && r.date > to)) continue;
      out.push(r);
    }
    return out.sort(byWhen);
  }
  const one = (type, date) => recs(type, date, date)[0] || null;
  const last = type => { const a = recs(type); return a[a.length - 1] || null; };
  const get = id => state.records.get(id);

  async function save(type, date, time, data, id) {
    const old = id ? state.records.get(id) : null;
    const rec = old ? { ...old, date, time, data } : { id: U.uid(), type, date, time, data, createdAt: new Date().toISOString(), deleted: false };
    stamp(rec);
    state.records.set(rec.id, rec);
    await DB.put('records', rec);
    changed();
    return rec;
  }
  // Deletions are tombstones so they travel to the other device.
  async function remove(id) {
    const r = state.records.get(id);
    if (!r) return;
    const t = stamp({ id: r.id, type: r.type, date: r.date, time: r.time, data: {}, createdAt: r.createdAt, deleted: true });
    state.records.set(id, t);
    await DB.put('records', t);
    changed();
  }

  // --- catalog: built-in items from C plus the user's own; a stored item with a built-in id only carries `hidden` ---
  function catalog(kind, withHidden) {
    const out = [];
    for (const b of C.BUILTIN) if (b.kind === kind) {
      const o = state.catalog.get(b.id);
      const item = { ...b, hidden: !!(o && o.hidden), order: o ? o.order : undefined };
      if (withHidden || !item.hidden) out.push(item);
    }
    for (const c of state.catalog.values()) if (c.kind === kind && !c.builtin && !c.deleted && (withHidden || !c.hidden)) out.push(c);
    return out.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }
  const catItem = id => { const b = C.BUILTIN.find(x => x.id === id); return b ? { ...b, ...state.catalog.get(id) } : state.catalog.get(id); };
  const catName = id => { const c = catItem(id); return c ? c.name : '(removed)'; };
  async function catSave(item) {
    const isBuiltin = C.BUILTIN.some(b => b.id === item.id);
    const rec = isBuiltin ? { id: item.id, kind: item.kind, builtin: true, hidden: !!item.hidden, order: item.order }
      : { deleted: false, hidden: false, ...item, id: item.id || U.uid(), builtin: false };
    stamp(rec);
    state.catalog.set(rec.id, rec);
    await DB.put('catalog', rec);
    changed();
    return rec;
  }
  async function catRemove(id) {
    const c = state.catalog.get(id);
    if (!c || c.builtin) return;
    const t = stamp({ ...c, deleted: true });
    state.catalog.set(id, t);
    await DB.put('catalog', t);
    changed();
  }

  // Everything that syncs (records and catalog, including tombstones).
  const syncable = () => ({ records: [...state.records.values()], catalog: [...state.catalog.values()] });
  async function putSynced(records, catalog) {
    for (const r of records) state.records.set(r.id, r);
    for (const c of catalog) state.catalog.set(c.id, c);
    if (records.length) await DB.putMany('records', records);
    if (catalog.length) await DB.putMany('catalog', catalog);
    changed();
  }
  async function wipe() {
    state.records.clear(); state.catalog.clear();
    await DB.clear('records'); await DB.clear('catalog');
    changed();
  }

  return { state, load, onChange, changed, settings, saveSettings, recs, one, last, get, save, remove,
    catalog, catItem, catName, catSave, catRemove, syncable, putSynced, wipe };
})();
