// Feedback & ideas: suggestions for future versions of the app. Stored as 'feedback' records, so they sync in the
// encrypted export like everything else, and can be exported on their own as a plain Markdown list for the next build.
const Feedback = (() => {
  const { h } = U;
  const KIND = [['idea', 'New idea'], ['problem', 'Something’s wrong'], ['content', 'Wording or content'], ['look', 'Look & feel']];
  const AREA = [['today', 'Today'], ['log', 'Log'], ['cycle', 'Cycle'], ['insights', 'Insights'], ['more', 'More'], ['form', 'A log form'], ['app', 'Whole app']];
  const PRIORITY = [['nice', 'Nice to have'], ['important', 'Important'], ['need', 'Really need it']];
  const STATUS = [['new', 'New'], ['planned', 'Planned'], ['done', 'Done'], ['declined', 'Not doing']];
  const name = (list, v) => (list.find(x => x[0] === v) || [, ''])[1];
  const TAB_AREA = { today: 'today', log: 'log', cycle: 'cycle', insights: 'insights', more: 'more' };

  Forms.register('feedback', {
    label: 'App feedback', module: 'app',
    defaults: { kind: 'idea', priority: 'nice', status: 'new' },
    build(d, meta, rec) {
      if (!rec) { d.area = d.area || TAB_AREA[App.tab] || 'app'; d.version = App.VERSION; }
      return [
        h('p', { class: 'hint' }, 'Suggestions stay on this device and travel in your encrypted export. Please keep personal health details out of them, so the list can be shared safely.'),
        UI.field('What kind of suggestion?', UI.chips(d, 'kind', KIND)),
        UI.field('Where in the app?', UI.chips(d, 'area', AREA)),
        UI.field('What would you like changed?', UI.textarea(d, 'text', 'e.g. Let me log two meals at once')),
        UI.field('Why would it help? (optional)', UI.textarea(d, 'why')),
        UI.field('How much does it matter?', UI.chips(d, 'priority', PRIORITY)),
        rec ? UI.field('Status', UI.chips(d, 'status', STATUS)) : null,
        rec ? h('p', { class: 'hint' }, `Suggested on ${U.fmtLong(rec.createdAt.slice(0, 10))} · app version ${d.version || '–'}`) : null,
      ];
    },
    validate: d => !U.norm(d.text) ? 'Write a few words about the change.' : null,
    afterSave: () => UI.toast('Thanks — saved for the next version'),
    summary: d => [name(KIND, d.kind), name(AREA, d.area), name(STATUS, d.status)].filter(Boolean).join(' · '),
  });

  const open = rec => Forms.open('feedback', rec || null);
  const all = () => M.recs('feedback');
  const rank = r => [STATUS.findIndex(s => s[0] === (r.data.status || 'new')), -PRIORITY.findIndex(p => p[0] === r.data.priority), -U.ts(r.date, r.time)];
  const sorted = () => all().sort((a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });

  // Plain Markdown list, grouped by status, for whoever builds the next version.
  function markdown() {
    const s = M.settings(), list = sorted();
    const out = [`# Health Tracker — suggested changes`, '', `Exported ${U.fmtLong(U.today())} from ${s.deviceName} · app version ${App.VERSION} · ${list.length} suggestion${list.length === 1 ? '' : 's'}`, ''];
    for (const [st, label] of STATUS) {
      const group = list.filter(r => (r.data.status || 'new') === st);
      if (!group.length) continue;
      out.push(`## ${label} (${group.length})`, '');
      for (const r of group) {
        const d = r.data;
        out.push(`- **${name(KIND, d.kind)} · ${name(AREA, d.area)} · ${name(PRIORITY, d.priority)}** — ${String(d.text).trim().replace(/\s*\n\s*/g, ' ')}`);
        if (U.norm(d.why)) out.push(`  - Why: ${String(d.why).trim().replace(/\s*\n\s*/g, ' ')}`);
        out.push(`  - ${U.fmtDate(r.date)} ${r.date.slice(0, 4)} · v${d.version || '?'}`);
      }
      out.push('');
    }
    return out.join('\n');
  }
  async function exportMd() {
    if (!all().length) return UI.alert('Nothing to export yet', 'Add a suggestion first.');
    if (!(await UI.confirm('Export suggestions?', 'This file is not encrypted. It holds only your suggestions, so check none of them mention personal health details before you share it.', 'Export'))) return;
    await U.saveFile(`healthtracker-feedback-${U.today()}.md`, markdown(), 'text/markdown');
  }

  // Card for the More tab: open suggestions first, newest first within the same status and importance.
  function card() {
    const list = sorted();
    const openCount = list.filter(r => ['new', 'planned'].includes(r.data.status || 'new')).length;
    return UI.card({ class: 'set feedback-card' },
      h('h3', {}, 'Feedback & ideas'),
      h('p', {}, 'Note anything you’d like added, fixed or changed. Suggestions are kept for the next version of the app.'),
      h('div', { class: 'btnrow' },
        h('button', { class: 'primary', onclick: () => open() }, 'Suggest a change'),
        h('button', { onclick: exportMd }, 'Export list')),
      list.length ? h('p', { class: 'hint' }, `${openCount} open · ${list.length} in total`) : null,
      list.length ? h('div', { class: 'entries' }, list.slice(0, 50).map(r => h('button', { class: 'entry', onclick: () => open(r) },
        h('span', { class: 'what' }, h('b', {}, String(r.data.text).trim().slice(0, 80) + (String(r.data.text).trim().length > 80 ? '…' : '')),
          h('small', {}, `${name(KIND, r.data.kind)} · ${name(AREA, r.data.area)} · ${name(PRIORITY, r.data.priority)}`)),
        h('span', { class: 'pill ' + ((r.data.status || 'new') === 'new' ? 'pink' : '') }, name(STATUS, r.data.status || 'new'))))) : null);
  }

  return { open, card, markdown, exportMd };
})();
