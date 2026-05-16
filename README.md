# picosm

Lightweight, zero-dependency state manager for observable classes using explicit action declarations, computed getter caching, and batched notifications.

```bash
npm install picosm
```

## Features

- **Explicit action notifications** — classes are instrumented via static declarations
- **Microtask batching** — multiple synchronous actions coalesce into a single notification
- **Async actions** — handles both `async` functions and promise-returning methods
- **Computed caching** — getter values are cached until invalidated by an action
- **Throttled observe** — built-in throttling for high-frequency updates
- **Lit integration** — `makeLitObserver` wires observable properties to `requestUpdate` automatically
- **Store-driven routing** — `createRouter` syncs multiple stores with the browser History API, with optional sessionStorage/localStorage persistence
- **Tree-shakeable** — import only what you need from individual modules

## Demos

- [Shopping cart](https://yesil.github.io/picosm/examples/cart/index.html) — Lit + Spectrum Web Components + Router (filters, product detail, cart drawer)
- [Stars canvas](https://yesil.github.io/picosm/examples/stars/index.html) — throttled observer + tracking connected stars (use metakey to connect)
- [Minigame](https://yesil.github.io/picosm/examples/minigame/index.html)

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

## API

### `makeObservable(constructor)`

Instruments a class with observable capabilities. Call once per class.

The class should declare:
- `static observableActions` — method names that notify observers after execution
- `static computedProperties` — getter names whose values are cached until the next action

### `observe(target, callback, timeout?)`

Registers a `callback` that fires when any observable action completes on `target`.

Returns a **disposer** function.

```javascript
// Immediate — fires after observable actions, batched by microtask
const disposer = observe(counter, () => console.log('changed'));

// Throttled — fires at most once per 200ms, with trailing edge
const disposer = observe(counter, () => console.log('changed'), 200);
```

Notifications are batched via microtask: multiple synchronous actions on the same target produce a single callback invocation.

### `reaction(target, selector, effect, timeout?)`

Runs `selector(target)` after each action. When the returned array differs element-wise from the previous result, calls `effect(...values)`. Return an empty array from `selector` to skip execution.

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

Forwards notifications: when `source` changes, `target`'s observers are notified and its computed properties are invalidated.

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

When a new object is assigned to an observed property, the old observer is disposed and a new one is bound automatically.

## Async actions

Actions that return a `Promise` (whether declared `async` or not) notify observers after the promise resolves:

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

Intermediate state changes within an async action are not observable until the action completes. If you need to notify observers mid-action, split it into separate actions.

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
- `toURL()` — store to URL. Returns `{ path?, query?, hash?, replace? }`. The router merges results from all stores and syncs to the browser.
- `before({ path, query, hash })` — navigation guard. Return `false` or `Promise<false>` to block navigation.
- `storage` — `sessionStorage` or `localStorage`. Persists the `toURL()` result and restores it via `onRoute` on registration.

Each store's `toURL` result is cached. When a store changes, only that store's `toURL` is called — the URL is rebuilt from all cached results. Removed keys disappear cleanly. If `toURL` returns `replace: true`, the router uses `replaceState` instead of `pushState`. Each store controls its own history behavior:

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

### Navigation

```javascript
router.navigate('/users/42');
router.navigate('/users/42', { query: { tab: 'posts' }, hash: { section: 'top' } });
router.replace('/login');
router.back();
router.forward();
router.destroy();
```

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

Skips external links, respects cmd/ctrl+click for new tab, reads `href` from any element — works with `<a>`, `<sp-button href="...">`, or any custom element.

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

Guards run sequentially — the first `false` short-circuits, no further guards are called. For browser back/forward, the guard runs after the URL changes and pushes the old URL back if rejected.

### Persisting store state

Pass `storage: sessionStorage` or `storage: localStorage` to persist a store's URL state across page loads. On each store change the `toURL()` result is written to storage; on registration the stored value is passed to `onRoute` before the current URL is applied. The storage key is the store's class name.

```javascript
router.register(filterStore, {
  onRoute({ query }) { filterStore.setFilters(query); },
  toURL() { return { query: filterStore.filters }; },
  storage: sessionStorage,  // survives page refresh; use localStorage to survive browser restart
});
```

## Contributing

- Open a PR to contribute
- [Create an issue](https://github.com/yesil/picosm/issues) to request a feature or report a bug
