import { fake } from 'sinon';
import { expect } from '@esm-bundle/chai';
import { makeObservable, observe } from '../src/makeObservable.js';
import TestStore from './TestStore.js';
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

const UserObservable = makeObservable(User, ['setLastName', ['name']]);

class HelloWorld extends LitElement {
  static properties = {
    user: { type: Object },
  };
  render() {
    return html`<p>Hello, ${this.user?.name ?? 'World'}!</p>`;
  }
}
customElements.define('hello-world', litObserver(HelloWorld, ['user']));

describe('LitOserver', () => {
  it('should dispose observer', async () => {
    const helloWorld = document.createElement('hello-world');
    document.body.appendChild(helloWorld);
    await helloWorld.updateComplete;
    expect(helloWorld.shadowRoot.textContent).to.equal('Hello, World!');
    helloWorld.user = new UserObservable();
    helloWorld.user.setLastName('Doe');
    await helloWorld.updateComplete;
    expect(helloWorld.shadowRoot.textContent).to.equal('Hello, John Doe!');
  });
});
