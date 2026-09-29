import { makeObservable, track } from '../src/index.js';

export const FREE_PASTRY_AT = 15;

export class Menu {
  static observableActions = ['load'];
  static computedProperties = ['categories'];

  items = [];
  error = null;

  // Returns a Promise: observers are notified once it settles, also when it rejects
  async load(url = './menu.json') {
    this.error = null;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
      }
      this.items = await response.json();
    } catch (error) {
      this.error = error.message;
      throw error;
    }
  }

  find(id) {
    return this.items.find((item) => item.id === id);
  }

  get categories() {
    return [...new Set(this.items.map((item) => item.category))];
  }
}

makeObservable(Menu);

export class OrderLine {
  static observableActions = ['setQuantity'];
  static computedProperties = ['amount'];

  quantity = 1;

  constructor(item) {
    this.item = item;
  }

  setQuantity(quantity) {
    this.quantity = Math.max(1, quantity);
  }

  get amount() {
    return this.item.price * this.quantity;
  }
}

makeObservable(OrderLine);

export class Order {
  static observableActions = ['add', 'remove', 'clear'];
  static computedProperties = ['count', 'subtotal'];

  lines = [];
  // How often each getter body ran; reads between two actions are served from the cache
  evaluations = { count: 0, subtotal: 0 };
  #untrack = new Map();

  constructor(name) {
    this.name = name;
  }

  add(item) {
    const line = this.lines.find((l) => l.item.id === item.id);
    if (line) {
      line.setQuantity(line.quantity + 1);
      return;
    }
    const added = new OrderLine(item);
    this.lines = [...this.lines, added];
    // Quantity changes made on the line itself now reach the order's observers
    this.#untrack.set(added, track(this, added));
  }

  remove(line) {
    this.#untrack.get(line)();
    this.#untrack.delete(line);
    this.lines = this.lines.filter((l) => l !== line);
  }

  clear() {
    for (const line of this.lines) this.remove(line);
  }

  get count() {
    this.evaluations.count++;
    return this.lines.reduce((sum, line) => sum + line.quantity, 0);
  }

  get subtotal() {
    this.evaluations.subtotal++;
    return this.lines.reduce((sum, line) => sum + line.amount, 0);
  }
}

makeObservable(Order);

export class Foam {
  static observableActions = ['setLevel'];

  level = 0;

  setLevel(level) {
    this.level = Math.round(Math.min(100, Math.max(0, level)));
  }
}

makeObservable(Foam);

export class Barista {
  static observableActions = ['receive'];

  tickets = [];
  rings = 0;

  receive(message) {
    if (message.type === 'bell') this.rings++;
    if (message.type === 'ticket') this.tickets = [message, ...this.tickets].slice(0, 3);
  }
}

makeObservable(Barista);

export class Toasts {
  static observableActions = ['show', 'dismiss'];

  items = [];
  #nextId = 1;

  show(text, tone = 'info') {
    const toast = { id: this.#nextId++, text, tone };
    this.items = [...this.items, toast];
    setTimeout(() => this.dismiss(toast.id), 3200);
  }

  dismiss(id) {
    this.items = this.items.filter((toast) => toast.id !== id);
  }
}

makeObservable(Toasts);

export class Activity {
  static observableActions = ['record', 'clear'];

  entries = [];
  #nextId = 1;
  #start = performance.now();

  record(kind, text) {
    const entry = { id: this.#nextId++, kind, text, at: performance.now() - this.#start };
    this.entries = [entry, ...this.entries].slice(0, 80);
  }

  clear() {
    this.entries = [];
  }
}

makeObservable(Activity);

export class Filters {
  static observableActions = ['setCategory'];

  category = null;

  setCategory(category) {
    this.category = category || null;
  }
}

makeObservable(Filters);

export class Detail {
  static observableActions = ['open', 'close'];

  item = null;

  open(id) {
    this.item = id;
  }

  close() {
    this.item = null;
  }
}

makeObservable(Detail);

export class Preferences {
  static observableActions = ['setSort'];

  sort = 'name';

  setSort(sort) {
    this.sort = sort === 'price' ? 'price' : 'name';
  }
}

makeObservable(Preferences);

export class Note {
  static observableActions = ['edit', 'save', 'discard'];
  static computedProperties = ['dirty'];

  text = '';
  saved = '';

  edit(text) {
    this.text = text;
  }

  save() {
    this.saved = this.text;
  }

  discard() {
    this.text = this.saved;
  }

  get dirty() {
    return this.text !== this.saved;
  }
}

makeObservable(Note);

export class Confirmation {
  static observableActions = ['open', 'answer'];

  message = null;
  #resolve = null;

  // Not an action: an action returning a Promise notifies only once that Promise settles
  ask(message) {
    this.open(message);
    return new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  open(message) {
    this.message = message;
  }

  answer(confirmed) {
    this.#resolve?.(confirmed);
    this.#resolve = null;
    this.message = null;
  }
}

makeObservable(Confirmation);

export class UrlHistory {
  static observableActions = ['record'];

  url = currentURL();
  writes = [];
  counts = { push: 0, replace: 0, pop: 0 };
  #nextId = 1;

  record(kind, url) {
    this.url = currentURL();
    this.counts = { ...this.counts, [kind]: this.counts[kind] + 1 };
    this.writes = [{ id: this.#nextId++, kind, url: String(url) }, ...this.writes].slice(0, 5);
  }
}

makeObservable(UrlHistory);

function currentURL() {
  return window.location.pathname + window.location.search + window.location.hash;
}
