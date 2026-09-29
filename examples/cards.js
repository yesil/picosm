import { LitElement, css, html, keyed, live, repeat } from 'lit';
import { makeLitObserver, notify, reaction, subscribe } from '../src/index.js';
import { FREE_PASTRY_AT } from './stores.js';
import { NotificationCounter, card, metric, money, sharedStyles } from './ui.js';

function define(name, element) {
  customElements.define(name, makeLitObserver(element));
}

const progressStyles = css`
  .progress {
    height: 10px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
  }

  .progress > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
    transition: width 240ms ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .progress > span {
      transition: none;
    }
  }
`;

function progress(order) {
  const percent = Math.round(Math.min(1, order.subtotal / FREE_PASTRY_AT) * 100);
  return html`
    <div
      class="progress"
      role="progressbar"
      aria-label="Progress towards a free pastry"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${percent}
    >
      <span style="width: ${percent}%"></span>
    </div>
  `;
}

class ActionsCard extends LitElement {
  static properties = {
    order: { observe: true },
    menu: { observe: true },
    activity: {},
  };

  static styles = sharedStyles;

  actions = 0;
  #notifications = new NotificationCounter(this, () => this.order);

  #add(...ids) {
    for (const id of ids) {
      const item = this.menu.find(id);
      this.order.add(item);
      this.actions++;
      this.activity.record('action', `order.add(${item.name})`);
    }
  }

  #clear() {
    this.order.clear();
    this.actions++;
    this.activity.record('action', 'order.clear()');
  }

  render() {
    const ready = this.menu.items.length > 0;
    return card({
      number: 1,
      title: 'Actions & batching',
      apis: ['makeObservable', 'observableActions', 'observe'],
      description: html`Only the methods listed in <code>observableActions</code> notify
        observers. Actions called in the same tick share a single notification, delivered in a
        microtask.`,
      demo: html`
        <div class="row">
          <button class="btn primary" ?disabled=${!ready} @click=${() => this.#add('espresso')}>
            + Espresso
          </button>
          <button
            class="btn"
            ?disabled=${!ready}
            @click=${() => this.#add('latte', 'croissant', 'cookie')}
          >
            + Latte, croissant and cookie
          </button>
          <button
            class="btn quiet"
            ?disabled=${this.order.lines.length === 0}
            @click=${() => this.#clear()}
          >
            Clear order
          </button>
        </div>
        <p class="hint">
          The second button calls <code>order.add()</code> three times in one click. The order
          holds ${this.order.count} items.
        </p>
      `,
      metrics: [
        metric('actions called', this.actions),
        metric('notifications', this.#notifications.count),
      ],
      snippet: `class Order {
  static observableActions = ['add', 'remove', 'clear'];

  add(item) { /* … */ }
}
makeObservable(Order);

observe(order, () => notifications++);

order.add(latte);
order.add(croissant);
order.add(cookie); // one notification for all three`,
    });
  }
}

define('actions-card', ActionsCard);

class ComputedCard extends LitElement {
  static properties = {
    order: { observe: true },
  };

