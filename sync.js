// Export, import and merge between devices (REQ S-01 to S-08), plus plain CSV export.
const Sync = (() => {
  const APP = 'HealthTracker', SCHEMA = 1;

  // Compare incoming items with local ones by id; the newer updatedAt wins. Pure, so it can be unit-tested.
  function plan(local, incoming) {
    const byId = new Map(local.map(x => [x.id, x]));
    const out = { add: [], update: [], del: [], same: 0, older: 0 };
    for (const inc of incoming) {
      const cur = byId.get(inc.id);
      if (!cur) { (inc.deleted ? out.del : out.add).push(inc); continue; }
      if (inc.updatedAt > cur.updatedAt) (inc.deleted && !cur.deleted ? out.del : out.update).push(inc);
      else if (inc.updatedAt === cur.updatedAt) out.same++;
      else out.older++;
    }
    return out;
  }
  // A brand-new tombstone (record never seen here) is still stored, so a later older copy cannot bring it back.
  const toWrite = p => [...p.add, ...p.update, ...p.del];

  async function buildExport(pass) {
    const s = M.settings();
    const meta = { app: APP, schema: SCHEMA, exportedAt: new Date().toISOString(), deviceId: s.deviceId, deviceName: s.deviceName };
    return Crypt.encrypt({ ...M.syncable(), schema: SCHEMA }, pass, meta);
  }
  async function exportFile(pass) {
    const env = await buildExport(pass);
    const name = `healthtracker-${U.norm(M.settings().deviceName).replace(/[^a-z0-9]+/g, '-')}-${U.today()}.htrk`;
    const how = await U.saveFile(name, JSON.stringify(env), 'application/json'); // iOS shares known types more reliably
    if (how !== 'cancelled') await M.saveSettings({ lastExport: new Date().toISOString() });
    return how;
  }

  async function readFile(text, pass) {
    let env;
    try { env = JSON.parse(text); } catch { throw new Error('This is not a Health Tracker export file.'); }
    if (env.app !== APP) throw new Error('This is not a Health Tracker export file.');
    if (env.schema > SCHEMA) throw new Error('This file was made by a newer version of the app. Update the app on this device first.');
    const data = await Crypt.decrypt(env, pass);
    const s = M.state;
    return {
      env, data,
      records: plan([...s.records.values()], data.records || []),
      catalog: plan([...s.catalog.values()], data.catalog || []),
    };
  }
  // Counts by record type for the preview screen.
  function summary(p) {
    const rows = {};
    for (const [k, list] of [['new', p.add], ['updated', p.update], ['deleted', p.del]])
      for (const r of list) { const t = r.type || r.kind; rows[t] = rows[t] || { new: 0, updated: 0, deleted: 0 }; rows[t][k]++; }
    return rows;
  }
  async function apply(res) {
    await M.putSynced(toWrite(res.records), toWrite(res.catalog));
  }

  // --- CSV (unencrypted) ---
  function flat(obj, pre = '', out = {}) {
    for (const [k, v] of Object.entries(obj || {})) {
      const key = pre + k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key + '.', out);
      else out[key] = Array.isArray(v) ? v.map(x => (typeof x === 'string' && x.includes(':') ? M.catName(x) : x)).join('; ') : v;
    }
    return out;
  }
  function csv(type, from, to) {
    const rows = M.recs(type, from, to).map(r => ({ date: r.date, time: r.time || '', ...flat(r.data) }));
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const q = v => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n');
  }

  return { APP, SCHEMA, plan, toWrite, buildExport, exportFile, readFile, summary, apply, csv };
})();
