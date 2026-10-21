# picosm usage guide for coding assistants

This guide is for coding assistants writing code against **picosm 3.0.0**, a class-based state manager. It works with plain DOM code and Web Components; Lit integration is optional.

## Authoritative sources

- [Complete single-file app](https://yesil.github.io/picosm/docs/index.md)
- [How it works](https://yesil.github.io/picosm/docs/how-it-works.md)
- [API reference](https://yesil.github.io/picosm/docs/api.md)
- [Lit integration](https://yesil.github.io/picosm/docs/lit.md)
- [Router reference](https://yesil.github.io/picosm/docs/routing.md)
- [npm release](https://www.npmjs.com/package/picosm/v/3.0.0)
- [Source](https://github.com/yesil/picosm)

## Core contract

1. Pass the class to `makeObservable(Store)` once, after its declaration. Never pass an instance or call it from the constructor.
2. Declare notifying methods with `static observableActions = ['method']`. Names must resolve to prototype methods on the class or a parent. Arrow-function instance fields cannot be instrumented.
3. Declare cached getters with `static computedProperties = ['getter']`. Fields need no observable declaration.
4. Only actions notify and invalidate computed caches. Direct assignments remain silent. Every action invalidates all cached getters on that instance when it completes; cache invalidation does not happen midway through the action.
5. Notifications are batched in a microtask. `observe` does not immediately invoke its callback. Render initial state explicitly, and await the microtask before asserting observer effects.
6. Async actions notify after the returned Promise settles, including rejection. Synchronous throws notify too. Errors propagate. Split a loading-state update into a synchronous action if it must appear before the async operation finishes.
7. `reaction(target, selector, effect, timeout?)` requires the selector to return an array. Its first result is a baseline; subsequent changes use `Object.is` element-wise. Return `[]` to skip. Multiple targets are passed to the selector as positional arguments.
8. `observe`, `reaction`, `track`, and `subscribe` return disposer functions. Keep and invoke them when the view or relationship is removed.
9. `track(target, source)` forwards source notifications and computed invalidation to target. Self-tracking or any cycle throws.
10. `subscribe` / `notify` deliver explicit messages synchronously. `notify` is not a replacement for an observable action.
11. Optional throttling uses the last argument of `observe` or `reaction`, in milliseconds.

## Complete vanilla JavaScript example

Given `<button id="increment">Add one</button><output id="count"></output>` before the module, this works with a bundler or with the import map from the single-file app:

```javascript
import { makeObservable, observe } from 'picosm';

class Counter {
  static observableActions = ['increment'];
  static computedProperties = ['double'];
  value = 0;
  increment() {
    this.value += 1;
  }
  get double() {
    return this.value * 2;
  }
}

makeObservable(Counter);
const counter = new Counter();
const button = document.querySelector('#increment');
const output = document.querySelector('#count');
const render = () => {
  output.textContent = String(counter.double);
};
const increment = () => counter.increment();
const dispose = observe(counter, render);
button.addEventListener('click', increment);
render();

export function unmount() {
  dispose();
  button.removeEventListener('click', increment);
}
```

## Lit integration

Import `makeLitObserver` from `picosm`. Declare a component property with `{ attribute: false, observe: true }`, initialize it with an observable store instance, and register with `customElements.define('my-view', makeLitObserver(MyView))`. The integration disposes subscriptions when the host disconnects or the store is replaced and restores them on reconnection. Reconnection observes future actions; if state can change while disconnected, call `super.connectedCallback()` and `this.requestUpdate()` in the component's `connectedCallback` to refresh missed changes. `throttle: 200` can be set on an observed property. Do not add a parallel manual subscription for the same rendering behavior.

## Router contract

- Import `createRouter` from `picosm/router` or `picosm`. Call `createRouter()` with no arguments. Each store registers itself; do not invent a central route map.
- `router.register(store, { onRoute, toURL, before, storage, key })` returns a disposer. `onRoute` and `before` receive `{ path, query, hash }`; query and hash are objects.
- `toURL()` returns `{ path?, query?, hash?, replace? }`. The router merges all registered outputs after store changes. Query/hash keys no store returns are omitted; register owners for values that must survive.
- Change one store's URL portion through its actions. `await router.navigate(url)` and `await router.replace(url)` go to exactly the supplied URL, rather than preserving other stores' parameters.
- `router.go` is a stable, bound event handler, not a function to call during render. Use `<nav @click=${router.go}>` in Lit.
- Async `before` guards return a boolean or Promise of a boolean; the first false short-circuits. Browser Back/Forward has already moved before a rejecting guard pushes the old URL back.
- Storage requires a unique `key`, `onRoute`, and `toURL`. Only the query/hash output is persisted. URL keys win over stored values on registration.
- Route-driven changes canonicalize with `replaceState`, not push. Dispose each registration and call `router.destroy()` when removing the router.

## Common incorrect suggestions

Do not suggest decorators for field observation, `makeObservable(this)`, arrow-field actions, direct property writes as reactive updates, scalar reaction selectors, or notifying a loading state midway through one async action. Do not assume a router path fallback exists on static hosting.

Use the public APIs rather than internal `__` methods. Check the release and source before using behavior not described here.
