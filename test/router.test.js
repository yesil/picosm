import { spy } from 'sinon';
import { expect } from '@esm-bundle/chai';
import { makeObservable } from '../src/makeObservable.js';
import { createRouter } from '../src/router.js';

const flush = () => new Promise((r) => queueMicrotask(r));

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

describe('Router', () => {
  let router;

  afterEach(() => {
    router?.destroy();
    // Reset URL
    history.replaceState(null, '', window.location.pathname);
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

    await router.replace('/replaced', { query: { a: '1' }, hash: { section: 'top' } });

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
  const STORAGE_KEY = 'TestStore';

  afterEach(() => {
    router?.destroy();
    history.replaceState(null, '', window.location.pathname);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  });

  it('calls onRoute with stored data on registration when key exists', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ query: { category: 'shoes' } }));

    router = createRouter();
    const store = new TestStore();
    const onRoute = spy();

    router.register(store, {
      onRoute,
      toURL() { return { query: store.filters }; },
      storage: sessionStorage,
    });

    // onRoute called twice: once from storage restore, once from parseURL()
    expect(onRoute.callCount).to.equal(2);
    expect(onRoute.firstCall.args[0]).to.deep.equal({ query: { category: 'shoes' } });
  });

  it('does not call onRoute with stored data when key is absent', () => {
    router = createRouter();
    const store = new TestStore();
    const onRoute = spy();

    router.register(store, {
      onRoute,
      toURL() { return { query: store.filters }; },
      storage: sessionStorage,
    });

    expect(onRoute.callCount).to.equal(1); // only the normal parseURL() call
  });

  it('writes toURL result to storage when store changes', async () => {
    router = createRouter();
    const store = new TestStore();

    router.register(store, {
      onRoute({ query }) { store.setFilters(query); },
      toURL() { return { query: store.filters }; },
      storage: sessionStorage,
    });

    store.setFilters({ color: 'red' });
    await flush();
    await flush();

    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    expect(saved).to.deep.equal({ query: { color: 'red' } });
  });

  it('works with localStorage backend', async () => {
    router = createRouter();
    const store = new TestStore();

    router.register(store, {
      onRoute({ query }) { store.setFilters(query); },
      toURL() { return { query: store.filters }; },
      storage: localStorage,
    });

    store.setFilters({ size: 'large' });
    await flush();
    await flush();

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).to.deep.equal({ query: { size: 'large' } });
  });

  it('disposed registration stops writing to storage on store changes', async () => {
    router = createRouter();
    const store = new TestStore();

    const dispose = router.register(store, {
      onRoute({ query }) { store.setFilters(query); },
      toURL() { return { query: store.filters }; },
      storage: sessionStorage,
    });

    dispose();

    store.setFilters({ color: 'blue' });
    await flush();
    await flush();

    expect(sessionStorage.getItem(STORAGE_KEY)).to.be.null;
  });

  it('silently ignores malformed JSON in storage', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not valid json {{{');

    router = createRouter();
    const store = new TestStore();
    const onRoute = spy();

    expect(() => {
      router.register(store, {
        onRoute,
        toURL() { return {}; },
        storage: sessionStorage,
      });
    }).not.to.throw();

    expect(onRoute.callCount).to.equal(1); // only the normal parseURL() call
  });
});
