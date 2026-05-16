# picosm

picosm is a lightweight state manager for observable classes using explicit action declarations, computed getter caching, and batched notifications.

## Commands
- `npm test` — browser-based tests (web-test-runner + Chrome)
- `npm run build` — bundle with esbuild

## How picosm works

Classes are made observable by calling `makeObservable(MyClass)` and declaring two static arrays:
```js
class Store {
  static observableActions = ['doSomething'];   // methods that trigger notifications
  static computedProperties = ['derivedValue']; // getters that are cached between actions

  value = 0;

  doSomething() { this.value += 1; }
  get derivedValue() { return this.value * 2; }
}
makeObservable(Store);
```

Only methods listed in `observableActions` notify observers. Direct property assignment (`store.value = 5`) does NOT trigger reactivity.

## picosm API patterns

| What you want | picosm API |
|---|---|
| Make class observable | `makeObservable(MyClass)` called once, outside the class |
| Declare actions | `static observableActions = ['methodName']` |
| Declare computed | `static computedProperties = ['getterName']` |
| Mark fields observable | Not needed — actions notify, not field assignments |
| React to any change | `observe(target, callback)` |
| React to specific values | `reaction(target, (t) => [values], (...values) => ...)` |
| Connect observables | `track(target, source)` — forwards source notifications to target |
| Message passing | `subscribe(target, cb)` + `notify(target, msg)` |
| Lit integration | `makeLitObserver(MyElement)` + `observe: true` in properties |
| Async actions | List the method in `observableActions` — picosm detects the returned Promise |

**Routing:** picosm uses store-driven routing: `createRouter()` + `router.register(store, { onRoute, toURL, before })` — each store registers itself and owns its URL segment.

## Critical rules for generating picosm code

1. **Use static declarations** — `observableActions` declares methods that notify, and `computedProperties` declares cached getters
2. **Actions trigger notifications** — only calling an `observableAction` method triggers notifications, never direct property writes
3. **`makeObservable` takes the class** — called once after the class declaration, not in the constructor
4. **`reaction` selector must return an array** — return `[]` to skip, return `[value1, value2]` to trigger the effect
5. **Use picosm subscriptions directly** — `observe`, `reaction`, `track`, `subscribe`, `notify`, and `makeLitObserver` provide the reactive APIs
6. **Async actions notify after the returned Promise resolves** — list async methods in `observableActions`
7. **All subscriptions return disposer functions** — always call the disposer to clean up
8. **Notifications are batched via microtask** — observers fire asynchronously after the current synchronous block completes
9. **`observe` and `reaction` accept an optional `timeout` parameter** for throttling (milliseconds)

## Critical rules for router code

1. **No central route map** — each store registers itself and handles its own matching logic
2. **`createRouter()` takes no arguments** — the router is created clean, stores register after
3. **`router.register` returns a disposer** — always clean up when a store is no longer needed
4. **`onRoute` receives objects** — `{ path, query, hash }` where query and hash are parsed objects, never strings
5. **`toURL` results are cached** — only the changed store's `toURL` is called; URL is rebuilt from all cached results
6. **`router.go` is a property, not a method call** — bound click handler, same reference every render
7. **Stores own the state, URL is a side effect** — components observe stores, not the router
8. **`toURL` can return `replace: true`** — uses `replaceState` instead of `pushState` for store-triggered URL changes (e.g., filters)
9. **`before` is an async navigation guard** — returns `boolean` or `Promise<boolean>`, first `false` short-circuits
10. **`navigate` and `replace` are async** — they await `before` guards before proceeding
11. **Browser back/forward cannot be prevented** — the router detects via `popstate` and pushes the old URL back if a guard rejects
12. **`storage` persists `toURL()` result** — pass `storage: sessionStorage` or `storage: localStorage` to `register()`; saved on every store change, restored via `onRoute` on registration; key = `store.constructor.name`

## Architecture
- `src/makeObservable.js` — core: action instrumentation, computed caching, observe, subscribe/notify
- `src/reaction.js` — selective reaction to specific value changes
- `src/track.js` — forward notifications between observables
- `src/makeLitObserver.js` — LitElement integration via reactive controller
- `src/router.js` — store-driven URL routing via History API (separate export: `picosm/router`)
- `src/index.js` — barrel export (includes router)
- Tests are browser-based (web-test-runner), not Node
