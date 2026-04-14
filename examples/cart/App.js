import { LitElement, html, css } from 'lit';
import { makeLitObserver, reaction } from '../../dist/picosm.js';

export class App extends LitElement {
  #reactionDisposer;

  static properties = {
    cartStore: { observe: true },
    filterStore: { observe: true },
    viewStore: { observe: true },
    router: {},
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
        max-width: 900px;
        width: 100%;
        padding: 0 16px;
        box-sizing: border-box;
      }

      .toolbar {
        display: flex;
        gap: 16px;
        align-items: center;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }

      .toolbar-spacer {
        flex: 1;
      }

      .cards {
        display: flex;
        justify-content: space-between;
        flex: 1;
        gap: 32px;
        flex-wrap: wrap;
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

      .cart-drawer {
        margin-top: 24px;
        padding: 16px;
        background: var(--spectrum-gray-100);
        border-radius: 8px;
      }

      .cart-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      sp-card {
        width: 220px;
        min-height: 350px;
        cursor: pointer;
      }

      sp-number-field {
        width: 80px;
      }

      .url-bar {
        margin-top: 24px;
        padding: 8px 12px;
        background: var(--spectrum-gray-100);
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        word-break: break-all;
        opacity: 0.7;
      }

      .detail-view {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .detail-view img {
        max-width: 400px;
        border-radius: 8px;
      }

      .detail-header {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .reaction {
        opacity: 0;
        margin-top: 20px;
      }

      @keyframes fadeOut {
        0% { opacity: 1; }
        50% { opacity: 1; }
        100% { opacity: 0; }
      }

      .fadeOut {
        animation-duration: 3s;
        animation-name: fadeOut;
      }

      .active-filters {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .footer {
        margin-top: 24px;
        margin-bottom: 16px;
        text-align: center;
      }
    `,
  ];

  constructor() {
    super();
    this.lastProductTitle = '';
  }

  updated(changedProperties) {
    if (changedProperties.has('cartStore') && this.cartStore) {
      this.#reactionDisposer?.();
      this.#reactionDisposer = reaction(
        this.cartStore,
        ({ lastProduct }) => lastProduct?.title ? [lastProduct.title] : [],
        (title) => {
          const el = this.shadowRoot?.querySelector('.reaction');
          if (!el) return;
          el.classList.remove('fadeOut');
          void el.offsetWidth;
          el.classList.add('fadeOut');
          this.lastProductTitle = title;
        },
      );
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#reactionDisposer?.();
  }

  get filteredProducts() {
    let products = this.viewStore?.products || [];
    const category = this.filterStore?.category;
    if (category) {
      products = products.filter((p) => p.category === category);
    }
    const sort = this.filterStore?.sort || 'name';
    if (sort === 'price') {
      products = [...products].sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      products = [...products].sort((a, b) => b.price - a.price);
    } else {
      products = [...products].sort((a, b) => a.title.localeCompare(b.title));
    }
    return products;
  }

  get categories() {
    const products = this.viewStore?.products || [];
    return [...new Set(products.map((p) => p.category))].sort();
  }

  renderToolbar() {
    return html`
      <div class="toolbar">
        <sp-picker
          label="Category"
          value=${this.filterStore?.category || ''}
          @change=${(e) => this.filterStore.setFilter('category', e.target.value)}
        >
          <sp-menu-item value="">All</sp-menu-item>
          ${this.categories.map(
            (c) => html`<sp-menu-item value=${c}>${c}</sp-menu-item>`,
          )}
        </sp-picker>

        <sp-picker
          label="Sort by"
          value=${this.filterStore?.sort || 'name'}
          @change=${(e) => this.filterStore.setFilter('sort', e.target.value)}
        >
          <sp-menu-item value="name">Name</sp-menu-item>
          <sp-menu-item value="price">Price: Low to High</sp-menu-item>
          <sp-menu-item value="price-desc">Price: High to Low</sp-menu-item>
        </sp-picker>

        ${this.filterStore?.category || (this.filterStore?.sort && this.filterStore.sort !== 'name')
          ? html`
              <sp-button variant="secondary" @click=${() => this.filterStore.clearFilters()}>
                Clear filters
              </sp-button>
            `
          : ''}

        <div class="toolbar-spacer"></div>

        <sp-button
          variant=${this.cartStore?.open ? 'accent' : 'primary'}
          @click=${() => this.cartStore.toggleCart()}
        >
          Cart ${this.cartStore?.count > 0
            ? html`<sp-badge variant="positive">${this.cartStore.count}</sp-badge>`
            : ''}
        </sp-button>
      </div>

      ${this.filterStore?.category
        ? html`
            <div class="active-filters">
              <sp-badge variant="informative">
                ${this.filterStore.category}
              </sp-badge>
            </div>
          `
        : ''}
    `;
  }

  renderCards() {
    return html`
      <div class="cards">
        ${this.filteredProducts.map(
          (product, index) => html`
            <sp-card
              heading="${product.title}"
              subheading="$${product.price}"
              @click=${() => this.router.navigate(window.location.pathname, { query: { product: product.title } })}
            >
              <img
                slot="preview"
                src="https://picsum.photos/id/${(this.viewStore.products.indexOf(product) + 1) * 10}/200/300"
                alt="${product.title}"
              />
              <div slot="footer">
                ${product.quantity === 0
                  ? html`
                      <sp-button
                        variant="accent"
                        @click=${(e) => {
                          e.stopPropagation();
                          this.cartStore.addToCart(product);
                        }}
                      >Add</sp-button>
                    `
                  : html`
                      <sp-field-label side-aligned="start" for="qty-${index}">Quantity</sp-field-label>
                      <sp-number-field
                        id="qty-${index}"
                        value="${product.quantity}"
                        @click=${(e) => e.stopPropagation()}
                        @change=${(e) => {
                          e.stopPropagation();
                          this.cartStore.updateQuantity(product, e.target.value);
                        }}
                      ></sp-number-field>
                    `}
              </div>
            </sp-card>
          `,
        )}
      </div>
    `;
  }

  renderDetail() {
    const productId = this.viewStore?.productId;
    const product = this.viewStore?.products.find((p) => p.title === productId);
    if (!product) {
      return html`
        <div class="detail-view">
          <p>Product not found: ${productId}</p>
          <sp-button @click=${() => this.viewStore.setView('catalog', null)}>Back to catalog</sp-button>
        </div>
      `;
    }
    const imgIndex = this.viewStore.products.indexOf(product) + 1;
    return html`
      <div class="detail-view">
        <div class="detail-header">
          <sp-button variant="secondary" @click=${() => this.viewStore.setView('catalog', null)}>Back</sp-button>
          <h2>${product.title}</h2>
          <sp-badge variant="informative">${product.category}</sp-badge>
        </div>
        <img src="https://picsum.photos/id/${imgIndex * 10}/400/300" alt="${product.title}" />
        <p>Price: $${product.price}</p>
        ${product.quantity === 0
          ? html`<sp-button variant="accent" @click=${() => this.cartStore.addToCart(product)}>Add to Cart</sp-button>`
          : html`
              <div style="display:flex;align-items:center;gap:12px">
                <sp-field-label>Quantity</sp-field-label>
                <sp-number-field
                  value="${product.quantity}"
                  @change=${(e) => this.cartStore.updateQuantity(product, e.target.value)}
                ></sp-number-field>
              </div>
            `}
      </div>
    `;
  }

  renderCartDrawer() {
    if (!this.cartStore?.open) return '';
    const cartItems = this.cartStore.products
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
    return html`
      <div class="cart-drawer">
        <div class="cart-header">
          <h3>Cart</h3>
          <sp-badge variant="positive">${this.cartStore.count} items</sp-badge>
          <div style="flex:1"></div>
          <p>Total: $${this.cartStore.total}</p>
        </div>
        ${cartItems.length > 0
          ? html`
              <sp-table size="m">
                <sp-table-head>
                  <sp-table-head-cell>Name</sp-table-head-cell>
                  <sp-table-head-cell>Quantity</sp-table-head-cell>
                  <sp-table-head-cell>Total</sp-table-head-cell>
                </sp-table-head>
                <sp-table-body>${cartItems}</sp-table-body>
              </sp-table>
            `
          : html`<p>Cart is empty</p>`}
      </div>
    `;
  }

  render() {
    const view = this.viewStore?.view || 'catalog';
    return html`
      ${this.renderToolbar()}
      ${view === 'catalog' ? this.renderCards() : this.renderDetail()}
      ${this.renderCartDrawer()}
      <div class="reaction">
        Last interacted product:
        <sp-badge variant="negative">${this.lastProductTitle}&nbsp;</sp-badge>
      </div>
      <div class="url-bar">${window.location.href}</div>
      <div class="footer">
        <a href="https://github.com/yesil/picosm">Go to project page</a>
      </div>
    `;
  }
}

customElements.define('pico-demo', makeLitObserver(App));
