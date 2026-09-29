import { LitElement, css, html, nothing, repeat } from 'lit';
import { makeLitObserver } from '../src/index.js';
import { sharedStyles } from './ui.js';

function define(name, element) {
  customElements.define(name, makeLitObserver(element));
}

const KINDS = ['action', 'notify', 'reaction', 'message', 'router', 'error'];

class ActivityPanel extends LitElement {
  static properties = {
    activity: { observe: true, throttle: 100 },
  };

  static styles = [
    sharedStyles,
    css`
      .panel {
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
        gap: 12px;
        max-height: calc(100vh - 32px);
        padding: 18px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
      }

      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 12.5px;
        color: var(--text-muted);
      }

      .legend li::before {
        content: '';
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 5px;
        border-radius: 50%;
        background: var(--kind);
      }

      .entries {
        display: grid;
        align-content: start;
        gap: 2px;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        list-style: none;
      }

      .entry {
        display: grid;
        grid-template-columns: 8px minmax(0, 1fr) auto;
        align-items: baseline;
        gap: 8px;
        padding: 5px 2px;
        border-bottom: 1px solid var(--border);
        font-size: 13px;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--kind);
      }

      .text {
        overflow-wrap: anywhere;
        font-family: var(--mono);
        font-size: 12.5px;
      }

      time {
        color: var(--text-muted);
        font: 11.5px var(--mono);
        font-variant-numeric: tabular-nums;
      }

      [data-kind='action'] {
        --kind: var(--kind-action);
      }

      [data-kind='notify'] {
        --kind: var(--kind-notify);
      }

      [data-kind='reaction'] {
        --kind: var(--kind-reaction);
      }

      [data-kind='message'] {
        --kind: var(--kind-message);
      }

      [data-kind='router'] {
        --kind: var(--kind-router);
      }

      [data-kind='error'] {
        --kind: var(--kind-error);
      }

      @media (max-width: 1060px) {
        .panel {
          max-height: 420px;
        }
      }
    `,
  ];

  render() {
    const { entries } = this.activity;
    return html`
      <section class="panel" aria-label="Activity">
        <div class="panel-head">
          <h2>Activity</h2>
          <button class="btn quiet" ?disabled=${!entries.length} @click=${() => this.activity.clear()}>
            Clear
          </button>
        </div>
        <ul class="legend" aria-label="Legend">
          ${KINDS.map((kind) => html`<li data-kind=${kind}>${kind}</li>`)}
        </ul>
        ${entries.length === 0
          ? html`<p class="empty">Interact with the cards to see what picosm does.</p>`
          : html`
              <ol class="entries">
                ${repeat(
                  entries,
                  (entry) => entry.id,
                  (entry) => html`
                    <li class="entry" data-kind=${entry.kind}>
                      <span class="dot" aria-hidden="true"></span>
                      <span class="text"><span class="visually-hidden">${entry.kind}: </span>${entry.text}</span>
                      <time>${(entry.at / 1000).toFixed(2)}s</time>
                    </li>
                  `,
                )}
              </ol>
            `}
      </section>
    `;
  }
}

define('activity-panel', ActivityPanel);

class ToastStack extends LitElement {
  static properties = {
    toasts: { observe: true },
  };

  static styles = css`
    .stack {
      position: fixed;
      right: 16px;
      bottom: 16px;
      left: 16px;
      z-index: 10;
      display: grid;
      justify-items: center;
      gap: 8px;
      pointer-events: none;
    }

    .toast {
      padding: 10px 16px;
      border-radius: 12px;
      background: var(--text);
      color: var(--bg);
      box-shadow: 0 10px 30px rgb(0 0 0 / 25%);
      font: 500 14px/1.4 var(--font);
      animation: rise 200ms ease-out;
    }

    .toast.success {
      background: var(--success);
      color: #fff;
    }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast {
        animation: none;
      }
    }
  `;

  render() {
    return html`
      <div class="stack" role="status">
        ${repeat(
          this.toasts.items,
          (toast) => toast.id,
          (toast) => html`<div class="toast ${toast.tone}">${toast.text}</div>`,
        )}
      </div>
    `;
  }
}

define('toast-stack', ToastStack);

class ConfirmDialog extends LitElement {
  static properties = {
    confirmation: { observe: true },
  };

  static styles = [
    sharedStyles,
    css`
      dialog {
        max-width: min(420px, calc(100vw - 32px));
        padding: 22px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        box-shadow: 0 20px 60px rgb(0 0 0 / 30%);
      }

      dialog::backdrop {
        background: rgb(20 12 6 / 45%);
      }

      p {
        margin: 0 0 18px;
        font-size: 16px;
      }

      .row {
        justify-content: flex-end;
      }
    `,
  ];

  updated() {
    const dialog = this.renderRoot.querySelector('dialog');
    if (this.confirmation.message && !dialog.open) dialog.showModal();
    if (!this.confirmation.message && dialog.open) dialog.close();
  }

  render() {
    return html`
      <dialog
        aria-labelledby="message"
        @cancel=${(event) => {
          event.preventDefault();
          this.confirmation.answer(false);
        }}
      >
        <p id="message">${this.confirmation.message ?? nothing}</p>
        <div class="row">
          <button class="btn" @click=${() => this.confirmation.answer(false)}>Stay</button>
          <button class="btn primary" @click=${() => this.confirmation.answer(true)}>Leave</button>
        </div>
      </dialog>
    `;
  }
}

define('confirm-dialog', ConfirmDialog);
