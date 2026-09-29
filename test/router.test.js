import { spy } from 'sinon';
import { expect } from '@esm-bundle/chai';
import { makeObservable } from '../src/makeObservable.js';
import { createRouter } from '../src/router.js';

const flush = () => new Promise((r) => queueMicrotask(r));
// Waits until every pending microtask (store notifications, URL syncs) has run
const settle = () => new Promise((r) => setTimeout(r, 0));
const ORIGINAL_PATH = window.location.pathname;

class TestStore {
  static observableActions = ['setRoute', 'setFilters'];

  path = '';
  route = null;
  filters = {};
  isDirty = false;

  setRoute(path, route) {
    this.path = path;
    this.route = route;
  }

  setFilters(filters) {
    this.filters = filters;
  }
}

makeObservable(TestStore);

class PathStore {
  static observableActions = ['setPath'];

  path = '/';

  setPath(path) {
    this.path = path;
  }
}

makeObservable(PathStore);

class QueryStore {
  static observableActions = ['setQuery'];

  query = {};

  setQuery(query) {
    this.query = query;
  }
}

makeObservable(QueryStore);

customElements.define(
  'test-link-card',
  class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).innerHTML =
        '<a href="/product/1">details</a>';
    }
  },
);

// The README setup: one store owns the path, another one the query
function registerPathAndQuery(router, pathStore, queryStore) {
  router.register(pathStore, {
    onRoute: ({ path }) => pathStore.setPath(path),
    toURL: () => ({ path: pathStore.path }),
  });
  router.register(queryStore, {
    onRoute: ({ query }) => queryStore.setQuery(query),
    toURL: () => ({ query: queryStore.query }),
  });
}

function recordHistory() {
  const writes = [];
  const { pushState, replaceState } = history;
  history.pushState = function (state, title, url) {
    writes.push(`push ${url}`);
    return pushState.call(this, state, title, url);
  };
  history.replaceState = function (state, title, url) {
    writes.push(`replace ${url}`);
    return replaceState.call(this, state, title, url);
  };
  return {
    writes,
    restore() {
      delete history.pushState;
      delete history.replaceState;
    },
  };
}

function popState(router) {
  const popped = new Promise((r) =>
    window.addEventListener('popstate', r, { once: true }),
  );
  router.back();
  return popped.then(settle);
}

// Clicks a link inside a container delegating to router.go; the real navigation is always blocked
function clickLink(
  router,
  attributes,
  { eventInit = {}, handledByApp = false } = {},
) {
  const nav = document.createElement('nav');
  const link = document.createElement('a');
  for (const [name, value] of Object.entries(attributes))
    link.setAttribute(name, value);
  if (handledByApp)
    link.addEventListener('click', (event) => event.preventDefault());
  nav.append(link);
  nav.addEventListener('click', router.go);
  document.body.append(nav);
  let prevented;
  const block = (event) => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', block);
  const navigate = spy(router, 'navigate');
  link.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...eventInit,
    }),
  );
  navigate.restore();
  document.removeEventListener('click', block);
  nav.remove();
  return { prevented, navigate };
}

