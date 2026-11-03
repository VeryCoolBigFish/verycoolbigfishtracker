// Boot, tab routing, theme and service worker updates.
const App = (() => {
  const VERSION = '0.2.1';
  const { h } = U;
  const TABS = [
    ['today', 'Today', 'today', () => Today.screen()],
    ['log', 'Log', 'log', () => Today.log()],
    ['cycle', 'Cycle', 'cycle', () => Body.screen(), 'cycle'],
    ['insights', 'Insights', 'insights', () => Report.screen()],
    ['more', 'More', 'more', () => Settings.screen()],
  ];
  let tab = 'today';
  const view = () => document.getElementById('view');
  const visible = () => TABS.filter(t => !t[4] || M.settings().modules[t[4]] !== false);

  function nav() {
    document.getElementById('tabs').replaceChildren(h('a', { class: 'brand', href: '#today', 'aria-hidden': 'true' }, UI.icon('leaf'), h('span', {}, 'Health')),
      ...visible().map(([id, label, ic]) => h('a', { href: '#' + id, class: 'tab' + (id === tab ? ' on' : ''), 'aria-current': id === tab ? 'page' : null }, UI.icon(ic), h('span', {}, label))));
  }

  // Re-renders the current tab, keeping the scroll position unless the tab changed.
  function render(keepScroll = true) {
    const v = view(), y = keepScroll ? window.scrollY : 0;
    const t = visible().find(x => x[0] === tab) || TABS[0];
    tab = t[0];
    document.getElementById('title').textContent = t[1] === 'Today' ? 'Health Tracker' : t[1];
    nav();
    let nodes;
    try { nodes = t[3](); }
    catch (e) { console.error(e); nodes = [UI.card({ class: 'notice' }, h('h3', {}, 'Something went wrong showing this screen'), h('p', { class: 'hint' }, String(e.message || e)))]; }
    v.replaceChildren(...[nodes].flat(Infinity).filter(Boolean));
    window.scrollTo(0, y);
  }
  const rerender = U.debounce(() => render(true), 30);

  function go(id) { if (location.hash !== '#' + id) location.hash = id; else { tab = id; render(false); } }
  addEventListener('hashchange', () => { tab = location.hash.slice(1) || 'today'; render(false); });

  function applyTheme() {
    const t = M.settings().theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  // A new version waits until the user chooses to reload, so a half-filled form is never lost.
  function registerSW() {
    if (!('serviceWorker' in navigator) || !isSecureContext) return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      const offer = w => {
        const bar = h('div', { class: 'update', role: 'status' }, 'A new version is ready.',
          h('button', { class: 'primary small', onclick: () => w.postMessage({ type: 'skipWaiting' }) }, 'Update'));
        document.body.append(bar);
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
    }).catch(e => console.warn('Service worker not registered', e));
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  }

  async function boot() {
    try {
      await DB.open();
      await M.load();
    } catch (e) {
      view().replaceChildren(UI.card({ class: 'notice' }, h('h3', {}, 'Storage is not available'),
        h('p', {}, 'This browser blocked on-device storage (for example in a private window). The tracker needs it to save your entries.'), h('p', { class: 'hint' }, String(e.message || e))));
      return;
    }
    applyTheme();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
    M.onChange(rerender);
    tab = location.hash.slice(1) || 'today';
    render(false);
    registerSW();
  }
  document.addEventListener('DOMContentLoaded', boot);

  return { VERSION, render, go, applyTheme, get tab() { return tab; } };
})();
