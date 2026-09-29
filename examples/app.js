import { LitElement, html } from 'lit';
import { createRouter, observe } from '../src/index.js';
import './cards.js';
import './shell.js';
import {
  Activity,
  Barista,
  Confirmation,
  Detail,
  Filters,
  Foam,
  Menu,
  Note,
  Order,
  Preferences,
  Toasts,
  UrlHistory,
} from './stores.js';
import { money } from './ui.js';

const stores = {
  menu: new Menu(),
  order: new Order('Table 1'),
  secondTable: new Order('Table 2'),
  foam: new Foam(),
  barista: new Barista(),
  toasts: new Toasts(),
  activity: new Activity(),
  filters: new Filters(),
  detail: new Detail(),
  preferences: new Preferences(),
  note: new Note(),
  confirmation: new Confirmation(),
  urlHistory: new UrlHistory(),
};

const { menu, order, activity, filters, detail, preferences, note, confirmation, urlHistory } =
  stores;

// Demo instrumentation, not needed in an app: shows the history writes the router makes
for (const kind of ['push', 'replace']) {
  const method = `${kind}State`;
  const write = history[method].bind(history);
  history[method] = (state, title, url) => {
    write(state, title, url);
    urlHistory.record(kind, url);
    activity.record('router', `${method}(${url})`);
  };
}
window.addEventListener('popstate', () => {
  urlHistory.record('pop', window.location.search + window.location.hash);
  activity.record('router', `popstate → ${urlHistory.url}`);
});

const router = createRouter();

// Category changes replace the current entry
router.register(filters, {
  onRoute: ({ query }) => filters.setCategory(query.category),
  toURL: () => ({ query: { category: filters.category }, replace: true }),
});

// Opening an item pushes a new entry
router.register(detail, {
  onRoute: ({ query }) => (query.item ? detail.open(query.item) : detail.close()),
  toURL: () => ({ query: { item: detail.item } }),
});

// The sort order survives reloads, even when the URL doesn't carry it
router.register(preferences, {
  onRoute: ({ query }) => preferences.setSort(query.sort),
  toURL: () => ({
    query: { sort: preferences.sort === 'name' ? null : preferences.sort },
    replace: true,
  }),
  storage: localStorage,
  key: 'picosm-demo:preferences',
});

router.register(note, {
  async before() {
    if (!note.dirty) return true;
    const leave = await confirmation.ask('Your note for the barista is not saved. Leave anyway?');
    if (leave) note.discard();
    return leave;
  },
});

// A registration can also just listen: this one logs every route the router applies
router.register(activity, {
  onRoute: ({ query }) => {
    const params = new URLSearchParams(query).toString();
    activity.record('router', `onRoute(${params ? `?${params}` : 'no query'})`);
  },
});

observe(order, () => {
  activity.record('notify', `order · ${order.count} items, ${money(order.subtotal)}`);
});
observe(menu, () => {
  activity.record('notify', `menu · ${menu.error ?? `${menu.items.length} items`}`);
});

activity.record('action', "menu.load('./menu.json')");
menu.load().catch((error) => activity.record('error', `menu.load() rejected: ${error.message}`));

const SECTIONS = [
  ['actions', 'Actions'],
  ['computed', 'Computed'],
  ['async', 'Async'],
  ['throttle', 'Throttling'],
  ['reaction', 'Reactions'],
  ['track', 'Tracking'],
  ['messages', 'Messages'],
  ['lit', 'Lit'],
  ['router', 'Router'],
];

class PicosmDemo extends LitElement {
  static properties = {
    stores: {},
    router: {},
  };

  // Light DOM, so that #section links find their targets in the document
  createRenderRoot() {
    return this;
  }

  render() {
    const s = this.stores;
    return html`
      <div class="shell" @click=${this.router.go}>
        <header class="hero">
          <div class="hero-top">
            <span class="wordmark">picosm</span>
            <nav class="hero-links" aria-label="Project">
              <a href="https://github.com/yesil/picosm" target="_blank" rel="noopener">GitHub ↗</a>
              <a href="https://www.npmjs.com/package/picosm" target="_blank" rel="noopener">npm ↗</a>
              <a href="https://github.com/yesil/picosm#readme" target="_blank" rel="noopener">Docs ↗</a>
            </nav>
          </div>
          <h1>Observable classes, <em>live</em>.</h1>
          <p class="lede">
            picosm makes plain classes observable with explicit actions, cached getters and
            batched notifications, with a Lit integration and a store-driven router on top. The
            cards below share one small coffee-shop model, and the activity log shows what happens
            underneath.
          </p>
          <code class="install">npm install picosm</code>
          <nav class="toc" aria-label="Capabilities">
            ${SECTIONS.map(
              ([id, label], index) =>
                html`<a href="#${id}"><span>${String(index + 1).padStart(2, '0')}</span>${label}</a>`,
            )}
          </nav>
        </header>

        <div class="layout">
          <main class="cards">
            <actions-card
              id="actions"
              .order=${s.order}
              .menu=${s.menu}
              .activity=${s.activity}
            ></actions-card>
            <computed-card id="computed" .order=${s.order}></computed-card>
            <async-card id="async" .menu=${s.menu} .activity=${s.activity}></async-card>
            <throttle-card id="throttle" .foam=${s.foam}></throttle-card>
            <reaction-card
              id="reaction"
              .order=${s.order}
              .menu=${s.menu}
              .toasts=${s.toasts}
              .activity=${s.activity}
            ></reaction-card>
            <track-card id="track" .order=${s.order} .activity=${s.activity}></track-card>
            <messages-card
              id="messages"
              .order=${s.order}
              .barista=${s.barista}
              .activity=${s.activity}
            ></messages-card>
            <lit-card
              id="lit"
              .tables=${[s.order, s.secondTable]}
              .menu=${s.menu}
              .activity=${s.activity}
            ></lit-card>
            <router-card
              id="router"
              .router=${this.router}
              .menu=${s.menu}
              .filters=${s.filters}
              .detail=${s.detail}
              .preferences=${s.preferences}
              .note=${s.note}
              .urlHistory=${s.urlHistory}
              .order=${s.order}
              .activity=${s.activity}
            ></router-card>
          </main>
          <aside class="side">
            <activity-panel .activity=${s.activity}></activity-panel>
          </aside>
        </div>

        <footer class="footer">
          Built with picosm and Lit. The source of this page is in
          <a href="https://github.com/yesil/picosm/tree/main/examples" target="_blank" rel="noopener"
            >examples/</a
          >.
        </footer>
      </div>
      <toast-stack .toasts=${s.toasts}></toast-stack>
      <confirm-dialog .confirmation=${s.confirmation}></confirm-dialog>
    `;
  }
}

customElements.define('picosm-demo', PicosmDemo);

document.body.append(Object.assign(document.createElement('picosm-demo'), { stores, router }));
