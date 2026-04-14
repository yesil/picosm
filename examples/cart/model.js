import { makeObservable } from '../../dist/picosm.js';

class Product {
  static observableActions = ['setQuantity'];
  static computedProperties = ['total'];

  title = '';
  price = 0;
  quantity = 0;
  category = '';

  constructor(title, price, category) {
    this.title = title;
    this.price = price;
    this.category = category;
  }

  get total() {
    return this.price * this.quantity;
  }

  setQuantity(quantity) {
    this.quantity = quantity;
  }
}
makeObservable(Product);

class CartStore {
  static observableActions = ['addToCart', 'updateQuantity', 'toggleCart'];
  static computedProperties = ['total', 'count'];

  products = [];
  lastProduct = null;
  open = false;

  addToCart(product) {
    this.lastProduct = product;
    product.setQuantity(Math.max(product.quantity + 1, 1));
  }

  updateQuantity(product, value) {
    this.lastProduct = product;
    product.setQuantity(Math.max(value || 0, 0));
  }

  toggleCart() {
    this.open = !this.open;
  }

  get total() {
    return this.products
      .filter((p) => p.quantity > 0)
      .reduce((total, product) => total + product.total, 0);
  }

  get count() {
    return this.products.filter((p) => p.quantity > 0).length;
  }
}
makeObservable(CartStore);

class FilterStore {
  static observableActions = ['setFilters', 'setFilter', 'clearFilters'];

  category = '';
  sort = 'name';

  setFilters({ category, sort }) {
    this.category = category || '';
    this.sort = sort || 'name';
  }

  setFilter(key, value) {
    this[key] = value;
  }

  clearFilters() {
    this.category = '';
    this.sort = 'name';
  }
}
makeObservable(FilterStore);

class ViewStore {
  static observableActions = ['setView', 'setProducts'];

  view = 'catalog';
  productId = null;
  products = [];

  setProducts(products) {
    this.products = products;
  }

  setView(view, productId) {
    this.view = view;
    this.productId = productId || null;
  }
}
makeObservable(ViewStore);

export { Product, CartStore, FilterStore, ViewStore };
