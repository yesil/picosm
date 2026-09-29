import { expect } from '@esm-bundle/chai';
import { makeObservable, observe } from '../src/makeObservable.js';
import { html, LitElement } from 'lit';
import { makeLitObserver } from '../src/makeLitObserver.js';

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));
const flush = () => new Promise((r) => queueMicrotask(r));

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
    user: { type: Object, observe: true },
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

class BaseView extends LitElement {
  static properties = {
    user: { type: Object, observe: true },
  };
  render() {
    return html`<p>Hello, ${this.user?.name ?? 'World'}!</p>`;
  }
}

class InheritedView extends BaseView {}
customElements.define('inherited-view', makeLitObserver(InheritedView));

class ExtendedView extends BaseView {
  static properties = {
    heading: {},
  };
}
customElements.define('extended-view', makeLitObserver(ExtendedView));

class DecoratedView extends LitElement {
  render() {
    return html`<p>Hello, ${this.user?.name ?? 'World'}!</p>`;
  }
}
// What the @property({ observe: true }) decorator does
DecoratedView.createProperty('user', { observe: true });
customElements.define('decorated-view', makeLitObserver(DecoratedView));

describe('makeLitObserver', () => {
  it('should dispose observer', async () => {
    const helloWorld = document.createElement('hello-world');
    document.body.appendChild(helloWorld);
    await helloWorld.updateComplete;
    expect(helloWorld.shadowRoot.textContent).to.equal('Hello, World!');
    helloWorld.user = new User();
    await helloWorld.updateComplete;
    expect(helloWorld.shadowRoot.textContent).to.equal('Hello, John !');
    helloWorld.user.setLastName('Doe');
    await flush();
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
    await flush();
    await helloWorldSlow.updateComplete;
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, John D!');
    helloWorldSlow.user.setLastName('Doe');
    await flush();
    await helloWorldSlow.updateComplete;
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, John D!');
    await wait(200);
    expect(helloWorldSlow.shadowRoot.textContent).to.equal('Hello, John Doe!');
  });
  it('observes inherited and decorator-declared properties', async () => {
    for (const tag of ['inherited-view', 'extended-view', 'decorated-view']) {
      const element = document.createElement(tag);
      document.body.appendChild(element);
      element.user = new User();
      await element.updateComplete;
      element.user.setLastName('Doe');
      await flush();
      await element.updateComplete;
      expect(element.shadowRoot.textContent, tag).to.equal('Hello, John Doe!');
      element.remove();
    }
  });

  it('does not observe while disconnected', async () => {
    const element = document.createElement('hello-world');
    document.body.appendChild(element);
    element.user = new User();
    await element.updateComplete;

    element.remove();
    const user = new User();
    element.user = user;
    await element.updateComplete;
    expect(user.__observers?.size ?? 0).to.equal(0);

    document.body.appendChild(element);
    await element.updateComplete;
    user.setLastName('Doe');
    await flush();
    await element.updateComplete;
    expect(element.shadowRoot.textContent).to.equal('Hello, John Doe!');
    element.remove();
  });

  it('throws a descriptive error when an observed property holds a non-observable value', async () => {
    const element = document.createElement('hello-world');
    document.body.appendChild(element);
    await element.updateComplete;

    element.user = { name: 'plain object' };
    const error = await element.updateComplete.catch((e) => e);

    expect(error).to.be.instanceOf(TypeError);
    expect(error.message).to.match(
      /property "user" of <hello-world> is declared with observe: true/,
    );
    element.remove();
  });
});
