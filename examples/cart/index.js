import './App.js';
import { Product } from './model.js';

const products = [
  new Product('Product A', 10),
  new Product('Product B', 15),
  new Product('Product C', 22),
];

const app = document.querySelector('pico-demo');
app.store.setProducts(products);