  static styles = [
    sharedStyles,
    progressStyles,
    css`
      .summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .figure {
        display: grid;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--surface);
      }

      .figure-label {
        font-size: 12.5px;
        color: var(--text-muted);
      }

      .figure-value {
        font: 600 18px/1.3 var(--mono);
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  reads = 0;

  #read(name) {
    this.reads++;
    return this.order[name];
  }

  async #rerender() {
    for (let i = 0; i < 10; i++) {
      this.requestUpdate();
      await this.updateComplete;
    }
  }

  render() {
    const count = this.#read('count');
    const subtotal = this.#read('subtotal');
    const remaining = FREE_PASTRY_AT - this.#read('subtotal');
    const { evaluations } = this.order;
    return card({
      number: 2,
      title: 'Computed getters',
      apis: ['computedProperties'],
      description: html`Getters listed in <code>computedProperties</code> are cached. However
        often they are read, their body runs once after each action.`,
      demo: html`
        <div class="summary">
          <div class="figure">
            <span class="figure-label">Items</span>
            <span class="figure-value">${count}</span>
          </div>
          <div class="figure">
            <span class="figure-label">Subtotal</span>
            <span class="figure-value">${money(subtotal)}</span>
          </div>
          <div class="figure">
            <span class="figure-label">Free pastry</span>
            <span class="figure-value">${remaining > 0 ? `in ${money(remaining)}` : 'unlocked'}</span>
          </div>
        </div>
        ${progress(this.order)}
        <div class="row">
          <button class="btn" @click=${() => this.#rerender()}>Re-render 10 times</button>
          <span class="hint">Each render reads the getters 3 times; evaluations stay put.</span>
        </div>
      `,
      metrics: [
        metric('getter reads by this card', this.reads),
        metric('getter evaluations, whole page', evaluations.count + evaluations.subtotal),
      ],
      snippet: `class Order {
  static computedProperties = ['count', 'subtotal'];

  get subtotal() {
    return this.lines.reduce((sum, line) => sum + line.amount, 0);
  }
}`,
    });
  }
}

define('computed-card', ComputedCard);

class AsyncCard extends LitElement {
  static properties = {
    menu: { observe: true },
    activity: {},
    pending: { state: true },
  };

  static styles = [
    sharedStyles,
    css`
      .status {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--surface);
        font-weight: 500;
      }

      .status.error {
        color: var(--danger);
      }

      .menu {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .menu li {
        padding: 3px 10px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface);
        font-size: 13px;
      }
    `,
  ];

  requests = 0;
  settledAfter = null;
  #notifications = new NotificationCounter(this, () => this.menu);

  async #load(url) {
    this.pending = true;
    this.requests++;
    this.activity.record('action', `menu.load('${url}')`);
    const started = performance.now();
    try {
      await this.menu.load(url);
    } catch (error) {
      // The store keeps the message in menu.error, which the card renders
      this.activity.record('error', `menu.load() rejected: ${error.message}`);
    } finally {
      this.settledAfter = Math.round(performance.now() - started);
      this.pending = false;
    }
  }

  #status() {
    if (this.pending) return html`<p class="status">⏳ Loading…</p>`;
    if (this.menu.error) {
      return html`<p class="status error">✗ ${this.menu.error}. Observers were notified anyway.</p>`;
    }
    return html`<p class="status">✓ ${this.menu.items.length} items on the menu</p>`;
  }

  render() {
    return card({
      number: 3,
      title: 'Async actions',
      apis: ['async', 'Promise'],
      description: html`An action that returns a Promise notifies once it settles, including
        when it rejects, so the UI can show errors stored by the action.`,
      demo: html`
        ${this.#status()}
        <div class="row">
          <button class="btn primary" ?disabled=${this.pending} @click=${() => this.#load('./menu.json')}>
            Reload menu.json
          </button>
          <button class="btn" ?disabled=${this.pending} @click=${() => this.#load('./missing.json')}>
            Load missing.json
          </button>
        </div>
        <ul class="menu" aria-label="Menu">
          ${repeat(
            this.menu.items,
            (item) => item.id,
            (item) => html`<li>${item.emoji} ${item.name} · ${money(item.price)}</li>`,
          )}
        </ul>
      `,
      metrics: [
        metric('requests', this.requests),
        metric('notifications', this.#notifications.count),
        metric('settled after', this.settledAfter == null ? '–' : `${this.settledAfter} ms`),
      ],
      snippet: `class Menu {
  static observableActions = ['load'];

  async load(url) {
    this.error = null;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(\`\${response.status} for \${url}\`);
      this.items = await response.json();
    } catch (error) {
      this.error = error.message; // observers still get notified
      throw error;
    }
  }
}`,
    });
  }
}

define('async-card', AsyncCard);

class FoamMeter extends LitElement {
  static properties = {
    foam: { observe: true },
    label: {},
  };

  static styles = [
    sharedStyles,
    css`
      .meter {
        display: grid;
        gap: 6px;
      }

      .meter-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 13.5px;
      }

      .renders {
        color: var(--text-muted);
        font: 12.5px var(--mono);
      }

      .bar {
        height: 14px;
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface);
      }

      .bar > span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, var(--accent-soft), var(--accent));
      }
    `,
  ];

  renders = 0;

  render() {
    this.renders++;
    return html`
      <div class="meter">
        <div class="meter-head">
          <strong>${this.label}</strong>
          <span class="renders">${this.foam.level}% · ${this.renders} renders</span>
        </div>
        <div class="bar"><span style="width: ${this.foam.level}%"></span></div>
      </div>
    `;
  }
}

class ThrottledFoamMeter extends FoamMeter {
  static properties = {
    foam: { observe: true, throttle: 250 },
  };
}

define('foam-meter', FoamMeter);
define('throttled-foam-meter', ThrottledFoamMeter);

class ThrottleCard extends LitElement {
  static properties = {
    foam: {},
  };

  static styles = [
    sharedStyles,
    css`
      .pad {
        display: grid;
        place-items: center;
        height: 96px;
        border: 1px dashed var(--border-strong);
        border-radius: 12px;
        background:
          linear-gradient(90deg, transparent calc(var(--level) * 1%), var(--surface) 0),
          var(--accent-soft);
        color: var(--text-muted);
        font-size: 14px;
        touch-action: none;
        cursor: crosshair;
        user-select: none;
      }

      .pad:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    `,
  ];

  #live = new NotificationCounter(this, () => this.foam);
  #throttled = new NotificationCounter(this, () => this.foam, 250);

  #fromPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    this.foam.setLevel(((event.clientX - rect.left) / rect.width) * 100);
  }

  #fromKeyboard(event) {
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    this.foam.setLevel(this.foam.level + step);
  }

  render() {
    return card({
      number: 4,
      title: 'Throttled observers',
      apis: ['observe(target, fn, ms)', 'throttle'],
      description: html`Give <code>observe()</code> a timeout, or a Lit property a
        <code>throttle</code>, to run at most once per window. The last change always gets
        through.`,
      demo: html`
        <div
          class="pad"
          style="--level: ${this.foam.level}"
          role="slider"
          tabindex="0"
          aria-label="Milk foam"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${this.foam.level}
          @pointermove=${this.#fromPointer}
          @pointerdown=${this.#fromPointer}
          @keydown=${this.#fromKeyboard}
        >
          Move across the pad to steam the milk: every move is an action
        </div>
        <foam-meter .foam=${this.foam} label="observe: true"></foam-meter>
        <throttled-foam-meter .foam=${this.foam} label="observe: true, throttle: 250"></throttled-foam-meter>
      `,
      metrics: [
        metric('observer calls', this.#live.count),
        metric('throttled calls (250 ms)', this.#throttled.count),
      ],
      snippet: `class FoamMeter extends LitElement {
  static properties = {
    foam: { observe: true, throttle: 250 },
  };
}

// or, outside of Lit
observe(foam, updateChart, 250);`,
    });
  }
}

define('throttle-card', ThrottleCard);

class ReactionCard extends LitElement {
  static properties = {
    order: { observe: true },
    menu: { observe: true },
    toasts: {},
    activity: {},
  };

  static styles = [
    sharedStyles,
    progressStyles,
    css`
      .banner {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
      }

      .banner.unlocked {
        color: var(--success);
      }
    `,
  ];

  selectorRuns = 0;
  effectRuns = 0;
  #dispose = null;

  connectedCallback() {
    super.connectedCallback();
    this.#dispose = reaction(
      this.order,
      (order) => {
        this.selectorRuns++;
        return [order.subtotal >= FREE_PASTRY_AT];
      },
      (unlocked) => {
        this.effectRuns++;
        const text = unlocked ? '🥐 Free pastry unlocked!' : 'The free pastry is gone';
        this.toasts.show(text, unlocked ? 'success' : 'info');
        this.activity.record('reaction', `effect(${unlocked}): ${text}`);
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#dispose();
  }

  #latteLine() {
    return this.order.lines.find((line) => line.item.id === 'latte');
  }

  #addLatte() {
    this.order.add(this.menu.find('latte'));
    this.activity.record('action', 'order.add(Caffè latte)');
  }

  #removeLatte() {
    const line = this.#latteLine();
    if (line.quantity > 1) {
      line.setQuantity(line.quantity - 1);
      this.activity.record('action', `line.setQuantity(${line.quantity}) · Caffè latte`);
    } else {
      this.order.remove(line);
      this.activity.record('action', 'order.remove(Caffè latte)');
    }
  }

  render() {
    const unlocked = this.order.subtotal >= FREE_PASTRY_AT;
    return card({
      number: 5,
      title: 'Reactions',
      apis: ['reaction'],
      description: html`The selector runs after every notification, the effect only when the
        selected values change. Crossing ${money(FREE_PASTRY_AT)} flips the value below and
        shows a toast.`,
      demo: html`
        <p class="banner ${unlocked ? 'unlocked' : ''}">
          ${unlocked
            ? '🥐 A free pastry comes with this order'
            : `Add ${money(FREE_PASTRY_AT - this.order.subtotal)} more for a free pastry`}
        </p>
        ${progress(this.order)}
        <div class="row">
          <button class="btn primary" ?disabled=${!this.menu.items.length} @click=${() => this.#addLatte()}>
            + Latte
          </button>
          <button class="btn" ?disabled=${!this.#latteLine()} @click=${() => this.#removeLatte()}>
            − Latte
          </button>
        </div>
      `,
      metrics: [metric('selector runs', this.selectorRuns), metric('effect runs', this.effectRuns)],
      snippet: `const dispose = reaction(
  order,
  (order) => [order.subtotal >= 15],
  (unlocked) => toasts.show(unlocked ? 'Free pastry unlocked!' : 'The free pastry is gone'),
);`,
    });
  }
}

define('reaction-card', ReactionCard);

class TrackCard extends LitElement {
  static properties = {
    order: { observe: true },
    activity: {},
  };

  static styles = [
    sharedStyles,
    css`
      .lines {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .line {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 12px;
        padding: 8px 10px;
        border-radius: 10px;
        background: var(--surface);
      }

      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .stepper {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .stepper .btn {
        min-width: 32px;
        min-height: 30px;
        justify-content: center;
        padding: 0;
      }

      .quantity,
      .amount {
        font: 600 14px var(--mono);
        font-variant-numeric: tabular-nums;
      }

      .quantity {
        min-width: 2ch;
        text-align: center;
      }

      .amount {
        min-width: 7ch;
        text-align: right;
      }

      .total {
        display: flex;
        justify-content: space-between;
        font-weight: 600;
      }
    `,
  ];

  lineActions = 0;
  #notifications = new NotificationCounter(this, () => this.order);

  #step(line, delta) {
    if (line.quantity + delta < 1) {
      this.order.remove(line);
      this.activity.record('action', `order.remove(${line.item.name})`);
      return;
    }
    line.setQuantity(line.quantity + delta);
    this.lineActions++;
    this.activity.record('action', `line.setQuantity(${line.quantity}) · ${line.item.name}`);
  }

  render() {
    const { lines } = this.order;
    return card({
      number: 6,
      title: 'Tracking nested stores',
      apis: ['track'],
      description: html`Each order line is its own observable. <code>track(order, line)</code>
        forwards the line's notifications to the order and resets the order's cached getters.`,
      demo: html`
        ${lines.length === 0
          ? html`<p class="empty">The order is empty. Add items with card 01.</p>`
          : html`
              <ul class="lines">
                ${repeat(
                  lines,
                  (line) => line.item.id,
                  (line) => html`
                    <li class="line">
                      <span class="emoji" aria-hidden="true">${line.item.emoji}</span>
                      <span class="name">${line.item.name}</span>
                      <span class="stepper">
                        <button
                          class="btn"
                          aria-label="One ${line.item.name} less"
                          @click=${() => this.#step(line, -1)}
                        >
                          −
                        </button>
                        <span class="quantity">${line.quantity}</span>
                        <button
                          class="btn"
                          aria-label="One more ${line.item.name}"
                          @click=${() => this.#step(line, 1)}
                        >
                          +
                        </button>
                      </span>
                      <span class="amount">${money(line.amount)}</span>
                    </li>
                  `,
                )}
              </ul>
              <div class="total"><span>Subtotal</span><span>${money(this.order.subtotal)}</span></div>
            `}
      `,
      metrics: [
        metric('line.setQuantity() calls', this.lineActions),
        metric('order notifications', this.#notifications.count),
      ],
      snippet: `add(item) {
  const line = new OrderLine(item);
  this.lines = [...this.lines, line];
  // quantity changes made on the line reach the order
  this.#untrack.set(line, track(this, line));
}

line.setQuantity(3); // the order is notified, subtotal recomputed`,
    });
  }
}

define('track-card', TrackCard);

class MessagesCard extends LitElement {
  static properties = {
    order: { observe: true },
    barista: { observe: true },
    activity: {},
  };

  static styles = [
    sharedStyles,
    css`
      .split {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }

      .station {
        display: grid;
        align-content: start;
        gap: 10px;
      }

      .barista {
        display: grid;
        gap: 8px;
        padding: 12px;
        border-radius: 10px;
        background: var(--surface);
      }

      .barista-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .bell {
        display: inline-block;
        font-size: 22px;
      }

      .bell.ring {
        animation: ring 600ms ease;
        transform-origin: 50% 0;
      }

      @keyframes ring {
        20% {
          transform: rotate(18deg);
        }
        40% {
          transform: rotate(-14deg);
        }
        60% {
          transform: rotate(9deg);
        }
        80% {
          transform: rotate(-5deg);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .bell.ring {
          animation: none;
        }
      }

      .tickets {
        display: grid;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 13.5px;
      }

      .tickets strong {
        font-family: var(--mono);
      }
    `,
  ];

  sent = 0;
  received = 0;
  #ticketNumber = 0;
  #unsubscribe = null;

  connectedCallback() {
    super.connectedCallback();
    this.#unsubscribe = subscribe(this.order, (message) => {
      this.received++;
      this.barista.receive(message);
      this.activity.record(
        'message',
        message.type === 'ticket' ? `ticket #${message.number} received` : 'bell received',
      );
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#unsubscribe();
  }

  #send(message) {
    this.sent++;
    // Delivered synchronously: the subscriber has run when notify() returns
    notify(this.order, message);
    this.requestUpdate();
  }

  #sendTicket() {
    this.#send({
      type: 'ticket',
      number: ++this.#ticketNumber,
      lines: this.order.lines.map((line) => `${line.quantity}× ${line.item.name}`),
    });
  }

  render() {
    const { tickets, rings } = this.barista;
    return card({
      number: 7,
      title: 'Messages',
      apis: ['subscribe', 'notify'],
      description: html`A message channel on any observable. Unlike <code>observe()</code>,
        messages carry a payload and reach subscribers synchronously, without a state change.`,
      demo: html`
        <div class="split">
          <div class="station">
            <h3>Counter</h3>
            <button
              class="btn primary"
              ?disabled=${this.order.lines.length === 0}
              @click=${() => this.#sendTicket()}
            >
              Send the order to the barista
            </button>
            <button class="btn" @click=${() => this.#send({ type: 'bell' })}>Ring the bell</button>
          </div>
          <div class="barista" aria-live="polite">
            <div class="barista-head">
              <h3>Barista</h3>
              ${keyed(rings, html`<span class="bell ${rings ? 'ring' : ''}" aria-hidden="true">🔔</span>`)}
            </div>
            ${tickets.length === 0
              ? html`<p class="hint">No tickets yet.</p>`
              : html`
                  <ul class="tickets">
                    ${tickets.map(
                      (ticket) =>
                        html`<li><strong>#${ticket.number}</strong> ${ticket.lines.join(', ')}</li>`,
                    )}
                  </ul>
                `}
          </div>
        </div>
      `,
      metrics: [metric('messages sent', this.sent), metric('messages received', this.received)],
      snippet: `subscribe(order, (message) => barista.receive(message));

notify(order, { type: 'ticket', number: 3, lines });
// the barista has the ticket before notify() returns`,
    });
  }
}