describe('Router', () => {
  let router;

  afterEach(() => {
    router?.destroy();
    history.replaceState(null, '', ORIGINAL_PATH);
  });

  it('creates a router', () => {
    router = createRouter();
    expect(router).to.have.property('register');
    expect(router).to.have.property('navigate');
    expect(router).to.have.property('replace');
    expect(router).to.have.property('back');
    expect(router).to.have.property('forward');
    expect(router).to.have.property('go');
    expect(router).to.have.property('destroy');
  });

  it('calls onRoute on registration with current URL', () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    router.register(store, { onRoute });

    expect(onRoute.callCount).to.equal(1);
    expect(onRoute.firstCall.args[0]).to.have.property('path');
    expect(onRoute.firstCall.args[0]).to.have.property('query');
    expect(onRoute.firstCall.args[0]).to.have.property('hash');
  });

  it('calls onRoute on navigate', async () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    router.register(store, { onRoute });

    await router.navigate('/test-path', { query: { foo: 'bar' } });

    expect(onRoute.callCount).to.equal(2); // registration + navigate
    const data = onRoute.secondCall.args[0];
    expect(data.path).to.equal('/test-path');
    expect(data.query).to.deep.equal({ foo: 'bar' });
    expect(data.hash).to.deep.equal({});
  });

  it('calls onRoute on replace', async () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    router.register(store, { onRoute });

    await router.replace('/replaced', {
      query: { a: '1' },
      hash: { section: 'top' },
    });

    expect(onRoute.callCount).to.equal(2);
    const data = onRoute.secondCall.args[0];
    expect(data.path).to.equal('/replaced');
    expect(data.query).to.deep.equal({ a: '1' });
    expect(data.hash).to.deep.equal({ section: 'top' });
  });

  it('register returns a disposer', async () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    const dispose = router.register(store, { onRoute });

    await router.navigate('/before');
    expect(onRoute.callCount).to.equal(2);

    dispose();

    await router.navigate('/after');
    expect(onRoute.callCount).to.equal(2); // not called again
  });

  it('supports multiple store registrations', async () => {
    router = createRouter();
    const onRouteA = spy();
    const onRouteB = spy();
    const storeA = new TestStore();
    const storeB = new TestStore();

    router.register(storeA, { onRoute: onRouteA });
    router.register(storeB, { onRoute: onRouteB });

    await router.navigate('/multi');

    expect(onRouteA.callCount).to.equal(2);
    expect(onRouteB.callCount).to.equal(2);
  });

  it('merges toURL from multiple stores', async () => {
    router = createRouter();
    const storeA = new TestStore();
    const storeB = new TestStore();

    router.register(storeA, {
      onRoute({ path }) {
        storeA.setRoute(path, null);
      },
      toURL() {
        return { path: storeA.path };
      },
    });

    router.register(storeB, {
      onRoute({ query }) {
        storeB.setFilters(query);
      },
      toURL() {
        return { query: storeB.filters };
      },
    });

    await router.navigate('/products', { query: { category: 'shoes' } });
    await flush();

    expect(storeA.path).to.equal('/products');
    expect(storeB.filters).to.deep.equal({ category: 'shoes' });
  });

  it('pushes URL when store changes via toURL', async () => {
    router = createRouter();
    const store = new TestStore();

    router.register(store, {
      onRoute({ query }) {
        store.setFilters(query);
      },
      toURL() {
        return { query: store.filters };
      },
    });

    store.setFilters({ color: 'red' });
    await flush();
    await flush();

    expect(window.location.search).to.include('color=red');
  });

  it('handles navigate with query and hash objects', async () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    router.register(store, { onRoute });

    await router.navigate('/path', {
      query: { key: 'value', other: 'data' },
      hash: { section: 'main', mode: 'edit' },
    });

    const data = onRoute.secondCall.args[0];
    expect(data.path).to.equal('/path');
    expect(data.query).to.deep.equal({ key: 'value', other: 'data' });
    expect(data.hash).to.deep.equal({ section: 'main', mode: 'edit' });
  });

  it('go handler skips non-anchor clicks', () => {
    router = createRouter();
    const div = document.createElement('div');
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: div });

    const navigateSpy = spy(router, 'navigate');
    router.go(event);

    expect(navigateSpy.callCount).to.equal(0);
  });

  it('destroy removes all registrations', async () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    router.register(store, { onRoute });

    router.destroy();
    await router.navigate('/after-destroy');

    expect(onRoute.callCount).to.equal(1);
  });

  // Navigation guard tests

  it('before guard blocks navigate when returning false', async () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();

    router.register(store, {
      onRoute,
      before() {
        return false;
      },
    });

    await router.navigate('/blocked');

    // onRoute called once (registration), not for navigate
    expect(onRoute.callCount).to.equal(1);
  });

  it('before guard allows navigate when returning true', async () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();

    router.register(store, {
      onRoute,
      before() {
        return true;
      },
    });

    await router.navigate('/allowed');

    expect(onRoute.callCount).to.equal(2);
    expect(onRoute.secondCall.args[0].path).to.equal('/allowed');
  });

  it('before guard supports async (Promise)', async () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();

    router.register(store, {
      onRoute,
      async before() {
        return false;
      },
    });

    await router.navigate('/blocked');

    expect(onRoute.callCount).to.equal(1);
  });

  it('before guard blocks replace', async () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();

    router.register(store, {
      onRoute,
      before() {
        return false;
      },
    });

    await router.replace('/blocked');

    expect(onRoute.callCount).to.equal(1);
  });

  it('before guard receives destination route data', async () => {
    router = createRouter();
    const beforeSpy = spy(() => true);
    const store = new TestStore();

    router.register(store, {
      onRoute() {},
      before: beforeSpy,
    });

    await router.navigate('/dest', { query: { a: '1' }, hash: { b: '2' } });

    const dest = beforeSpy.firstCall.args[0];
    expect(dest.path).to.equal('/dest');
    expect(dest.query).to.deep.equal({ a: '1' });
    expect(dest.hash).to.deep.equal({ b: '2' });
  });

  it('first guard rejection short-circuits — no further guards called', async () => {
    router = createRouter();
    const storeA = new TestStore();
    const storeB = new TestStore();
    const guardB = spy(() => true);

    router.register(storeA, {
      onRoute() {},
      before() {
        return false;
      },
    });

    router.register(storeB, {
      onRoute() {},
      before: guardB,
    });

    await router.navigate('/blocked');

    expect(guardB.callCount).to.equal(0);
  });

  // toURL replace tests

  it('toURL with replace: true uses replaceState instead of pushState', async () => {
    router = createRouter();
    const store = new TestStore();

    router.register(store, {
      onRoute({ query }) {
        store.setFilters(query);
      },
      toURL() {
        return { query: store.filters, replace: true };
      },
    });

    // Navigate to set a baseline history entry
    await router.navigate('/base');
    const historyLengthBefore = history.length;

    // Store change should replaceState, not pushState
    store.setFilters({ color: 'red' });
    await flush();
    await flush();

    expect(window.location.search).to.include('color=red');
    // replaceState does not add a new history entry
    expect(history.length).to.equal(historyLengthBefore);
  });

  it('toURL without replace uses pushState', async () => {
    router = createRouter();
    const store = new TestStore();

    router.register(store, {
      onRoute({ query }) {
        store.setFilters(query);
      },
      toURL() {
        return { query: store.filters };
      },
    });

    await router.navigate('/base');
    const historyLengthBefore = history.length;

    store.setFilters({ size: 'large' });
    await flush();
    await flush();

    expect(window.location.search).to.include('size=large');
    // pushState adds a new history entry
    expect(history.length).to.equal(historyLengthBefore + 1);
  });

  it('disposed store guard is no longer checked', async () => {
    router = createRouter();
    const onRoute = spy();
    const guardStore = new TestStore();
    const mainStore = new TestStore();

    const dispose = router.register(guardStore, {
      onRoute() {},
      before() {
        return false;
      },
    });

    router.register(mainStore, { onRoute });

    // Guard blocks
    await router.navigate('/blocked');
    expect(onRoute.callCount).to.equal(1);

    // Remove guard
    dispose();

    // Now navigation succeeds
    await router.navigate('/allowed');
    expect(onRoute.callCount).to.equal(2);
  });
});

