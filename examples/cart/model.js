import { makeObservable } from '../../dist/picosm.js';

class Product {

  static observableActions = ['setQuantity'];
  static computedProperties = ['total'];

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
makeObservable(Product);

class Store {
  static observableActions = ['setProducts', 'addToCart', 'updateQuantity'];
  static computedProperties = ['total'];

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

makeObservable(Store);


export { Product, Store };
