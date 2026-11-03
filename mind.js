// Mental health and sleep: daily check-in, panic log, weekly panic check, GAD-7 / PHQ-9 / PHQ-15, sleep diary, medication, support card (SPC §3, §6, §8).
const Mind = (() => {
  const { h } = U;

  // --- support card (SPC §8) ---
  function support() {
    const own = M.catalog('contact');
    UI.sheet({
      title: 'Support', body: h('div', { class: 'form support' },
        h('h3', { class: 'calm' }, 'You don’t have to manage this alone.'),
        h('p', {}, 'If you’re having thoughts of hurting yourself or that you’d be better off dead, please reach out to someone today.'),
        h('ul', { class: 'tel' }, C.SUPPORT.map(([name, shown, num]) => h('li', {}, h('span', {}, name), h('a', { href: num.startsWith('sms:') ? num : 'tel:' + num, class: 'btn' }, shown)))),
        own.length ? h('h3', {}, 'My contacts') : null,
        h('ul', { class: 'tel' }, own.map(c => h('li', {}, h('span', {}, c.name), c.phone ? h('a', { href: 'tel:' + c.phone.replace(/\s/g, ''), class: 'btn' }, c.phone) : null))),
        h('button', { class: 'ghost', onclick: async () => {
          const n = h('input', { placeholder: 'Name (e.g. my psychologist)' }), p = h('input', { type: 'tel', placeholder: 'Phone' });
          const ok = await UI.dialog('Add a support contact', h('div', { class: 'stack' }, n, p), [['Cancel', false, 'ghost'], ['Add', true, 'primary']]);
          if (ok && n.value.trim()) { await M.catSave({ kind: 'contact', name: n.value.trim(), phone: p.value.trim() }); UI.layers[UI.layers.length - 1](); support(); }
        } }, '+ Add my own contact'),
        h('p', { class: 'hint' }, 'Your GP or treating psychologist can also help. Calls use your phone’s dialler and work without this app being online.')),
    });
  }

  // --- daily check-in (SPC §3.6) ---
  Forms.register('checkin', {
    label: 'Daily check-in', module: 'mind', single: true, time: false,
    defaults: { panics: 0, caffeine: 0, alcohol: 0, exercise: 0, meds: [], gad: [] },
    build(d, meta) {
      const ph = Body.phase(meta.date);
      return [
        UI.when(meta, { time: false, label: 'Day' }),
        ph ? h('p', { class: 'phase-chip ' + ph.phase }, `Cycle day ${ph.day} · ${Cycle.PHASES[ph.phase]}`) : null,
        UI.slider(d, 'anxiety', 'Anxiety today', { low: 'Calm', high: 'Worst imaginable' }),
        UI.slider(d, 'mood', 'Mood today', { low: 'Very low', high: 'Very good' }),
        UI.slider(d, 'worry', 'Worry', { low: 'None', high: 'Constant' }),
        h('div', { class: 'grid2' },
          UI.stepper(d, 'panics', 'Panic attacks'), UI.stepper(d, 'caffeine', 'Caffeine drinks'),
          UI.stepper(d, 'alcohol', 'Alcohol (std drinks)'), UI.stepper(d, 'exercise', 'Exercise', { step: 5, max: 600, unit: 'min' })),
        h('p', { class: 'hint' }, h('button', { type: 'button', class: 'link', onclick: () => Forms.open('panic', null, meta.date) }, 'Log the details of a panic attack →')),
        UI.field('As-needed medication taken', UI.chips(d, 'meds', M.catalog('med'), { multi: true, add: () => UI.addCatalog('med') })),
        M.settings().gadTicks ? UI.field('Anxiety symptoms today', UI.chips(d, 'gad', C.GAD_SYMPTOMS.map(g => [g.code, g.label]), { multi: true })) : null,
        UI.field('Note', UI.textarea(d, 'note')),
      ];
    },
    summary: d => [d.anxiety != null && `Anxiety ${d.anxiety}`, d.mood != null && `Mood ${d.mood}`, d.panics ? `${d.panics} panic` : null, d.caffeine ? `${d.caffeine} caffeine` : null].filter(Boolean).join(' · '),
  });

  // --- panic attack log (SPC §3.2) ---
  Forms.register('panic', {
    label: 'Panic attack', module: 'mind',
    defaults: { symptoms: [], triggers: [], places: [], helpers: [], intensity: null },
    build(d, meta) {
      const cls = h('p', { class: 'class-chip' });
      const peakNote = h('p', { class: 'hint' });
      const upd = () => {
        const c = Score.panicClass(d.symptoms);
        cls.textContent = c.label; cls.className = 'class-chip ' + c.kind;
        peakNote.textContent = d.peak === 'gt10' ? 'DSM describes panic as peaking within minutes, so slower build-ups are often a different kind of anxiety. The entry is still saved.' : '';
      };
      upd();
      return [
        UI.when(meta),
        UI.field('How fast did it peak?', UI.chips(d, 'peak', C.PEAK, { onChange: upd })), peakNote,
        h('div', { class: 'grid2' }, UI.field('Total duration (min)', UI.input(d, 'duration', { type: 'number', min: 0, inputmode: 'numeric' }))),
        UI.slider(d, 'intensity', 'Peak intensity', { low: 'Mild', high: 'Worst ever' }),
        UI.section('Symptoms', h('div', { class: 'checklist' }, UI.chips(d, 'symptoms', C.PANIC_SYMPTOMS.map(p => [p.code, p.label]), { multi: true, onChange: upd })), cls,
          UI.field('Other', UI.input(d, 'other', { type: 'text', placeholder: 'Anything else (not counted)' }))),
        UI.field('Type', UI.chips(d, 'type', C.PANIC_TYPE)),
        UI.field('Trigger', UI.chips(d, 'triggers', M.catalog('trigger'), { multi: true, add: () => UI.addCatalog('trigger') })),
        UI.field('Where', UI.chips(d, 'places', M.catalog('place'), { multi: true, add: () => UI.addCatalog('place') })),
        UI.field('What helped', UI.chips(d, 'helpers', M.catalog('helper'), { multi: true, add: () => UI.addCatalog('helper') })),
        UI.section('Afterwards',
          UI.scaleQ(d, 'worry', 'Worried about having another one?', C.IMPACT_SCALE, { compact: true }),
          UI.toggle(d, 'avoided', 'I avoided or changed something because of it'),
          UI.field('', UI.input(d, 'avoidNote', { type: 'text', placeholder: 'What did you avoid or change?' }))),
        UI.field('Note', UI.textarea(d, 'note')),
      ];
    },
    validate: d => d.intensity == null && !d.symptoms.length ? 'Add the intensity or at least one symptom.' : null,
    summary: d => `${Score.panicClass(d.symptoms).label}${d.intensity != null ? ' · peak ' + d.intensity + '/10' : ''}${d.type ? ' · ' + (C.PANIC_TYPE.find(t => t[0] === d.type) || [])[1] : ''}`,
  });

  // --- weekly panic and agoraphobia check (SPC §3.4) ---
  Forms.register('weekly', {
    label: 'Weekly panic check', module: 'mind', time: false,
    defaults: { fear: [], avoid: [], impact: [] },
    build(d, meta) {
      return [
        UI.when(meta, { time: false, label: 'Week ending' }),
        UI.section('Situations this week', h('p', { class: 'hint' }, 'Rate how much fear you felt, and how often you avoided each.'),
          C.AGORA.map((a, i) => h('div', { class: 'agora' }, h('h4', {}, a.label, h('small', {}, a.hint)),
            UI.scaleQ(d.fear, i, 'Fear', C.FEAR_SCALE, { compact: true }), UI.scaleQ(d.avoid, i, 'Avoidance', C.AVOID_SCALE, { compact: true })))),
        UI.section('Panic worry and impact', C.PANIC_IMPACT.map((q, i) => UI.scaleQ(d.impact, i, q, C.IMPACT_SCALE, { compact: true }))),
      ];
    },
    summary: d => {
      const flagged = C.AGORA.filter((a, i) => (d.fear[i] ?? 0) >= 2 || (d.avoid[i] ?? 0) >= 2).length;
      return `${flagged} situation group${flagged === 1 ? '' : 's'} flagged · worry ${d.impact[0] ?? '–'}/4`;
    },
  });

  // --- questionnaires (SPC §3.7–3.9) ---
  function result(key, rec) {
    const q = C.Q[key], b = Score.band(key, rec.data.score);
    const meter = h('div', { class: 'meter' }, h('div', { class: 'fill lvl' + b.level, style: { width: (rec.data.score / q.max) * 100 + '%' } }));
    return UI.dialog(`${q.name}: ${rec.data.score} — ${b.label}`, h('div', { class: 'stack' }, meter,
      b.text ? h('p', {}, b.text) : null, q.note ? h('p', { class: 'hint' }, q.note) : null, h('p', { class: 'notdx' }, C.NOT_DX)), [['Done', true, 'primary']]);
  }
  for (const key of Object.keys(C.Q)) {
    const q = C.Q[key];
    Forms.register(key, {
      label: q.title, module: 'mind', time: false,
      defaults: { answers: [] },
      build(d, meta) {
        return [
          UI.when(meta, { time: false, label: 'Date' }),
          h('p', { class: 'stem' }, q.stem),
          q.items.map((it, i) => UI.scaleQ(d.answers, i, `${i + 1}. ${it}`, q.scale)),
          q.difficulty ? UI.field('If you checked any problems, how difficult have they made it for you to do your work, take care of things at home, or get along with other people?',
            UI.chips(d, 'difficulty', C.DIFFICULTY.map((l, i) => [i, l]))) : null,
          h('p', { class: 'cite' }, `${q.name} · ${q.cite}. Free to use.`),
        ];
      },
      validate: d => Score.total(key, d.answers) == null ? 'Please answer every question.' : null,
      beforeSave: d => { d.score = Score.total(key, d.answers); },
      async afterSave(rec) {
        if (Score.needsSupport(key, rec.data.answers)) support();
        else await result(key, rec);
      },
      summary: d => { const b = Score.band(key, d.score); return b ? `${d.score} / ${q.max} · ${b.label}` : ''; },
    });
  }

  // Questionnaires and weekly check due today, by the schedule in settings.
  function due() {
    const out = [];
    const sch = M.settings().schedule;
    for (const key of ['gad7', 'phq9', 'phq15', 'weekly']) {
      if (!sch[key]) continue;
      const last = M.last(key);
      const age = last ? U.diffDays(U.today(), last.date) : Infinity;
      if (age >= sch[key]) out.push({ type: key, label: Forms.label(key), overdue: last ? age - sch[key] : null });
    }
    return out;
  }

  // --- sleep diary (SPC §6) ---
  Forms.register('sleep', {
    label: 'Sleep diary', module: 'mind', single: true, time: false,
    defaults: { bed: '22:30', tryAt: '23:00', sol: 15, wakes: 0, waso: 0, wake: '06:30', up: '07:00', naps: 0, napMins: 0 },
    build(d, meta) {
      const calc = h('div', { class: 'calc' });
      const upd = () => {
        const r = Score.sleep(d);
        calc.replaceChildren(...(r ? [
          h('div', {}, h('b', {}, U.fmtMins(r.tst)), h('span', {}, 'asleep')),
          h('div', {}, h('b', {}, U.fmtMins(r.tib)), h('span', {}, 'in bed')),
          h('div', { class: r.poorSE ? 'warn' : '' }, h('b', {}, r.se + '%'), h('span', {}, 'efficiency')),
        ] : [h('span', {}, 'Fill in the times to see your totals.')]));
      };
      const t = (k, l) => UI.field(l, UI.input(d, k, { type: 'time', onchange: upd }));
      const n = (k, l) => UI.field(l, UI.input(d, k, { type: 'number', min: 0, inputmode: 'numeric', onchange: upd }));
      setTimeout(upd);
      const form = [
        UI.when(meta, { time: false, label: 'Morning of' }),
        h('div', { class: 'grid2' },
          t('bed', '1. What time did you get into bed?'), t('tryAt', '2. What time did you try to go to sleep?'),
          n('sol', '3. How long did it take you to fall asleep? (min)'), n('wakes', '4. How many times did you wake up, not counting your final awakening?'),
          n('waso', '5. In total, how long did these awakenings last? (min)'), t('wake', '6. What time was your final awakening?'),
          t('up', '7. What time did you get out of bed for the day?')),
        calc,
        UI.field('8. How would you rate the quality of your sleep?', UI.chips(d, 'quality', C.SLEEP_QUALITY.map((l, i) => [i, l]))),
        UI.section('Extras', UI.toggle(d, 'nightmares', 'Nightmares'), UI.toggle(d, 'panicWake', 'Woke in panic'),
          h('div', { class: 'grid2' }, UI.stepper(d, 'naps', 'Naps'), UI.stepper(d, 'napMins', 'Nap time', { step: 10, max: 600, unit: 'min' })),
          UI.field('Sleep medication', UI.chips(d, 'sleepMed', M.catalog('med'), { add: () => UI.addCatalog('med') }))),
        UI.field('9. Comments', UI.textarea(d, 'note')),
      ];
      return form;
    },
    afterSave(rec) {
      if (rec.data.panicWake && !M.recs('panic', rec.date, rec.date).some(p => p.data.type === 'nocturnal'))
        UI.confirm('Log the night-time panic attack?', 'You noted you woke in panic. Add its details to the panic log?', 'Log it').then(ok => ok && Forms.open('panic', null, rec.date));
      else UI.toast('Saved');
    },
    summary: d => { const r = Score.sleep(d); return r ? `${U.fmtMins(r.tst)} asleep · ${r.se}% efficiency${d.quality != null ? ' · ' + C.SLEEP_QUALITY[d.quality] : ''}` : ''; },
  });

  // --- medication taken ---
  Forms.register('med', {
    label: 'Medication', module: 'mind',
    defaults: {},
    build(d, meta) {
      return [UI.when(meta),
        UI.field('Medication', UI.chips(d, 'med', M.catalog('med'), { add: () => UI.addCatalog('med') })),
        UI.field('Dose', UI.input(d, 'dose', { type: 'text', placeholder: 'e.g. 5 mg' })),
        UI.field('For', UI.chips(d, 'reason', [['anxiety', 'Anxiety / panic'], ['pain', 'Pain'], ['sleep', 'Sleep'], ['gut', 'Gut'], ['other', 'Other']])),
        UI.field('Note', UI.textarea(d, 'note'))];
    },
    validate: d => !d.med ? 'Choose a medication.' : null,
    summary: d => [d.med && M.catName(d.med), d.dose].filter(Boolean).join(' · '),
  });

  return { support, due };
})();
