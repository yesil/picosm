import { css, html, nothing } from 'lit';
import { observe } from '../src/index.js';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const money = (value) => currency.format(value);

/**
 * Counts the notifications of the store returned by getTarget, rebinding when it changes.
 * Every observe() returns a disposer: the controller calls it when the host disconnects.
 */
export class NotificationCounter {
  count = 0;
  #target = null;
  #dispose = null;

  constructor(host, getTarget, timeout) {
    this.host = host;
    this.getTarget = getTarget;
    this.timeout = timeout;
    host.addController(this);
  }

  hostConnected() {
    this.#bind();
  }

  hostUpdate() {
    if (this.host.isConnected && this.getTarget() !== this.#target) this.#bind();
  }

  hostDisconnected() {
    this.#dispose?.();
    this.#dispose = null;
    this.#target = null;
  }

  #bind() {
    this.#dispose?.();
    this.#target = this.getTarget();
    this.#dispose = this.#target
      ? observe(
          this.#target,
          () => {
            this.count++;
            this.host.requestUpdate();
          },
          this.timeout,
        )
      : null;
  }
}

const TOKENS =
  /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(class|static|extends|const|let|new|return|async|await|if|throw|this|true|false|null)\b|\b(\d+(?:\.\d+)?)\b/g;
const TOKEN_KINDS = ['comment', 'string', 'keyword', 'number'];

export function code(source) {
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(TOKENS)) {
    parts.push(source.slice(last, match.index));
    const kind = TOKEN_KINDS[match.slice(1).findIndex((group) => group !== undefined)];
    parts.push(html`<span class="tok-${kind}">${match[0]}</span>`);
    last = match.index + match[0].length;
  }
  parts.push(source.slice(last));
  return html`<pre class="code"><code>${parts}</code></pre>`;
}

export const metric = (label, value) => html`
  <div class="metric">
    <span class="metric-value">${value}</span>
    <span class="metric-label">${label}</span>
  </div>
`;

export function card({ number, title, apis, description, demo, metrics, snippet }) {
  return html`
    <article class="card">
      <header class="card-header">
        <span class="number">${String(number).padStart(2, '0')}</span>
        <h2>${title}</h2>
        <div class="apis">${apis.map((api) => html`<code class="api">${api}</code>`)}</div>
      </header>
      <p class="description">${description}</p>
      <div class="demo">${demo}</div>
      ${metrics ? html`<div class="metrics">${metrics}</div>` : nothing}
      ${code(snippet)}
    </article>
  `;
}

export const sharedStyles = css`
  :host {
    display: block;
    color: var(--text);
    font: 15px/1.5 var(--font);
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .card {
    display: grid;
    gap: 16px;
    padding: 22px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .card-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }

  .number {
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-strong);
    font: 600 12px/1.6 var(--mono);
  }

  h2 {
    margin: 0;
    font-size: 19px;
    letter-spacing: -0.01em;
  }

  h3,
  .eyebrow {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .apis {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-left: auto;
  }

  .api,
  .description code,
  .hint code {
    font: 12.5px var(--mono);
    color: var(--accent-strong);
  }

  .api {
    padding: 2px 7px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-2);
  }

  .description {
    margin: 0;
    color: var(--text-muted);
  }

  .demo {
    display: grid;
    gap: 14px;
    padding: 16px;
    border-radius: 12px;
    background: var(--surface-2);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
  }

  .metric {
    display: grid;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .metric-value {
    font: 600 24px/1.2 var(--mono);
    font-variant-numeric: tabular-nums;
  }

  .metric-label {
    font-size: 12.5px;
    color: var(--text-muted);
  }

  .code {
    margin: 0;
    padding: 14px 16px;
    overflow-x: auto;
    border-radius: 12px;
    background: var(--code-bg);
    color: var(--code-text);
    font: 12.5px/1.6 var(--mono);
  }

  .tok-keyword {
    color: var(--code-keyword);
  }

  .tok-string {
    color: var(--code-string);
  }

  .tok-comment {
    color: var(--code-comment);
    font-style: italic;
  }

  .tok-number {
    color: var(--code-number);
  }

  button,
  .btn {
    font: inherit;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
    padding: 5px 13px;
    border: 1px solid var(--border-strong);
    border-radius: 9px;
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
    text-decoration: none;
    cursor: pointer;
    transition:
      background 120ms,
      border-color 120ms;
  }

  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }

  .btn:focus-visible,
  .chip:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
  }

  .btn.primary:hover:not(:disabled) {
    background: var(--accent-strong);
    border-color: var(--accent-strong);
  }

  .btn.quiet {
    border-color: transparent;
    background: transparent;
    color: var(--text-muted);
  }

  .chip {
    padding: 4px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text);
    font-size: 13.5px;
    cursor: pointer;
  }

  .chip[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-weight: 600;
  }

  .emoji {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: 19px;
  }

  .empty {
    margin: 0;
    padding: 14px;
    border: 1px dashed var(--border-strong);
    border-radius: 10px;
    color: var(--text-muted);
    font-size: 14px;
    text-align: center;
  }

  .error {
    color: var(--danger);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (max-width: 560px) {
    .card {
      padding: 16px;
    }

    .demo {
      padding: 12px;
    }

    .apis {
      margin-left: 0;
    }
  }
`;
