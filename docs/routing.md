# Router

`createRouter` coordinates multiple stores with the browser History API. Each store registers itself and decides what part of the URL it owns. The router parses and serializes query/hash as objects — stores never touch strings.

```javascript
import { createRouter } from 'picosm';

const router = createRouter();
```

## Registering stores

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

## Navigation

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

## Event delegation

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

## Navigation guards

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

## Persisting store state

Pass `storage: sessionStorage` or `storage: localStorage`, with a `key`, to persist a store's URL state across page loads. Whenever the store's `toURL()` output changes, its query and hash are written to storage. On registration, stored values fill in the keys missing from the current URL — params in the URL win — then `onRoute` receives the combined route and the URL is updated with `replaceState`. `storage` requires `key`, `onRoute` and `toURL`, and a stored value that is not valid JSON throws an error naming the key.

```javascript
router.register(filterStore, {
  onRoute({ query }) { filterStore.setFilters(query); },
  toURL() { return { query: filterStore.filters }; },
  storage: sessionStorage,  // survives page refresh; use localStorage to survive browser restart
  key: 'filters',
});
```

For a worked example, see [routing with the History API](history-routing.md).