describe('Router storage', () => {
  let router;
  const STORAGE_KEY = 'filters';

  afterEach(() => {
    router?.destroy();
    history.replaceState(null, '', ORIGINAL_PATH);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  });

  function registerFilters(store, { storage = sessionStorage, onRoute } = {}) {
    return router.register(store, {
      onRoute: onRoute ?? (({ query }) => store.setFilters(query)),
      toURL: () => ({ query: store.filters }),
      storage,
      key: STORAGE_KEY,
    });
  }

  it('restores stored query params missing from the URL and writes them to the URL', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ query: { category: 'shoes' } }),
    );
    history.replaceState(null, '', '/list');
    const historyLength = history.length;
    router = createRouter();
    const store = new TestStore();
    const onRoute = spy(({ query }) => store.setFilters(query));
    registerFilters(store, { onRoute });
    await settle();

    expect(onRoute.callCount).to.equal(1);
    expect(onRoute.firstCall.args[0]).to.deep.equal({
      path: '/list',
      query: { category: 'shoes' },
      hash: {},
    });
    expect(store.filters).to.deep.equal({ category: 'shoes' });
    expect(window.location.search).to.equal('?category=shoes');
    expect(history.length).to.equal(historyLength);
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY))).to.deep.equal({
      query: { category: 'shoes' },
    });
  });

  it('gives URL params precedence over stored ones', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ query: { category: 'shoes', sort: 'price' } }),
    );
    history.replaceState(null, '', '/list?category=hats');
    router = createRouter();
    const store = new TestStore();
    registerFilters(store);
    await settle();

    expect(store.filters).to.deep.equal({ category: 'hats', sort: 'price' });
  });

  it('calls onRoute with the current URL only when nothing is stored', () => {
    router = createRouter();
    const store = new TestStore();
    const onRoute = spy();
    registerFilters(store, { onRoute });

    expect(onRoute.callCount).to.equal(1);
    expect(onRoute.firstCall.args[0].query).to.deep.equal({});
  });

  it('writes the toURL query and hash to storage when the store changes', async () => {
    router = createRouter();
    const store = new TestStore();
    registerFilters(store);

    store.setFilters({ color: 'red' });
    await settle();

    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    expect(saved).to.deep.equal({ query: { color: 'red' } });
  });

  it('works with localStorage backend', async () => {
    router = createRouter();
    const store = new TestStore();
    registerFilters(store, { storage: localStorage });

    store.setFilters({ size: 'large' });
    await settle();

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).to.deep.equal({ query: { size: 'large' } });
  });

  it('disposed registration stops writing to storage on store changes', async () => {
    router = createRouter();
    const store = new TestStore();
    const dispose = registerFilters(store);

    dispose();

    store.setFilters({ color: 'blue' });
    await settle();

    expect(sessionStorage.getItem(STORAGE_KEY)).to.be.null;
  });

  it('requires a key, onRoute and toURL when storage is set', () => {
    router = createRouter();
    const store = new TestStore();

    expect(() =>
      router.register(store, {
        onRoute() {},
        toURL: () => ({}),
        storage: sessionStorage,
      }),
    ).to.throw(TypeError, /"storage" requires a non-empty string "key"/);
    expect(() =>
      router.register(store, {
        onRoute() {},
        storage: sessionStorage,
        key: STORAGE_KEY,
      }),
    ).to.throw(TypeError, /requires both "onRoute" and "toURL"/);
  });

  it('throws a descriptive error for malformed JSON in storage', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not valid json {{{');
    router = createRouter();
    const onRoute = spy();

    expect(() => registerFilters(new TestStore(), { onRoute })).to.throw(
      /stored value for key "filters" is not valid JSON/,
    );
    expect(onRoute.callCount).to.equal(0);
  });

  it('lets errors thrown by onRoute during restore reach the caller', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ query: { a: '1' } }));
    router = createRouter();
    const failure = new Error('onRoute failed');

    expect(() =>
      registerFilters(new TestStore(), {
        onRoute() {
          throw failure;
        },
      }),
    ).to.throw(failure);
  });
});

