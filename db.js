// IndexedDB persistence. `records` and `catalog` sync between devices; `kv` holds this device's settings.
const DB = (() => {
  const NAME = 'health-tracker';
  const STORES = ['kv', 'records', 'catalog'];
  let db;

  function open(name = NAME) {
    return new Promise((res, rej) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) {
          const os = d.createObjectStore(s, { keyPath: 'id' });
          if (s === 'records') os.createIndex('type_date', ['type', 'date']);
        }
      };
      r.onsuccess = () => { db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  }

  function run(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
    });
  }

  const all = store => run(store, 'readonly', s => s.getAll());
  const get = (store, id) => run(store, 'readonly', s => s.get(id));
  // Records are deep-copied so later edits to the in-memory object never race a pending write.
  const put = (store, rec) => run(store, 'readwrite', s => s.put(JSON.parse(JSON.stringify(rec))));
  const del = (store, id) => run(store, 'readwrite', s => s.delete(id));
  const clear = store => run(store, 'readwrite', s => s.clear());
  // Writes many records in one transaction (used by import).
  const putMany = (store, recs) => run(store, 'readwrite', s => { for (const r of recs) s.put(JSON.parse(JSON.stringify(r))); });

  return { open, all, get, put, putMany, del, clear, STORES };
})();
