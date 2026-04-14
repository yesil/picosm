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

  it('calls onRoute on navigate', () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    router.register(store, { onRoute });

    router.navigate('/test-path', { query: { foo: 'bar' } });

    expect(onRoute.callCount).to.equal(2); // registration + navigate
    const data = onRoute.secondCall.args[0];
    expect(data.path).to.equal('/test-path');
    expect(data.query).to.deep.equal({ foo: 'bar' });
    expect(data.hash).to.deep.equal({});
  });

  it('calls onRoute on replace', () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    router.register(store, { onRoute });

    router.replace('/replaced', { query: { a: '1' }, hash: { section: 'top' } });

    expect(onRoute.callCount).to.equal(2);
    const data = onRoute.secondCall.args[0];
    expect(data.path).to.equal('/replaced');
    expect(data.query).to.deep.equal({ a: '1' });
    expect(data.hash).to.deep.equal({ section: 'top' });
  });

  it('register returns a disposer', () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    const dispose = router.register(store, { onRoute });

    router.navigate('/before');
    expect(onRoute.callCount).to.equal(2);

    dispose();

    router.navigate('/after');
    expect(onRoute.callCount).to.equal(2); // not called again
  });

  it('supports multiple store registrations', () => {
    router = createRouter();
    const onRouteA = spy();
    const onRouteB = spy();
    const storeA = new TestStore();
    const storeB = new TestStore();

    router.register(storeA, { onRoute: onRouteA });
    router.register(storeB, { onRoute: onRouteB });

    router.navigate('/multi');

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

    router.navigate('/products', { query: { category: 'shoes' } });
    await flush();

    // Both stores should have their state
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

    // Store action triggers URL update
    store.setFilters({ color: 'red' });
    await flush(); // microtask for observer notification
    await flush(); // microtask for pushState

    expect(window.location.search).to.include('color=red');
  });

  it('handles navigate with query and hash objects', () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    router.register(store, { onRoute });

    router.navigate('/path', {
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

  it('destroy removes all registrations', () => {
    router = createRouter();
    const onRoute = spy();
    const store = new TestStore();
    router.register(store, { onRoute });

    router.destroy();
    router.navigate('/after-destroy');

    // onRoute only called once (at registration), not after destroy
    expect(onRoute.callCount).to.equal(1);
  });
});
