# picosm

picosm is a lightweight state manager for observable classes using explicit action declarations, computed getter caching, and batched notifications.

## Commands
- `npm test` — browser-based tests (web-test-runner + Chrome)
- `npm run build` — bundle with esbuild
- `npm run dev` — serve the live tour of every capability (`examples/index.html`)

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

1. **Use static declarations** — `observableActions` declares methods that notify, and `computedProperties` declares cached getters; listed names must be methods/getters of the class or a parent class (not arrow-function class fields), otherwise `makeObservable` throws
2. **Actions trigger notifications** — only calling an `observableAction` method triggers notifications, never direct property writes
3. **`makeObservable` takes the class** — called once after the class declaration, not in the constructor
4. **`reaction` selector must return an array** — return `[]` to skip, return `[value1, value2]` to trigger the effect
5. **Use picosm subscriptions directly** — `observe`, `reaction`, `track`, `subscribe`, `notify`, and `makeLitObserver` provide the reactive APIs
6. **Async actions notify after the returned Promise settles** — list async methods in `observableActions`; rejected promises and thrown errors notify too. A method whose Promise waits on something else (e.g. user input) must not be an action: make its synchronous part an action instead
7. **All subscriptions return disposer functions** — always call the disposer to clean up
8. **Notifications are batched via microtask** — observers fire asynchronously after the current synchronous block completes
9. **`observe` and `reaction` accept an optional `timeout` parameter** for throttling (milliseconds)
10. **`track` cannot form cycles** — `track(a, b)` plus `track(b, a)` (or `track(a, a)`) throws

## Critical rules for router code

1. **No central route map** — each store registers itself and handles its own matching logic
2. **`createRouter()` takes no arguments** — the router is created clean, stores register after
3. **`router.register` returns a disposer** — always clean up when a store is no longer needed
4. **`onRoute` receives objects** — `{ path, query, hash }` where query and hash are parsed objects, never strings
5. **Every store change rebuilds the URL from all stores' `toURL`** — stores changing together produce one history entry, pushed unless every store whose output changed returns `replace: true`
6. **`router.go` is a property, not a method call** — bound click handler, same reference every render; it leaves other origins, modified clicks, `target`/`download` links and same-page `#anchors` to the browser
7. **Stores own the state, URL is a side effect** — components observe stores, not the router
8. **`toURL` can return `replace: true`** — uses `replaceState` instead of `pushState` for store-triggered URL changes (e.g., filters)
9. **`before` is an async navigation guard** — returns `boolean` or `Promise<boolean>`, first `false` short-circuits
10. **`navigate` and `replace` are async** — they await `before` guards before proceeding, then go to exactly the given URL (relative paths, `?query` and `#hash` allowed); other stores receive a route without their params, so change one store's part of the URL through that store's actions
11. **Browser back/forward cannot be prevented** — the router detects via `popstate` and pushes the old URL back if a guard rejects
12. **`storage` requires `key`** — pass `storage: sessionStorage` or `storage: localStorage` with `key: 'unique-name'` (plus `onRoute` and `toURL`) to `register()`; the query/hash of `toURL()` is saved whenever it changes, and on registration stored values fill in the keys missing from the URL
13. **Route-driven store changes never push** — when registration, `navigate`, `replace` or Back/Forward make a store rewrite the URL (defaults, canonical forms), the router uses `replaceState`

## Architecture
- `src/makeObservable.js` — core: action instrumentation, computed caching, observe, subscribe/notify
- `src/reaction.js` — selective reaction to specific value changes
- `src/track.js` — forward notifications between observables
- `src/makeLitObserver.js` — LitElement integration via reactive controller
- `src/router.js` — store-driven URL routing via History API (separate export: `picosm/router`)
- `src/internal.js` — shared helpers (`assertObservable`, `reportAsync`), not exported from the barrel
- `src/index.js` — barrel export (includes router)
- Tests are browser-based (web-test-runner), not Node
- `examples/` — the live tour: one page, one shared coffee-shop model, a card per capability
