# As the app grows

Split the page into modules the browser loads on its own. Nothing changes in how the store and the views talk to each other.

```text
index.html
stores/cart.js
elements/cart-count.js
elements/cart-total.js
```

`stores/cart.js` exports the store instance:

```javascript
import { makeObservable } from 'picosm';

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
export const cart = new Cart();
```

Each element imports it:

```javascript
import { observe } from 'picosm';
import { cart } from '../stores/cart.js';

class CartCount extends HTMLElement {
  connectedCallback() {
    this.dispose = observe(cart, () => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.dispose();
  }

  render() {
    this.textContent = cart.items.length;
  }
}

customElements.define('cart-count', CartCount);
```

`index.html` keeps the import map and loads each element with a `<script type="module">` tag. The browser loads a module once per URL, so every file that imports `stores/cart.js` gets the same `cart`.

## More stores

Give each concern its own store, and connect stores with `track`. Here `checkout` derives shipping from the cart: `track(checkout, cart)` clears its cached getters and notifies its subscribers whenever `cart` changes.

```javascript
import { makeObservable, track } from 'picosm';
import { cart } from './cart.js';

class Checkout {
  static computedProperties = ['shipping'];

  get shipping() {
    return cart.total >= 30 ? 0 : 4.5;
  }
}

makeObservable(Checkout);
export const checkout = new Checkout();
track(checkout, cart);
```

## URLs and Lit

The [router](routing.md) puts store state in the URL, with plain links and deep links that survive a refresh. Lit components can use the same stores through [`makeLitObserver`](lit.md).