describe('Router URL sync', () => {
  let router;
  let recorder;

  afterEach(() => {
    recorder?.restore();
    recorder = null;
    router?.destroy();
    history.replaceState(null, '', ORIGINAL_PATH);
  });

  it('writes a single history entry when one navigate() changes several stores', async () => {
    history.replaceState(null, '', '/start');
    router = createRouter();
    registerPathAndQuery(router, new PathStore(), new QueryStore());
    await settle();
    recorder = recordHistory();

    await router.navigate('/users', { query: { tab: 'posts' } });
    await settle();

    expect(recorder.writes).to.deep.equal(['push /users?tab=posts']);
  });

  it('does not write history when registering stores for the current URL, whatever the param order', async () => {
    history.replaceState(null, '', '/shop?category=shoes&product=Boots');
    recorder = recordHistory();
    router = createRouter();
    const view = new QueryStore();
    const filters = new QueryStore();
    router.register(view, {
      onRoute: ({ query }) =>
        view.setQuery(query.product ? { product: query.product } : {}),
      toURL: () => ({ query: view.query }),
    });
    router.register(filters, {
      onRoute: ({ query }) =>
        filters.setQuery(query.category ? { category: query.category } : {}),
      toURL: () => ({ query: filters.query, replace: true }),
    });
    await settle();

    expect(recorder.writes).to.deep.equal([]);
    expect(window.location.search).to.equal('?category=shoes&product=Boots');
  });

  it('does not write history when Back changes several stores', async () => {
    history.replaceState(null, '', '/p1?q=1');
    history.pushState(null, '', '/p2?q=2');
    router = createRouter();
    const pathStore = new PathStore();
    const queryStore = new QueryStore();
    registerPathAndQuery(router, pathStore, queryStore);
    await settle();
    recorder = recordHistory();

    await popState(router);

    expect(recorder.writes).to.deep.equal([]);
    expect(pathStore.path).to.equal('/p1');
    expect(queryStore.query).to.deep.equal({ q: '1' });
  });

  it('pushes one entry when stores change together, unless all of them replace', async () => {
    history.replaceState(null, '', '/list');
    router = createRouter();
    const view = new QueryStore();
    const filters = new QueryStore();
    router.register(view, { toURL: () => ({ query: view.query }) });
    router.register(filters, {
      toURL: () => ({ query: filters.query, replace: true }),
    });
    recorder = recordHistory();

    filters.setQuery({ category: 'shoes' });
    await settle();
    view.setQuery({ product: 'Boots' });
    filters.setQuery({ category: 'boots' });
    await settle();

    expect(recorder.writes).to.deep.equal([
      'replace /list?category=shoes',
      'push /list?product=Boots&category=boots',
    ]);
  });

  it('replaces instead of pushing when a store canonicalizes the URL it was routed to', async () => {
    history.replaceState(null, '', '/start');
    router = createRouter();
    const pathStore = new PathStore();
    router.register(pathStore, {
      onRoute: ({ path }) => pathStore.setPath(path.replace(/\/+$/, '') || '/'),
      toURL: () => ({ path: pathStore.path }),
    });
    await settle();
    recorder = recordHistory();

    await router.navigate('/users/');
    await settle();

    expect(recorder.writes).to.deep.equal(['push /users/', 'replace /users']);
  });

  it('keeps params no store owns until a store changes its URL output', async () => {
    history.replaceState(null, '', '/list?utm_source=mail');
    router = createRouter();
    const store = new QueryStore();
    router.register(store, {
      onRoute: ({ query }) =>
        store.setQuery(query.category ? { category: query.category } : {}),
      toURL: () => ({ query: store.query }),
    });

    store.setQuery({});
    await settle();
    expect(window.location.search).to.equal('?utm_source=mail');

    store.setQuery({ category: 'shoes' });
    await settle();
    expect(window.location.search).to.equal('?category=shoes');
  });
  it('leaves the hash alone while no store produces one', async () => {
    history.replaceState(null, '', '/docs#intro');
    router = createRouter();
    const store = new QueryStore();
    router.register(store, { toURL: () => ({ query: store.query }) });

    store.setQuery({ category: 'shoes' });
    await settle();

    expect(window.location.search + window.location.hash).to.equal(
      '?category=shoes#intro',
    );
  });

  it('keeps managing the hash of a store that stops producing it', async () => {
    history.replaceState(null, '', '/shop');
    router = createRouter();
    const drawer = new QueryStore();
    router.register(drawer, {
      toURL: () => (drawer.query.open ? { hash: { cart: 'open' } } : {}),
    });

    drawer.setQuery({ open: true });
    await settle();
    expect(window.location.hash).to.equal('#cart=open');

    drawer.setQuery({});
    await settle();
    expect(window.location.hash).to.equal('');
  });
});

