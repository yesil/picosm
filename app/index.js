import './App.js';
import { ProductObservable } from './model.js';

const products = [
  new ProductObservable('Product A', 10),
  new ProductObservable('Product B', 15),
  new ProductObservable('Product C', 22),
];

const app = document.querySelector('pico-demo');
app.store.setProducts(products);