define('messages-card', MessagesCard);

class OrderBadge extends LitElement {
  static properties = {
    order: { observe: true },
  };

  static styles = [
    sharedStyles,
    css`
      .badge {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 14px;
        padding: 12px 14px;
        border: 1px solid var(--accent);
        border-radius: 12px;
        background: var(--surface);
      }

      .table {
        font-weight: 700;
      }

      .renders {
        margin-left: auto;
        color: var(--text-muted);
        font: 12.5px var(--mono);
      }
    `,
  ];

  renders = 0;

  render() {
    this.renders++;
    return html`
      <div class="badge">
        <span class="table">${this.order.name}</span>
        <span>${this.order.count} items · ${money(this.order.subtotal)}</span>
        <span class="renders">rendered ${this.renders}×</span>
      </div>
    `;
  }
}

define('order-badge', OrderBadge);

class LitCard extends LitElement {
  static properties = {
    tables: {},
    menu: { observe: true },
    activity: {},
    selected: { state: true },
  };

  static styles = sharedStyles;

  constructor() {
    super();
    // Not a class field: a field would shadow the reactive accessor Lit defines for `selected`
    this.selected = 0;
  }

  #serve(table) {
    table.add(this.menu.find('latte'));
    this.activity.record('action', `${table.name}: order.add(Caffè latte)`);
  }

  render() {
    return card({
      number: 8,
      title: 'Lit integration',
      apis: ['makeLitObserver', 'observe: true'],
      description: html`Declare a property with <code>observe: true</code>: the element
        re-renders after actions on the store it holds, and rebinds when another store is
        assigned. Every card on this page is built this way.`,
      demo: html`
        <div class="row" role="group" aria-label="Store shown by the badge">
          <span class="hint">The badge shows</span>
          ${this.tables.map(
            (table, index) => html`
              <button
                class="chip"
                aria-pressed=${this.selected === index}
                @click=${() => (this.selected = index)}
              >
                ${table.name}
              </button>
            `,
          )}
        </div>
        <order-badge .order=${this.tables[this.selected]}></order-badge>
        <div class="row">
          ${this.tables.map(
            (table) => html`
              <button class="btn" ?disabled=${!this.menu.items.length} @click=${() => this.#serve(table)}>
                + Latte for ${table.name}
              </button>
            `,
          )}
        </div>
        <p class="hint">
          Serving the other table leaves the badge's render count alone: it only observes the
          store it holds.
        </p>
      `,
      snippet: `class OrderBadge extends LitElement {
  static properties = {
    order: { observe: true },
  };

  render() {
    return html\`\${this.order.name}: \${this.order.count} items\`;
  }
}
customElements.define('order-badge', makeLitObserver(OrderBadge));`,
    });
  }
}