describe('Router navigation', () => {
  let router;

  afterEach(() => {
    router?.destroy();
    history.replaceState(null, '', ORIGINAL_PATH);
  });

  it('goes to exactly the given URL', async () => {
    history.replaceState(null, '', '/shop?product=Boots#cart=open');
    router = createRouter();
    const view = new QueryStore();
    router.register(view, {
      onRoute: ({ query }) => view.setQuery(query),
      toURL: () => ({ query: view.query }),
    });
    await settle();

    await router.navigate('/about');
    await settle();

    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).to.equal('/about');
    expect(view.query).to.deep.equal({});
  });

  it('accepts a path with a query string and a hash', async () => {
    router = createRouter();
    const onRoute = spy();
    router.register(new TestStore(), { onRoute });

    await router.navigate('/search?term=shoes#results', {
      query: { page: '2' },
    });

    expect(onRoute.lastCall.args[0]).to.deep.equal({
      path: '/search',
      query: { term: 'shoes', page: '2' },
      hash: { results: '' },
    });
    expect(window.location.search).to.equal('?term=shoes&page=2');
    expect(window.location.hash).to.equal('#results');
  });

  it('resolves relative paths against the current document', async () => {
    history.replaceState(null, '', '/shop/list');
    router = createRouter();

    await router.navigate('item');
    expect(window.location.pathname).to.equal('/shop/item');

    await router.navigate('?page=2');
    expect(window.location.pathname + window.location.search).to.equal(
      '/shop/item?page=2',
    );
  });

  it('replaces the entry when navigating to the current URL', async () => {
    history.replaceState(null, '', '/same');
    router = createRouter();
    const recorder = recordHistory();
    try {
      await router.navigate('/same');
      await router.navigate('/same');
    } finally {
      recorder.restore();
    }

    expect(recorder.writes).to.deep.equal(['replace /same', 'replace /same']);
  });

  it('keeps plain fragments', async () => {
    history.replaceState(null, '', '/docs');
    router = createRouter();

    await router.navigate('/guide#intro');

    expect(window.location.pathname + window.location.hash).to.equal(
      '/guide#intro',
    );
  });

  it('rejects cross-origin URLs with a descriptive error', async () => {
    router = createRouter();

    const error = await router
      .navigate('https://example.com/x')
      .catch((e) => e);

    expect(error.message).to.match(/only same-origin URLs are supported/);
  });

  it('notifies every store, then rejects, when an onRoute handler throws', async () => {
    router = createRouter();
    const failure = new Error('onRoute failed');
    router.register(new TestStore(), {
      onRoute({ path }) {
        if (path === '/boom') throw failure;
      },
    });
    const onRoute = spy();
    router.register(new TestStore(), { onRoute });

    const error = await router.navigate('/boom').catch((e) => e);

    expect(error).to.equal(failure);
    expect(onRoute.lastCall.args[0].path).to.equal('/boom');
  });

  it('skips no store when an onRoute handler disposes its own registration', async () => {
    router = createRouter();
    const disposeFirst = router.register(new TestStore(), {
      onRoute({ path }) {
        if (path === '/leave') disposeFirst();
      },
    });
    const onRoute = spy();
    router.register(new TestStore(), { onRoute });

    await router.navigate('/leave');

    expect(onRoute.lastCall.args[0].path).to.equal('/leave');
  });

  it('restores the URL and rejects when a guard throws on Back/Forward', async () => {
    history.replaceState(null, '', '/b');
    const addEventListener = spy(window, 'addEventListener');
    router = createRouter();
    addEventListener.restore();
    const onPopState = addEventListener
      .getCalls()
      .find((call) => call.args[0] === 'popstate').args[1];
    const failure = new Error('guard failed');
    router.register(new TestStore(), {
      before() {
        throw failure;
      },
    });

    history.replaceState(null, '', '/a'); // the browser already moved
    const error = await onPopState(new PopStateEvent('popstate')).catch(
      (e) => e,
    );

    expect(error).to.equal(failure);
    expect(window.location.pathname).to.equal('/b');
  });
});

