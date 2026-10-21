# How it works

## Stores are classes

A store is any class you pass to `makeObservable`, once, right after declaring it. Two static lists tell picosm what to do:

- `observableActions`: the methods that change state. Subscribers are notified after one runs.
- `computedProperties`: the getters to cache. Any action clears the cache.

Fields need no declaration, and inside an action you can mutate them however you like: `this.items.push(item)` is fine. Assigning a field from outside an action, as in `cart.items = []`, changes it without telling anyone, so put every change a view cares about in an action.

Actions have to be real methods. An arrow function assigned to a class field lives on each instance, so picosm can't wrap it, and `makeObservable` throws.

## Views subscribe

`observe(cart, render)` calls `render` after each action and returns a function that stops it. It doesn't call `render` up front, so render once yourself. A custom element subscribes in `connectedCallback` and disposes in `disconnectedCallback`, as the cart above does. Lit components get both from [`makeLitObserver`](lit.md).

To react only when particular values change, use [`reaction`](api.md#reactiontarget-selector-effect-timeout) with a selector that returns an array, such as `(cart) => [cart.total]`. It compares each value with `Object.is`, so select values rather than an array you mutate in place.

## Updates are batched

Actions run straight away. Subscribers run once, in a microtask, after the current code finishes, so two actions in one click render once. An async action notifies when its Promise settles, which means a loading flag has to be set by a separate synchronous action. See [async actions](api.md#async-actions). An action that throws notifies too, after clearing cached getters, so state it changed before the error isn't left stale, and the error still reaches the caller.

## Without a bundler

The browser resolves `picosm` through the import map, so pin the version in the URL. If you install from npm and serve `node_modules`, point the map at `node_modules/picosm/dist/picosm.js` instead. The router is in the same file: map `picosm/router` to it as well, or import `createRouter` from `picosm`.

Browsers won't load module files from `file://` URLs, so serve the folder over HTTP, even locally.

To load only part of the library, import its modules one by one from `picosm/src/`: `makeObservable.js` (which also exports `observe`, `subscribe` and `notify`), `reaction.js`, `track.js`, `makeLitObserver.js` and `router.js`. Map the prefix once in the import map, as in `"picosm/src/": "https://cdn.jsdelivr.net/npm/picosm@3.0.0/src/"`. These paths have no type declarations.

This setup works in Chrome 93, Firefox 108 and Safari 16.4 or later, the first versions with both import maps and every built-in picosm uses.

When you install from npm, `picosm` and `picosm/router` come with TypeScript declarations, so editors complete and check the API in TypeScript files and in JavaScript files with `// @ts-check`.

## The trade-off

You write a method for every change a view should see, and cached getters are cleared per instance rather than per field. There's no state history and no devtools panel. In return, every update is a named method you can find by reading the class.