define('lit-card', LitCard);

class RouterCard extends LitElement {
  static properties = {
    router: {},
    menu: { observe: true },
    filters: { observe: true },
    detail: { observe: true },
    preferences: { observe: true },
    note: { observe: true },
    urlHistory: { observe: true },
    order: {},
    activity: {},
  };

  static styles = [
    sharedStyles,
    css`
      .browser {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 14px;
      }

      @media (max-width: 640px) {
        .browser {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      .toolbar {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 10px;
      }

      .items {
        display: grid;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 6px 10px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: var(--surface);
        color: var(--text);
        font-size: 14px;
        text-align: left;
        cursor: pointer;
      }

      .item:hover {
        border-color: var(--border-strong);
      }

      .item[aria-current='true'] {
        border-color: var(--accent);
      }

      .item .price {
        margin-left: auto;
        font: 13px var(--mono);
        color: var(--text-muted);
      }

      .detail {
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 14px;
        border-radius: 12px;
        background: var(--surface);
      }

      .detail-emoji {
        font-size: 40px;
        line-height: 1;
      }

      .detail h3 {
        font-size: 18px;
        color: var(--text);
        text-transform: none;
        letter-spacing: normal;
      }

      .note {
        display: grid;
        gap: 8px;
      }

      textarea {
        min-height: 64px;
        padding: 8px 10px;
        border: 1px solid var(--border-strong);
        border-radius: 10px;
        background: var(--surface);
        color: var(--text);
        font: inherit;
        resize: vertical;
      }

      textarea:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }

      .dirty {
        color: var(--kind-reaction);
      }

      .links {
        display: grid;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 14px;
      }

      .links a {
        color: var(--accent-strong);
        font-family: var(--mono);
        font-size: 13px;
      }

      .address {
        display: grid;
        gap: 8px;
        padding: 12px;
        border-radius: 12px;
        background: var(--code-bg);
        color: var(--code-text);
      }

      .address h3 {
        color: var(--code-comment);
      }

      .url {
        overflow-wrap: anywhere;
        font: 600 13.5px var(--mono);
      }

      .writes {
        display: grid;
        gap: 4px;
        margin: 0;
        padding: 0;
        list-style: none;
        font: 12.5px var(--mono);
      }

      .writes li {
        display: flex;
        gap: 8px;
        overflow-wrap: anywhere;
      }

      .kind {
        flex: none;
        min-width: 7ch;
        font-weight: 600;
      }

      .kind-push {
        color: var(--code-keyword);
      }

      .kind-replace {
        color: var(--code-number);
      }

      .kind-pop {
        color: var(--code-string);
      }
    `,
  ];

