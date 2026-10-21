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

`router.go` is a bound click handler for any element with `href`. Put it on the element that holds your links, and it handles all of them through event delegation:

```html
<nav>
  <a href="/">Home</a>
  <a href="/users/42?tab=posts">Posts</a>
  <a href="https://external.com">External</a>
</nav>
```

```javascript
// Plain DOM
document.querySelector('nav').addEventListener('click', router.go);

// Lit
html`<nav @click=${router.go}>...</nav>`;
```

A handled click becomes a `pushState` and a call to each store's `onRoute`, without a page load. The links stay plain links, so they work before your module loads and open in a new tab on Cmd-click.

Reads `href` from any element — `<a>`, `<sp-button href="...">` or any custom element — including links inside the shadow roots of nested components. Relative hrefs resolve like the browser resolves them. Left to the browser: links to other origins, clicks with a modifier key or another mouse button, links with a `target` other than `_self` or a `download` attribute, clicks a handler already called `preventDefault()` on, and same-page `#anchor` links.

## Refresh and deep links

Reload `/users/42?tab=posts`, or open it from a bookmark, and the browser asks the server for that path. When the page loads, `register` reads the current URL and calls `onRoute` with it, so each store comes back in the state the URL describes. Back and Forward go through `onRoute` too.

That needs two things:
- The server returns your `index.html` for every app path. Locally, `npx web-dev-server --app-index index.html` does this; on nginx it's `try_files $uri /index.html;`.
- Asset URLs are root-absolute, as in `/app.js` rather than `./app.js`: a page served at `/users/42` would resolve `./app.js` to `/users/app.js`.

GitHub Pages has no rewrite rule, so keep page state in the query string or the hash there (`/?user=42`), which needs nothing from the server.

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
