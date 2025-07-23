import { expect } from '@esm-bundle/chai';
import { makeObservable, observe } from '../src/makeObservable.js';
import { html, LitElement } from 'lit';
import { makeLitObserver } from '../src/makeLitObserver.js';

const wait = () => new Promise((resolve) => setTimeout(resolve, 200));

class User {
  static observableActions = ['setLastName'];
  static computedProperties = ['name'];

  firstName = 'John';
  lastName = '';

  setLastName(name) {
    this.lastName = name;
  }

  get name() {
    return `${this.firstName} ${this.lastName}`;
  }
}

makeObservable(User);

class HelloWorld extends LitElement {
  static properties = {
    user: { type: Object, observe: true },  /* observe: true by default */
  };
  render() {
    return html`<p>Hello, ${this.user?.name ?? 'World'}!</p>`;
  }
}

customElements.define('hello-world', makeLitObserver(HelloWorld));

class HelloWorldSlow extends LitElement {
  static properties = {
    user: { type: Object, observe: true, throttle: 200 },
  };
  render() {
    return html`<p>Hello, ${this.user?.name ?? 'World'}!</p>`;
  }
}
customElements.define('hello-world-slow', makeLitObserver(HelloWorldSlow));

describe('LitOserver', () => {
  it('should dispose observer', async () => {
    const helloWorld = document.createElement('hello-world');
    document.body.appendChild(helloWorld);
    await helloWorld.updateComplete;
    expect(helloWorld.shadowRoot.textContent).to.equal('Hello, World!');
    helloWorld.user = new User();
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
    helloWorldSlow.user = new User();
    await helloWorldSlow.updateComplete;
    helloWorldSlow.user.setLastName('D');
    await helloWorldSlow.updateComplete;
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, John D!');
    helloWorldSlow.user.setLastName('Doe');
    await helloWorldSlow.updateComplete;
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, John D!');
    await wait(200);
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, John Doe!');
  });
});
