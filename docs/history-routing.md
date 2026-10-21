# Routing with the History API

Links stay plain `<a href>` elements. One click handler, `router.go`, turns clicks on them into History API navigation instead of page loads, and the store that owns the page state registers with the router. Reload a deep link such as `/menu/latte?size=large` and the page comes back in the same state.

## Links without page loads

The page is static HTML. The module script uses a root-absolute URL; the [refresh section](#refresh-and-deep-links) explains why.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Menu</title>
    <script type="importmap">
      {
        "imports": {
          "picosm": "https://cdn.jsdelivr.net/npm/picosm@3.0.0/dist/picosm.js",
          "picosm/router": "https://cdn.jsdelivr.net/npm/picosm@3.0.0/dist/picosm.js"
        }
      }
    </script>
    <script type="module" src="/app.js"></script>
  </head>
  <body>
    <nav>
      <a href="/menu/espresso">Espresso</a>
      <a href="/menu/latte">Caffè latte</a>
      <a href="/menu/chai?size=large">Large chai</a>
    </nav>
    <h1 id="title"></h1>
    <label><input id="large" type="checkbox" /> Large</label>
  </body>
</html>
```

One `Menu` store owns both values in the URL: the drink in the path and the size in the query. It's the store you register. Don't add a separate store just to hold URL values, because that's a second copy to keep in sync.

```javascript
import { makeObservable, observe } from 'picosm';
import { createRouter } from 'picosm/router';

class Menu {
  static observableActions = ['show', 'setSize'];
  drinks = { espresso: 'Espresso', latte: 'Caffè latte', chai: 'Chai' };
  drink = null;
  size = 'regular';

  show(id) {
    this.drink = Object.hasOwn(this.drinks, id) ? id : null;
  }

  setSize(size) {
    this.size = size === 'large' ? 'large' : 'regular';
  }
}

makeObservable(Menu);
const menu = new Menu();
const router = createRouter();

router.register(menu, {
  onRoute({ path, query }) {
    menu.show(path.split('/')[2]);
    menu.setSize(query.size);
  },
  toURL() {
    return {
      path: menu.drink ? `/menu/${menu.drink}` : '/menu',
      query: { size: menu.size === 'large' ? 'large' : null },
      replace: true,
    };
  },
});
document.addEventListener('click', router.go);

const title = document.querySelector('#title');
const large = document.querySelector('#large');
const render = () => {
  title.textContent = menu.drink
    ? `${menu.size === 'large' ? 'Large' : 'Regular'} ${menu.drinks[menu.drink]}`
    : 'Pick a drink';
  large.checked = menu.size === 'large';
  large.disabled = !menu.drink;
};
large.addEventListener('change', () =>
  menu.setSize(large.checked ? 'large' : 'regular'),
);
observe(menu, render);
render();
```

`document.addEventListener('click', router.go)` is all the link handling the page needs. A click on any same-origin `href` becomes a `pushState` and a call to `onRoute` instead of a page load. The links are still real links, so they work before the module has loaded and open in a new tab on Cmd-click. `router.go` leaves those clicks to the browser, along with links to other sites, `target` and `download` links, and same-page `#anchors`. It also finds links inside the shadow roots of custom elements.

Links and the checkbox write the URL differently. A link is a destination: it pushes a history entry, and the store gets exactly that URL, so `/menu/latte` resets the size to regular. The checkbox calls an action, and `toURL` writes the new `?size=` with `replaceState` because of `replace: true`, so toggling the size doesn't add Back-button entries.

## Refresh and deep links

Reload `/menu/latte?size=large`, or open it from a bookmark, and the browser asks the server for that path. Once the page loads, `router.register` reads the current URL and calls `onRoute` with `{ path: '/menu/latte', query: { size: 'large' } }`, which puts the store back in the same state. Back and Forward work the same way, through `popstate`.

That takes two things:

- **The server returns `index.html` for every app path.** Locally, `npx web-dev-server --app-index index.html` does this. On nginx it's `try_files $uri /index.html;`, and most static hosts have an equivalent rewrite rule.
- **Asset URLs are root-absolute:** `/app.js`, not `./app.js`. A page served at `/menu/latte` would resolve `./app.js` to `/menu/app.js`.

GitHub Pages has no rewrite rule. There, keep page state in the query string or the hash (`/?drink=latte`), which needs nothing from the server.

## Several stores, one URL

`createRouter()` takes no arguments, and there's no route table. Each store registers itself and decides which part of the URL it owns: the path, some query keys, some hash keys. After an action on any registered store, the router asks every store for its `toURL()` and builds one URL from all of them.

As a result, a query key that no store returns is dropped on the next rebuild. If a parameter has to survive, give it an owner, and give each parameter only one.

To change one store's part of the URL, call that store's action, as in `menu.setSize('large')`. `router.navigate('/menu/chai')` behaves like a link: it goes to exactly that URL, and every other store gets a route without its parameters.

## History entries

A store change pushes a history entry unless every store whose output changed returns `replace: true`. Search text and filters usually want to replace; moving between pages usually wants to push.

Changes the router causes itself never push. If a store rewrites the URL it was just routed to, for example by filling in a default, the router replaces the current entry.

A `before` guard can cancel `navigate` and `replace`. It can't cancel Back and Forward, because the browser has already moved by the time picosm hears about it. When a guard rejects one of those, the router pushes the previous URL back.

To keep query values between visits, pass `storage` and `key` to `register`. See [persisting store state](routing.md#persisting-store-state).
