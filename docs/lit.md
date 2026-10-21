# Lit

Enhances a `LitElement` class to automatically observe properties marked with `observe: true`. When the observed object's actions fire, the component calls `requestUpdate`.

```javascript
import { html, LitElement } from 'lit';
import { makeLitObserver } from 'picosm';

class MyView extends LitElement {
  static properties = {
    counter: { type: Object, observe: true },
    // throttled: only re-render at most once per 200ms
    stats: { type: Object, observe: true, throttle: 200 },
  };

  render() {
    return html`<p>Count: ${this.counter?.value}</p>`;
  }
}

customElements.define('my-view', makeLitObserver(MyView));
```

When a new object is assigned to an observed property, the old observer is disposed and a new one is bound automatically. Inherited properties are observed too. Assigning a value that is not an observable instance to such a property throws.

The observer doesn't replay changes the element missed while it was detached. If the store can change in that time, call `this.requestUpdate()` after `super.connectedCallback()` in your own `connectedCallback`. When a store is only ever set as a property, declare it with `attribute: false` so Lit doesn't also look for an HTML attribute of that name.