describe('router.go', () => {
  let router;

  afterEach(() => {
    router?.destroy();
    history.replaceState(null, '', ORIGINAL_PATH);
  });

  it('navigates to same-origin links, following the href exactly', async () => {
    history.replaceState(null, '', '/shop?product=Boots');
    router = createRouter();
    const view = new QueryStore();
    router.register(view, {
      onRoute: ({ query }) => view.setQuery(query),
      toURL: () => ({ query: view.query }),
    });
    await settle();

    const { prevented, navigate } = clickLink(router, { href: '/' });
    await settle();

    expect(prevented).to.equal(true);
    expect(navigate.calledOnceWith('/')).to.equal(true);
    expect(window.location.pathname + window.location.search).to.equal('/');
    expect(view.query).to.deep.equal({});
  });

  it('resolves relative hrefs like the browser does', async () => {
    history.replaceState(null, '', '/shop/list');
    router = createRouter();

    clickLink(router, { href: '?page=2' });
    await settle();
    expect(window.location.pathname + window.location.search).to.equal(
      '/shop/list?page=2',
    );

    clickLink(router, { href: 'item#reviews' });
    await settle();
    expect(window.location.pathname + window.location.hash).to.equal(
      '/shop/item#reviews',
    );
  });

  it('leaves same-page anchors to the browser', () => {
    history.replaceState(null, '', '/shop/list');
    router = createRouter();

    const { prevented, navigate } = clickLink(router, { href: '#reviews' });

    expect(prevented).to.equal(false);
    expect(navigate.callCount).to.equal(0);
  });

  it('ignores external, new-tab, download, modified and already handled clicks', () => {
    router = createRouter();
    const cases = [
      [{ href: 'https://example.com/' }],
      [{ href: '/report', target: '_blank' }],
      [{ href: '/report.pdf', download: '' }],
      [{ href: '/report' }, { eventInit: { metaKey: true } }],
      [{ href: '/report' }, { eventInit: { button: 1 } }],
      [{ href: '/report' }, { handledByApp: true }],
    ];

    for (const [attributes, options] of cases) {
      const { navigate } = clickLink(router, attributes, options);
      expect(
        navigate.callCount,
        JSON.stringify([attributes, options]),
      ).to.equal(0);
    }
  });

  it('finds links inside the shadow roots of nested components', async () => {
    router = createRouter();
    const nav = document.createElement('nav');
    const card = document.createElement('test-link-card');
    nav.append(card);
    nav.addEventListener('click', router.go);
    document.body.append(nav);
    const block = (event) => event.preventDefault();
    document.addEventListener('click', block);
    const navigate = spy(router, 'navigate');

    card.shadowRoot.querySelector('a').dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        composed: true,
        cancelable: true,
        button: 0,
      }),
    );

    navigate.restore();
    document.removeEventListener('click', block);
    nav.remove();
    await settle();
    expect(navigate.calledOnceWith('/product/1')).to.equal(true);
    expect(window.location.pathname).to.equal('/product/1');
  });
});

describe('Router registration', () => {
  let router;

  afterEach(() => {
    router?.destroy();
    history.replaceState(null, '', ORIGINAL_PATH);
  });

  it('throws a descriptive error for a non-observable store and registers nothing', async () => {
    router = createRouter();
    const onRoute = spy();

    expect(() => router.register({}, { onRoute, toURL: () => ({}) })).to.throw(
      TypeError,
      /expects an instance of a class passed to makeObservable\(\)/,
    );
    await router.navigate('/next');

    expect(onRoute.callCount).to.equal(0);
  });

  it('validates the options', () => {
    router = createRouter();
    const store = new TestStore();

    expect(() => router.register(store)).to.throw(
      TypeError,
      /requires an options object/,
    );
    expect(() => router.register(store, { onRoute: 'nope' })).to.throw(
      TypeError,
      /"onRoute" must be a function/,
    );
    expect(() => router.register(store, { toURL: () => 'x' })).to.throw(
      TypeError,
      /must return an object/,
    );
  });
});
