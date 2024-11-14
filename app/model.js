import { makeObservable } from '../dist/picosm.js';

class Product {
  title = '';
  price = 0;
  quantity = 0;

  constructor(title, price) {
    this.title = title;
    this.price = price;
  }

  get total() {
    return this.price * this.quantity;
  }

  setQuantity(quantity) {
    this.quantity = quantity;
  }
}

class Store {
  setProducts(products) {
    this.products = products;
  }

  addToCart(product) {
    this.lastProduct = product;
    product.setQuantity(Math.max(product.quantity + 1, 1));
  }

  updateQuantity(product, value) {
    this.lastProduct = product;
    product.setQuantity(Math.max(value || 0, 0));
  }

  get total() {
    return this.products
      .filter((p) => p.quantity > 0)
      .reduce((total, product) => {
        return total + product.total;
      }, 0);
  }
}

const ProductObservable = makeObservable(Product, ['setQuantity'], ['total']);
const StoreObservable = makeObservable(
  Store,
  ['setProducts', 'addToCart', 'updateQuantity'],
  ['total'],
);

export { Product, ProductObservable, Store, StoreObservable };
