# picosm

[![npm version](https://img.shields.io/npm/v/picosm.svg)](https://www.npmjs.com/package/picosm)
[![npm downloads](https://img.shields.io/npm/dm/picosm.svg)](https://www.npmjs.com/package/picosm)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/picosm.svg)](https://bundlephobia.com/package/picosm)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://www.npmjs.com/package/picosm?activeTab=dependencies)
[![license](https://img.shields.io/npm/l/picosm.svg)](LICENSE)
[![CI](https://github.com/yesil/picosm/actions/workflows/ci.yml/badge.svg)](https://github.com/yesil/picosm/actions/workflows/ci.yml)

Lightweight, zero-dependency state manager for observable classes using explicit action declarations, computed getter caching, and batched notifications.

```bash
npm install picosm
```

Available on [npm](https://www.npmjs.com/package/picosm).

## Features

- **Explicit action notifications** — classes are instrumented via static declarations
- **Microtask batching** — multiple synchronous actions coalesce into a single notification
- **Async actions** — handles both `async` functions and promise-returning methods, including rejections
- **Computed caching** — getter values are cached until invalidated by an action
- **Throttled observe** — built-in throttling for high-frequency updates
- **Lit integration** — `makeLitObserver` wires observable properties to `requestUpdate` automatically
- **Store-driven routing** — `createRouter` syncs multiple stores with the browser History API, with optional sessionStorage/localStorage persistence
- **Descriptive errors** — misconfigured classes, non-observable targets and notification cycles throw errors that say what to fix
- **Tree-shakeable** — import only what you need from individual modules

## Live tour

[yesil.github.io/picosm/examples](https://yesil.github.io/picosm/examples/) runs every capability on one page, on a shared coffee-shop model: actions and batching, computed getters, async actions, throttled observers, reactions, tracking, messages, the Lit integration and the router, with an activity log of what happens underneath. Run it locally with `npm run dev`.

## Quick start

```javascript
import { makeObservable, observe } from 'picosm';

class Counter {
  static observableActions = ['increment'];
  static computedProperties = ['total'];

  value = 0;
  otherValue = 0;

  increment() {
    this.value += 1;
  }

  get total() {
    return this.value + this.otherValue;
  }
}

makeObservable(Counter);

const counter = new Counter();
const disposer = observe(counter, () => console.log('changed:', counter.value));

counter.increment(); // logs: "changed: 1"
disposer();          // stops observing
```

Only methods listed in `observableActions` trigger notifications. Calling unlisted methods mutates state silently — useful for internal helpers or batch setup.

Observers are also notified, and computed values reset, when an action throws or its promise rejects: state changed before the error is never left stale.

## API

### `makeObservable(constructor)`

Instruments a class with observable capabilities. Call once per class.

The class should declare:
- `static observableActions` — method names that notify observers after execution
- `static computedProperties` — getter names whose values are cached until the next action

Listed names must be methods and getters of the class or of its parent classes. Anything else throws, including arrow functions assigned to class fields, which live on each instance rather than on the class:

```javascript
class Store {
  static observableActions = ['increment'];
  increment = () => {}; // TypeError: "increment" is listed in observableActions but is not a method
}
```

A subclass of an observable class can call `makeObservable` too, to instrument the actions and getters it adds.

### `observe(target, callback, timeout?)`

Registers a `callback` that fires when any observable action completes on `target`.

Returns a **disposer** function.

```javascript
// Immediate — fires after observable actions, batched by microtask
const disposer = observe(counter, () => console.log('changed'));

// Throttled — fires at most once per 200ms, with trailing edge
const disposer = observe(counter, () => console.log('changed'), 200);
```

Disposing a throttled observer also cancels its pending trailing call.

Notifications are batched via microtask: multiple synchronous actions on the same target produce a single callback invocation.

### `reaction(target, selector, effect, timeout?)`

Runs `selector(target)` once to record the starting values, then after each action. When the returned array differs element-wise (compared with `Object.is`) from the previous result, calls `effect(...values)`. Return an empty array from `selector` to skip execution.

Returns a **disposer** function.

```javascript
import { reaction } from 'picosm';

const disposer = reaction(
  counter,
  ({ value }) => [value],
  (value) => console.log('Value changed to', value),
);
counter.increment(); // logs: "Value changed to 1"
disposer();
```

#### Multiple targets

Pass an array of targets. The `selector` receives them as positional arguments:

```javascript
const disposer = reaction(
  [storeA, storeB],
  (a, b) => {
    const sum = a.counter + b.counter;
    return sum % 5 === 0 && sum !== 0 ? [sum] : [];
  },
  (sum) => console.log('Sum divisible by 5:', sum),
);
```

### `track(target, source)`

Forwards notifications: when `source` changes, `target`'s observers are notified and its computed properties are invalidated. Tracking that would form a cycle, such as `track(a, b)` together with `track(b, a)`, throws.

Returns a **disposer** function.

```javascript
import { track, observe } from 'picosm';

const parent = new Counter();
const child = new Counter();

const untrack = track(parent, child);

observe(parent, () => {
  console.log('child changed, parent notified');
});

child.increment(); // triggers both child and parent observers
untrack();
```

### `subscribe(target, callback)` / `notify(target, message)`

A message-passing channel over any observable. Unlike `observe`, messages are delivered synchronously and carry an explicit payload.

Returns a **disposer** function (from `subscribe`).

```javascript
import { subscribe, notify } from 'picosm';

const disposer = subscribe(counter, (msg) => console.log('Received:', msg));
notify(counter, { type: 'reset', value: 0 });
disposer();
```

### `makeLitObserver(constructor)`

Enhances a `LitElement` class to automatically observe properties marked with `observe: true`. When the observed object's actions fire, the component calls `requestUpdate`.

```javascript
import { html, LitElement } from 'lit';
import { makeLitObserver } from 'picosm';

class MyView extends LitElement {
  static properties = {
    counter: { type: Object, observe: true },
    // throttled: only re-render at most once per 200ms
    stats: { type: Object, observe: true, throttle: 200 },
  };

  render() {
    return html`<p>Count: ${this.counter?.value}</p>`;
  }
}

customElements.define('my-view', makeLitObserver(MyView));
```

When a new object is assigned to an observed property, the old observer is disposed and a new one is bound automatically. Inherited properties and properties declared with the `@property({ observe: true })` decorator are observed too. Assigning a value that is not an observable instance to such a property throws.

## Async actions

Actions that return a `Promise` (whether declared `async` or not) notify observers after the promise settles, whether it resolves or rejects:

```javascript
class Store {
  static observableActions = ['fetchData'];
  data = null;

  async fetchData() {
    const res = await fetch('/api/data');
    this.data = await res.json();
  }
}

makeObservable(Store);
```

Intermediate state changes within an async action are not observable until the action completes. If you need to notify observers mid-action, split it into separate actions. For the same reason, a method that returns a Promise which only settles later (a confirmation dialog waiting for the user, say) should not be an action: make the synchronous part an action and return the Promise from a plain method.

## Router

`createRouter` coordinates multiple stores with the browser History API. Each store registers itself and decides what part of the URL it owns. The router parses and serializes query/hash as objects — stores never touch strings.

```javascript
import { createRouter } from 'picosm';

const router = createRouter();
```

### Registering stores

```javascript
// appStore owns the path
router.register(appStore, {
  onRoute({ path }) {
    if (path === '/') appStore.setRoute('home');
    else if (path.startsWith('/users')) appStore.setRoute('users');
  },
  toURL() {
    return { path: appStore.path };
  },
});

// searchStore owns query params
router.register(searchStore, {
  onRoute({ query }) {
    searchStore.setFilters(query);
  },
  toURL() {
    return { query: searchStore.filters };
  },
});
```

Each `register` call returns a disposer. The options object supports these optional fields:
- `onRoute({ path, query, hash })` — URL to store. Called on registration, navigate, replace, and popstate.
- `toURL()` — store to URL. Returns `{ path?, query?, hash?, replace? }`. The router merges results from all stores and syncs to the browser. `null`, `undefined` and `''` values leave a key out; in `hash`, `''` gives a bare key (`#intro`).
- `before({ path, query, hash })` — navigation guard. Return `false` or `Promise<false>` to block navigation.
- `storage` and `key` — `sessionStorage` or `localStorage`, and the storage key to use. Persists the query and hash of `toURL()` and restores them on registration.

When a registered store changes, the router calls every store's `toURL` and rebuilds the URL, so stores that change together produce a single history entry. Keys a store stops returning disappear. A new entry is pushed unless every store whose output changed returns `replace: true`, so each store controls its own history behavior:

```javascript
// Filter changes replace the current history entry
router.register(filterStore, {
  onRoute({ query }) { filterStore.setFilters(query); },
  toURL() {
    return { query: filterStore.filters, replace: true };
  },
});

// Page navigation pushes a new history entry
router.register(appStore, {
  onRoute({ path }) { appStore.setRoute(path); },
  toURL() {
    return { path: appStore.path };
  },
});
```

Store changes caused by the router itself — registration, `navigate`, `replace`, Back and Forward — never push. If a store rewrites the URL it was just routed to (a default value, a canonical form), the current entry is replaced instead. The path, query or hash is left as it is until some store produces it, so a store that only manages the query keeps a plain `#anchor` intact.

### Navigation

```javascript
router.navigate('/users/42');
router.navigate('/users/42?tab=posts#top');
router.navigate('/users/42', { query: { tab: 'posts' }, hash: { section: 'top' } });
router.replace('/login');
router.back();
router.forward();
router.destroy();
```

`navigate` and `replace` go to exactly the URL they are given, like a link would: other stores receive a route without their params. Paths may be relative and carry a query string and a hash, which `query` and `hash` options extend. Navigating to the current URL replaces the entry instead of adding a duplicate. To change one store's part of the URL and keep the rest, call the store's action instead: its `toURL` updates the URL.

### Event delegation

`router.go` is a bound click handler for any element with `href`. One handler on a parent, works for all links via event delegation:

```javascript
html`
  <nav @click=${router.go}>
    <a href="/">Home</a>
    <a href="/users">Users</a>
    <a href="https://external.com">External</a>
  </nav>
`
```

Reads `href` from any element — `<a>`, `<sp-button href="...">` or any custom element — including links inside the shadow roots of nested components. Relative hrefs resolve like the browser resolves them. Left to the browser: links to other origins, clicks with a modifier key or another mouse button, links with a `target` other than `_self` or a `download` attribute, clicks a handler already called `preventDefault()` on, and same-page `#anchor` links.

### Navigation guards

Stores can register a `before` hook to block navigation when state is dirty. Guards support async — use a custom modal instead of `confirm()`:

```javascript
router.register(formStore, {
  onRoute({ path }) { formStore.setRoute(path); },
  async before({ path, query, hash }) {
    if (formStore.isDirty) {
      return await showConfirmDialog('You have unsaved changes. Leave?');
    }
    return true;
  },
});
```

Guards run sequentially — the first `false` short-circuits, no further guards are called. For browser back/forward, the guard runs after the URL changes and pushes the old URL back if rejected. If a guard throws, the old URL is restored as well and the error propagates.

### Persisting store state

Pass `storage: sessionStorage` or `storage: localStorage`, with a `key`, to persist a store's URL state across page loads. Whenever the store's `toURL()` output changes, its query and hash are written to storage. On registration, stored values fill in the keys missing from the current URL — params in the URL win — then `onRoute` receives the combined route and the URL is updated with `replaceState`. `storage` requires `key`, `onRoute` and `toURL`, and a stored value that is not valid JSON throws an error naming the key.

```javascript
router.register(filterStore, {
  onRoute({ query }) { filterStore.setFilters(query); },
  toURL() { return { query: filterStore.filters }; },
  storage: sessionStorage,  // survives page refresh; use localStorage to survive browser restart
  key: 'filters',
});
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, the testing model, and conventions. [Open an issue](https://github.com/yesil/picosm/issues) to request a feature or report a bug.

## Links

- [npm package](https://www.npmjs.com/package/picosm)
- [GitHub repository](https://github.com/yesil/picosm)
- [Live tour](https://yesil.github.io/picosm/examples/)
- [Issue tracker](https://github.com/yesil/picosm/issues)

## License

[ISC](LICENSE) © Ilyas Türkben
