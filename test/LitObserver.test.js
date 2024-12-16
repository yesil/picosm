import { expect } from '@esm-bundle/chai';
import { makeObservable } from '../src/makeObservable.js';
import { html, LitElement } from 'lit';
import { litObserver } from '../src/LitObserver.js';

class User {
  firstName = 'John';
  lastName = '';

  setLastName(name) {
    this.lastName = name;
  }

  get name() {
    return `${this.firstName} ${this.lastName}`;
  }
}

const UserObservable = makeObservable(User, ['setLastName'], ['name']);

class HelloWorld extends LitElement {
  static properties = {
    user: { type: Object },
  };
  render() {
    return html`<p>Hello, ${this.user?.name ?? 'World'}!</p>`;
  }
}
customElements.define('hello-world', litObserver(HelloWorld, ['user']));
customElements.define(
  'hello-world-slow',
  litObserver(HelloWorld, [['user', 500]]),
);

describe('LitOserver', () => {
  it('should dispose observer', async () => {
    const helloWorld = document.createElement('hello-world');
    document.body.appendChild(helloWorld);
    await helloWorld.updateComplete;
    expect(helloWorld.shadowRoot.textContent).to.equal('Hello, World!');
    helloWorld.user = new UserObservable();
    await helloWorld.updateComplete;
    expect(helloWorld.shadowRoot.textContent).to.equal('Hello, John !');
    helloWorld.user.setLastName('Doe');
    await helloWorld.updateComplete;
    expect(helloWorld.shadowRoot.textContent).to.equal('Hello, John Doe!');
  });

  it('should support slow observing', async () => {
    const helloWorldSlow = document.createElement('hello-world-slow');
    document.body.appendChild(helloWorldSlow);
    await helloWorldSlow.updateComplete;
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, World!');
    helloWorldSlow.user = new UserObservable();
    await helloWorldSlow.updateComplete;
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, John !');
    helloWorldSlow.user.setLastName('Doe');
    await helloWorldSlow.updateComplete;
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, John !');
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, John Doe!');
  });
});
