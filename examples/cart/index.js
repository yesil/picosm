import './App.js';
import { Product, CartStore, FilterStore, ViewStore } from './model.js';
import { createRouter } from '../../dist/picosm.js';

const products = [
  new Product('Sneakers', 89, 'shoes'),
  new Product('Boots', 120, 'shoes'),
  new Product('T-Shirt', 25, 'shirts'),
  new Product('Hoodie', 65, 'shirts'),
  new Product('Watch', 199, 'accessories'),
  new Product('Sunglasses', 45, 'accessories'),
];

const cartStore = new CartStore();
cartStore.products = products;

const filterStore = new FilterStore();
const viewStore = new ViewStore();
viewStore.setProducts(products);

const router = createRouter();

// viewStore owns the product query param
router.register(viewStore, {
  onRoute({ query }) {
    if (query.product) {
      viewStore.setView('detail', query.product);
    } else {
      viewStore.setView('catalog', null);
    }
  },
  toURL() {
    if (viewStore.view === 'detail' && viewStore.productId) {
      return { query: { product: viewStore.productId } };
    }
    return {};
  },
});

// filterStore owns category and sort query params (replace: true)
router.register(filterStore, {
  onRoute({ query }) {
    filterStore.setFilters({
      category: query.category,
      sort: query.sort,
    });
  },
  toURL() {
    const query = {};
    if (filterStore.category) query.category = filterStore.category;
    if (filterStore.sort && filterStore.sort !== 'name')
      query.sort = filterStore.sort;
    return { query, replace: true };
  },
});

// cartStore owns the hash (cart drawer open/closed)
router.register(cartStore, {
  onRoute({ hash }) {
    const shouldBeOpen = hash.cart === 'open';
    if (shouldBeOpen !== cartStore.open) {
      cartStore.toggleCart();
    }
  },
  toURL() {
    return { hash: cartStore.open ? { cart: 'open' } : {}, replace: true };
  },
});

const app = document.querySelector('pico-demo');
app.cartStore = cartStore;
app.filterStore = filterStore;
app.viewStore = viewStore;
app.router = router;
