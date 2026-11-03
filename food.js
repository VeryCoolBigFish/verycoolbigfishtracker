// Food and GI: meal log, GI symptoms, bowel motions (Bristol) and water (SPC §7).
const Food = (() => {
  const { h, s } = U;

  // Foods from recent meals, newest first: Map of id → rank.
  function recentFoods() {
    const seen = new Map();
    const meals = M.recs('meal');
    for (let i = meals.length - 1; i >= 0 && seen.size < 40; i--)
      for (const f of meals[i].data.foods || []) if (!seen.has(f)) seen.set(f, seen.size);
    return seen;
  }

  // Search box plus food chips: selected first, then recent, then A–Z. Picking a food adds its usual tags to the meal.
  function foodPicker(d, onChange) {
    const q = { text: '' };
    const list = h('div', { class: 'chips food-list' });
    const search = h('input', { type: 'search', class: 'food-search', placeholder: 'Search your foods', 'aria-label': 'Search your foods',
      oninput: e => { q.text = U.norm(e.target.value); draw(); } });
    const toggle = f => {
      const i = d.foods.indexOf(f.id);
      if (i >= 0) d.foods.splice(i, 1);
      else { d.foods.push(f.id); for (const t of f.tags || []) if (!d.tags.includes(t)) d.tags.push(t); }
      draw(); onChange();
    };
    async function addFood() {
      const item = { name: search.value.trim(), tags: [] };
      const tags = M.catalog('tag').filter(t => t.id !== 'tag:late' && t.id !== 'tag:large');
      const ok = await UI.dialog('Add a food', h('div', { class: 'stack' },
        UI.input(item, 'name', { type: 'text', placeholder: 'Food name' }),
        h('p', { class: 'hint' }, 'Usual tags for this food. You can change them for each meal. The Monash University FODMAP app is the best guide to FODMAP content.'),
        UI.chips(item, 'tags', tags, { multi: true })), [['Cancel', false, 'ghost'], ['Add', true, 'primary']]);
      if (!ok || !item.name.trim()) return;
      const f = await M.catSave({ kind: 'food', name: item.name.trim(), tags: item.tags });
      search.value = ''; q.text = '';
      toggle(f);
    }
    function draw() {
      const rec = recentFoods();
      let foods = M.catalog('food');
      if (q.text) foods = foods.filter(f => U.norm(f.name).includes(q.text));
      foods.sort((a, b) => (d.foods.includes(b.id) - d.foods.includes(a.id)) || ((rec.get(a.id) ?? 1e9) - (rec.get(b.id) ?? 1e9)) || a.name.localeCompare(b.name));
      const shown = q.text ? foods : foods.slice(0, Math.max(24, d.foods.length));
      list.replaceChildren(
        ...shown.map(f => { const on = d.foods.includes(f.id); return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: () => toggle(f) }, f.name); }),
        h('button', { type: 'button', class: 'chip add', onclick: addFood }, q.text ? `+ Add “${search.value.trim()}”` : '+ Add food'));
    }
    draw();
    return h('div', { class: 'food-picker' }, search, list,
      M.catalog('food').length ? null : h('p', { class: 'hint' }, 'Add the foods you eat once, with their usual tags; they are reused from then on.'));
  }

  const guessMeal = t => { const m = U.mins(t || U.nowTime()); return m < 630 ? 'Breakfast' : m < 900 ? 'Lunch' : m < 1260 ? 'Dinner' : 'Snack'; };

  // --- meal (SPC §7.1–7.2) ---
  Forms.register('meal', {
    label: 'Meal', module: 'food',
    defaults: { foods: [], portion: 'usual', tags: [] },
    build(d, meta, rec) {
      if (!rec && !d.meal) d.meal = guessMeal(meta.time);
      const tagWrap = h('div');
      const drawTags = () => tagWrap.replaceChildren(UI.chips(d, 'tags', M.catalog('tag'), { multi: true, add: () => UI.addCatalog('tag') }));
      drawTags();
      return [
        UI.when(meta),
        UI.field('Meal', UI.chips(d, 'meal', C.MEAL_TYPES.map(t => [t, t]))),
        UI.section('Foods', foodPicker(d, drawTags)),
        UI.field('Portion', UI.chips(d, 'portion', C.PORTION)),
        UI.field('Tags', tagWrap, 'Filled in from each food’s usual tags. Untick any that don’t apply this time.'),
        UI.field('Note', UI.textarea(d, 'note')),
      ];
    },
    validate: d => !d.foods.length && !U.norm(d.note) ? 'Add at least one food (or a note).' : null,
    beforeSave(d, meta) {
      const late = meta.time && meta.time >= M.settings().lateMeal;
      d.tags = d.tags.filter(t => t !== 'tag:late');
      if (late) d.tags.push('tag:late');
      if (d.portion === 'large' && !d.tags.includes('tag:large')) d.tags.push('tag:large');
    },
    summary: d => [d.meal, (d.foods || []).map(M.catName).join(', ')].filter(Boolean).join(' · '),
  });

  // --- GI symptoms (SPC §7.3) ---
  Forms.register('gi', {
    label: 'GI symptoms', module: 'food',
    defaults: { sym: {} },
    build(d, meta) {
      d.sym = d.sym || {};
      const list = h('div');
      const draw = () => list.replaceChildren(
        ...M.catalog('gisym').map(g => UI.slider(d.sym, g.id, g.name, { low: 'None', high: 'Worst' })),
        h('button', { type: 'button', class: 'ghost small', onclick: async () => { if (await UI.addCatalog('gisym')) draw(); } }, '+ Add a symptom'));
      draw();
      return [
        UI.when(meta),
        h('p', { class: 'hint' }, 'Rate the symptoms you have now. Leave the rest untouched.'),
        list,
        h('p', { class: 'hint' }, 'Nausea and tummy upset are also panic symptoms (DSM-PA-07). Logging both helps tell them apart over time.'),
        UI.field('Note', UI.textarea(d, 'note')),
      ];
    },
    validate: d => Object.values(d.sym || {}).some(v => v > 0) ? null : 'Rate at least one symptom above 0.',
    beforeSave(d) { for (const k of Object.keys(d.sym)) if (!(d.sym[k] > 0)) delete d.sym[k]; },
    summary: d => Object.entries(d.sym || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${M.catName(k)} ${v}`).join(' · '),
  });

  // --- bowel motion (SPC §7.4–7.5) ---
  function glyph(t) {
    const shapes = {
      1: [[10, 12], [24, 10], [38, 13], [51, 11]].map(([cx, cy]) => s('circle', { cx, cy, r: 4.5 })),
      2: [14, 22, 30, 38, 46].map((cx, i) => s('circle', { cx, cy: i % 2 ? 11 : 13, r: 6 })),
      3: [s('rect', { x: 6, y: 5, width: 48, height: 14, rx: 7 }), s('path', { d: 'M18 5v4M30 19v-4M42 5v4', class: 'crack' })],
      4: [s('rect', { x: 6, y: 6, width: 48, height: 12, rx: 6 })],
      5: [s('ellipse', { cx: 14, cy: 12, rx: 8, ry: 6 }), s('ellipse', { cx: 32, cy: 11, rx: 7, ry: 5 }), s('ellipse', { cx: 48, cy: 13, rx: 7, ry: 5 })],
      6: [s('path', { d: 'M6 14c3-6 8-2 10-6s8 2 11-1 7 4 11 0 9 3 13 1c2 4-2 6-6 7s-8-2-12 1-9-1-13 1-9 0-14-3z' })],
      7: [s('path', { d: 'M4 10q6.5-5 13 0t13 0 13 0 13 0M4 17q6.5-5 13 0t13 0 13 0 13 0', class: 'wave' })],
    };
    return s('svg', { viewBox: '0 0 60 24', class: 'bglyph', 'aria-hidden': 'true' }, shapes[t]);
  }
  function bristolPicker(d) {
    const wrap = h('div', { class: 'bristol', role: 'radiogroup', 'aria-label': 'Bristol stool type' });
    const draw = () => wrap.replaceChildren(...C.BRISTOL.map(b => {
      const on = d.bristol === b.type;
      return h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: `bristol-card ${b.group}${on ? ' on' : ''}`, onclick: () => { d.bristol = b.type; draw(); } },
        glyph(b.type), h('span', { class: 'bt' }, `Type ${b.type}`), h('span', { class: 'bd' }, b.label));
    }));
    draw();
    return wrap;
  }
  const GROUP = { hard: 'hard', normal: 'normal', loose: 'loose' };
  Forms.register('stool', {
    label: 'Bowel motion', module: 'food',
    defaults: { blood: 'none', painChange: '', pain: null },
    build(d, meta) {
      return [
        UI.when(meta),
        UI.section('Bristol stool type', bristolPicker(d)),
        h('div', { class: 'grid2 toggles' },
          UI.toggle(d, 'urgency', 'Urgency'), UI.toggle(d, 'straining', 'Straining'),
          UI.toggle(d, 'incomplete', 'Felt incomplete'), UI.toggle(d, 'mucus', 'Mucus')),
        UI.field('Blood', UI.chips(d, 'blood', C.BLOOD)),
        UI.toggle(d, 'black', 'Black or tarry'),
        UI.slider(d, 'pain', 'Pain', { low: 'None', high: 'Worst' }),
        UI.field('Tummy pain and this bowel motion', UI.chips(d, 'painChange', [['eased', 'Pain eased after'], ['worse', 'Pain worse after']]),
          'Used for the IBS pattern summary.'),
        UI.field('Note', UI.textarea(d, 'note')),
      ];
    },
    validate: d => d.bristol ? null : 'Choose the stool type.',
    beforeSave(d) { d.blood = d.blood || 'none'; d.painChange = d.painChange || ''; },
    afterSave(rec) {
      if ((rec.data.blood && rec.data.blood !== 'none') || rec.data.black)
        UI.alert('Worth seeing your GP', 'Blood in or on your stool, or black, tarry stool, should be checked by a GP. It often has a simple cause, but it is worth getting looked at.');
      else UI.toast('Saved');
    },
    summary: d => {
      const b = C.BRISTOL.find(x => x.type === d.bristol);
      return [b && `Type ${b.type} · ${GROUP[b.group]}`, d.urgency && 'urgency', d.blood && d.blood !== 'none' && 'blood', d.black && 'black'].filter(Boolean).join(' · ');
    },
  });

  // --- water ---
  Forms.register('water', {
    label: 'Water', module: 'food', single: true, time: false,
    defaults: { glasses: 0 },
    build: (d, meta) => [UI.when(meta, { time: false, label: 'Day' }), UI.stepper(d, 'glasses', 'Glasses of water', { max: 40 })],
    summary: d => `${d.glasses || 0} glass${d.glasses === 1 ? '' : 'es'}`,
  });
  async function addWater(date = U.today()) {
    const rec = M.one('water', date);
    const n = (rec ? U.num(rec.data.glasses) : 0) + 1;
    await M.save('water', date, null, { ...(rec ? rec.data : {}), glasses: n }, rec && rec.id);
    UI.toast(`Water today: ${n} glass${n === 1 ? '' : 'es'}`);
    return n;
  }

  return { addWater, glyph, recentFoods };
})();
