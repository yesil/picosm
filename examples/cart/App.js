import { LitElement, html, css } from 'lit';
import { Store } from './model.js';
import { makeLitObserver, reaction } from '../../dist/picosm.js';

/**
 * also see ../index.html
 */
export class App extends LitElement {
  static properties = {
    store: {},
    lastProductTitle: {},
  };

  static styles = [
    css`
      :host {
        display: flex;
        flex-direction: column;
        color: var(--spectrum-global-color-gray-900);
        margin-top: 32px;
        min-width: 300px;
      }

      .cards {
        display: flex;
        justify-content: space-between;
        flex: 1;
        gap: 32px;
      }

      @media screen and (max-width: 600px) {
        .cards {
          flex-direction: column;
          align-items: center;
        }
      }

      [slot='footer'] {
        display: flex;
        gap: 32px;
        align-items: center;
      }

      .cart {
        margin-top: 40px;
      }

      sp-card {
        width: 220px;
        min-height: 350px;
      }

      sp-number-field {
        width: 80px;
      }

      .reaction {
        opacity: 0;
        margin-top: 20px;
      }

      @keyframes fadeOut {
        0% {
          opacity: 1;
        }
        50% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }

      .fadeOut {
        animation-duration: 3s;
        animation-name: fadeOut;
      }
    `,
  ];

  constructor() {
    super();
    this.store = new Store();
    this.reactionDisposer = reaction(
      this.store,
      ({ lastProduct }) => [lastProduct?.title],
      (title) => {
        const reaction = this.shadowRoot.querySelector('.reaction');
        reaction.classList.remove('fadeOut');
        void reaction.offsetWidth; // Trigger reflow to restart the animation
        reaction.classList.add('fadeOut');
        this.lastProductTitle = title;
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.reactionDisposer?.();
  }

  get cards() {
    return this.store.products.map(
      (product, index) => html`
        <sp-card heading="${product.title}" subheading="$${product.price}">
          <img
            slot="preview"
            src="https://picsum.photos/id/${(index + 1) * 10}/200/300"
            alt="Product Image ${index}"
          />
          <div slot="footer">
            ${product.quantity === 0
              ? html`
                  <sp-button
                    variant="accent"
                    @click="${() => this.store.addToCart(product)}"
                    >Add</sp-button
                  >
                `
              : ''}
            ${product.quantity > 0
              ? html`
                  <sp-field-label
                    side-aligned="start"
                    for="card-quantity-${index}"
                    >Quantity</sp-field-label
                  >
                  <sp-number-field
                    id="card-quantity-${index}"
                    value="${product.quantity}"
                    @change="${(e) =>
                      this.store.updateQuantity(product, e.target.value)}"
                  ></sp-number-field>
                `
              : ''}
          </div>
        </sp-card>
      `,
    );
  }

  get cart() {
    const cartItems = this.store.products
      .filter((p) => p.quantity > 0)
      .map(
        (p) => html`
          <sp-table-row>
            <sp-table-cell>${p.title}</sp-table-cell>
            <sp-table-cell>${p.quantity}</sp-table-cell>
            <sp-table-cell>$${p.total}</sp-table-cell>
          </sp-table-row>
        `,
      );
    return html` <p>Cart Total: $${this.store.total}</p>
      <sp-table size="m">
        <sp-table-head>
          <sp-table-head-cell>Name</sp-table-head-cell>
          <sp-table-head-cell>Quantity</sp-table-head-cell>
          <sp-table-head-cell>Total</sp-table-head-cell>
        </sp-table-head>
        <sp-table-body> ${cartItems} </sp-table-body>
      </sp-table>`;
  }
  render() {
    return html`
      <div class="cards">${this.cards}</div>
      <div class="cart">
        ${this.cart}
        <div class="reaction">
          Last interacted product:
          <sp-badge variant="negative">${this.lastProductTitle}&nbsp;</sp-badge>
        </div>
      </div>
      <a class="project-link" href="https://github.com/yesil/picosm"
        >Go to project page</a
      >
    `;
  }
}

customElements.define('pico-demo', makeLitObserver(App));
