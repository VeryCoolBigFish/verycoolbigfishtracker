// Registry of log forms. Each module registers its record types with a label, module, form builder and one-line summary.
const Forms = (() => {
  const defs = {};
  const register = (type, def) => { defs[type] = { type, ...def }; };
  const enabled = type => { const d = defs[type]; return d && M.settings().modules[d.module] !== false; };

  // Opens the form for a new record, or for `rec`. Forms marked `single` edit the existing record for that day instead of adding another.
  function open(type, rec, date) {
    const def = defs[type];
    if (!rec && def.single) rec = M.one(type, date || U.today());
    const meta = { date: rec ? rec.date : (date || U.today()), time: rec ? rec.time : (def.time === false ? null : U.nowTime()) };
    const d = rec ? JSON.parse(JSON.stringify(rec.data)) : JSON.parse(JSON.stringify(def.defaults || {}));
    const body = U.h('div', { class: 'form' }, def.build(d, meta, rec));
    UI.sheet({
      title: (rec ? 'Edit · ' : '') + def.label, body,
      onSave: async () => {
        const err = def.validate && def.validate(d, meta);
        if (err) { UI.toast(err); return false; }
        if (def.beforeSave) def.beforeSave(d, meta);
        if (def.single && !rec) {
          const other = M.one(type, meta.date);
          if (other) rec = other; // the day already has one: overwrite rather than duplicate
        }
        const saved = await M.save(type, meta.date, meta.time, d, rec && rec.id);
        if (def.afterSave) setTimeout(() => def.afterSave(saved), 250);
        else UI.toast('Saved');
      },
      onDelete: rec ? () => M.remove(rec.id) : null,
    });
  }
  const summary = rec => (defs[rec.type] && defs[rec.type].summary ? defs[rec.type].summary(rec.data, rec) : '');
  const label = type => defs[type] ? defs[type].label : type;

  return { defs, register, enabled, open, summary, label };
})();