  #record(text) {
    this.activity.record('action', text);
  }

  #items() {
    const { category } = this.filters;
    const items = this.menu.items.filter((item) => !category || item.category === category);
    return this.preferences.sort === 'price'
      ? items.sort((a, b) => a.price - b.price)
      : items.sort((a, b) => a.name.localeCompare(b.name));
  }

  #setCategory(category) {
    this.filters.setCategory(category);
    this.#record(`filters.setCategory(${category ? `'${category}'` : 'null'})`);
  }

  #setSort(sort) {
    this.preferences.setSort(sort);
    this.#record(`preferences.setSort('${sort}')`);
  }

  #open(item) {
    this.detail.open(item.id);
    this.#record(`detail.open('${item.id}')`);
  }

  #detailPane() {
    if (!this.detail.item) {
      return html`<p class="hint">Pick an item: <code>detail.open()</code> pushes a history entry.
        Back closes it again.</p>`;
    }
    if (!this.menu.items.length) return html`<p class="hint">Loading the menu…</p>`;
    const item = this.menu.find(this.detail.item);
    const close = html`<button class="btn" @click=${() => {
      this.detail.close();
      this.#record('detail.close()');
    }}>Close</button>`;
    if (!item) {
      return html`<p class="error">No “${this.detail.item}” on the menu.</p>
        <div class="row">${close}</div>`;
    }
    return html`
      <span class="detail-emoji" aria-hidden="true">${item.emoji}</span>
      <h3>${item.name}</h3>
      <p class="hint">${item.category} · ${money(item.price)}</p>
      <div class="row">
        <button class="btn primary" @click=${() => {
          this.order.add(item);
          this.#record(`order.add(${item.name})`);
        }}>Add to order</button>
        ${close}
      </div>
    `;
  }

  render() {
    const { category } = this.filters;
    const { sort } = this.preferences;
    const { counts } = this.urlHistory;
    return card({
      number: 9,
      title: 'Router',
      apis: ['createRouter', 'register', 'toURL', 'onRoute', 'before', 'storage'],
      description: html`Stores own the state and the URL follows. Each store registers the part
        of the URL it reads in <code>onRoute</code> and writes in <code>toURL</code>. Links,
        Back and Forward flow the other way.`,
      demo: html`
        <div class="browser">
          <div class="toolbar">
            <div class="row" role="group" aria-label="Category (replaceState)">
              ${[null, ...this.menu.categories].map(
                (value) => html`
                  <button
                    class="chip"
                    aria-pressed=${category === value}
                    @click=${() => this.#setCategory(value)}
                  >
                    ${value ?? 'all'}
                  </button>
                `,
              )}
            </div>
            <div class="row" role="group" aria-label="Sort (saved in localStorage)">
              ${['name', 'price'].map(
                (value) => html`
                  <button
                    class="chip"
                    aria-pressed=${sort === value}
                    @click=${() => this.#setSort(value)}
                  >
                    by ${value}
                  </button>
                `,
              )}
            </div>
          </div>
          <ul class="items" aria-label="Menu items">
            ${repeat(
              this.#items(),
              (item) => item.id,
              (item) => html`
                <li>
                  <button
                    class="item"
                    aria-current=${this.detail.item === item.id}
                    @click=${() => this.#open(item)}
                  >
                    <span aria-hidden="true">${item.emoji}</span>
                    ${item.name}
                    <span class="price">${money(item.price)}</span>
                  </button>
                </li>
              `,
            )}
          </ul>
          <div class="detail">${this.#detailPane()}</div>
        </div>
        <p class="hint">
          Categories replace the current entry, items push a new one, and the sort order is
          saved in localStorage: reload without <code>?sort</code> and it comes back.
        </p>

        <div class="note">
          <label class="eyebrow" for="note">Note for the barista</label>
          <textarea
            id="note"
            .value=${live(this.note.text)}
            placeholder="Oat milk, please"
            @input=${(event) => this.note.edit(event.target.value)}
          ></textarea>
          <div class="row">
            <button
              class="btn"
              ?disabled=${!this.note.dirty}
              @click=${() => {
                this.note.save();
                this.#record('note.save()');
              }}
            >
              Save note
            </button>
            <span class="hint ${this.note.dirty ? 'dirty' : ''}">
              ${this.note.dirty
                ? 'Unsaved: a before() guard asks before links, Back and Forward leave.'
                : 'Saved. Type something, then press Back.'}
            </span>
          </div>
        </div>

        <div class="note">
          <h3>Links</h3>
          <p class="hint">
            Clicks anywhere on the page go through <code>router.go</code>, delegated once on the
            page shell.
          </p>
          <ul class="links">
            <li>
              <a href="?category=bakery&item=croissant">?category=bakery&amp;item=croissant</a>
              · relative href, one history entry
            </li>
            <li><a href="?">?</a> · the same page with an empty query</li>
            <li><a href="#router">#router</a> · same-page anchor, left to the browser</li>
            <li>
              <a href="https://github.com/yesil/picosm" target="_blank" rel="noopener">github.com ↗</a>
              · other origin and new tab, left to the browser
            </li>
          </ul>
        </div>

        <div class="row">
          <button class="btn" @click=${() => this.router.back()}>← Back</button>
          <button class="btn" @click=${() => this.router.forward()}>Forward →</button>
          <button class="btn" @click=${() => this.router.replace('?category=tea')}>
            router.replace('?category=tea')
          </button>
        </div>

        <div class="address" aria-live="polite">
          <h3>Address bar</h3>
          <span class="url">${this.urlHistory.url}</span>
          <ol class="writes" aria-label="Latest history writes">
            ${repeat(
              this.urlHistory.writes,
              (write) => write.id,
              (write) => html`<li><span class="kind kind-${write.kind}">${write.kind}</span>${write.url}</li>`,
            )}
          </ol>
        </div>
      `,
      metrics: [
        metric('pushState', counts.push),
        metric('replaceState', counts.replace),
        metric('popstate', counts.pop),
      ],
      snippet: `const router = createRouter();

router.register(filters, {
  onRoute: ({ query }) => filters.setCategory(query.category),
  toURL: () => ({ query: { category: filters.category }, replace: true }),
});

router.register(detail, {
  onRoute: ({ query }) => (query.item ? detail.open(query.item) : detail.close()),
  toURL: () => ({ query: { item: detail.item } }),
});

router.register(preferences, {
  onRoute: ({ query }) => preferences.setSort(query.sort),
  toURL: () => ({ query: { sort: preferences.sort === 'name' ? null : preferences.sort }, replace: true }),
  storage: localStorage,
  key: 'picosm-demo:preferences',
});

router.register(note, {
  async before() {
    if (!note.dirty) return true;
    const leave = await confirmation.ask('Your note for the barista is not saved. Leave anyway?');
    if (leave) note.discard();
    return leave;
  },
});`,
    });
  }
}

define('router-card', RouterCard);
