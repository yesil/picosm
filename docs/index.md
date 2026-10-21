# picosm

Write web apps in plain HTML and JavaScript modules, with no bundler and no build step, and still keep your state in one place. picosm makes a class observable: you call its methods, and every part of the page that depends on it updates.

```bash
npm install picosm
```

This is a complete app. Save it as `index.html`, serve the folder, and open it, or [run it here](example/).

```html file=index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Cart</title>
    <script type="importmap">
      {
        "imports": {
          "picosm": "https://cdn.jsdelivr.net/npm/picosm@3.0.0/dist/picosm.js"
        }
      }
    </script>
    <script type="module">
      import { makeObservable, observe } from 'picosm';

      class Cart {
        static observableActions = ['add', 'clear'];
        static computedProperties = ['total'];
        items = [];

        add(name, price) {
          this.items.push({ name, price });
        }

        clear() {
          this.items = [];
        }

        get total() {
          return this.items.reduce((sum, item) => sum + item.price, 0);
        }
      }
      makeObservable(Cart);
      const cart = new Cart();

      class CartView extends HTMLElement {
        connectedCallback() {
          this.dispose = observe(cart, () => this.render());
          this.render();
        }
        disconnectedCallback() {
          this.dispose();
        }
      }
      class CartCount extends CartView {
        render() {
          this.textContent = cart.items.length;
        }
      }
      class CartTotal extends CartView {
        render() {
          this.textContent = cart.total.toFixed(2);
        }
      }
      customElements.define('cart-count', CartCount);
      customElements.define('cart-total', CartTotal);

      document.querySelector('#menu').addEventListener('click', (event) => {
        const { name, price } = event.target.dataset;
        if (name) cart.add(name, Number(price));
      });
      document.querySelector('#clear').addEventListener('click', () => {
        cart.clear();
      });
    </script>
  </head>
  <body>
    <header>Cart: <cart-count></cart-count> items</header>
    <nav id="menu">
      <button data-name="Espresso" data-price="2.80">Espresso</button>
      <button data-name="Latte" data-price="4.20">Latte</button>
    </nav>
    <p>Total: <cart-total></cart-total></p>
    <button id="clear">Clear</button>
  </body>
</html>
```

- **No build.** The import map points `picosm` at the published file, and the browser loads it directly.
- **State lives in one class.** The buttons call `Cart` methods and never touch the DOM.
- **Views connect themselves.** `<cart-count>` and `<cart-total>` subscribe when they're added to the page and unsubscribe when they're removed. Put another `<cart-count>` anywhere in the HTML and it stays in sync too. `total` is cached until the next action.
