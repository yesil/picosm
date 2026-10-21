# API reference

## `makeObservable(constructor)`

Instruments a class with observable capabilities. Call once per class.

The class should declare:
- `static observableActions` — method names that notify observers after execution
- `static computedProperties` — getter names whose values are cached until the next action

Listed names must be methods and getters of the class or of its parent classes. Anything else throws, including arrow functions assigned to class fields, which live on each instance rather than on the class:

```javascript
class Store {
  static observableActions = ['increment'];
  increment = () => {}; // TypeError: "increment" is listed in observableActions but is not a method
}
```

A subclass of an observable class can call `makeObservable` too, to instrument the actions and getters it adds.

## `observe(target, callback, timeout?)`

Registers a `callback` that fires when any observable action completes on `target`.

Returns a **disposer** function.

```javascript
// Immediate — fires after observable actions, batched by microtask
const disposer = observe(counter, () => console.log('changed'));

// Throttled — fires at most once per 200ms, with trailing edge
const disposer = observe(counter, () => console.log('changed'), 200);
```

Disposing a throttled observer also cancels its pending trailing call.

Notifications are batched via microtask: multiple synchronous actions on the same target produce a single callback invocation.

## `reaction(target, selector, effect, timeout?)`

Runs `selector(target)` once to record the starting values, then after each action. When the returned array differs element-wise (compared with `Object.is`) from the previous result, calls `effect(...values)`. Return an empty array from `selector` to skip execution.

Returns a **disposer** function.

```javascript
import { reaction } from 'picosm';

const disposer = reaction(
  counter,
  ({ value }) => [value],
  (value) => console.log('Value changed to', value),
);
counter.increment(); // logs: "Value changed to 1"
await new Promise(queueMicrotask);
disposer();
```

### Multiple targets

Pass an array of targets. The `selector` receives them as positional arguments:

```javascript
const disposer = reaction(
  [storeA, storeB],
  (a, b) => {
    const sum = a.counter + b.counter;
    return sum % 5 === 0 && sum !== 0 ? [sum] : [];
  },
  (sum) => console.log('Sum divisible by 5:', sum),
);
```

## `track(target, source)`

Forwards notifications: when `source` changes, `target`'s observers are notified and its computed properties are invalidated. Tracking that would form a cycle, such as `track(a, b)` together with `track(b, a)`, throws.

Returns a **disposer** function.

```javascript
import { track, observe } from 'picosm';

const parent = new Counter();
const child = new Counter();

const untrack = track(parent, child);

const stopObserving = observe(parent, () => {
  console.log('child changed, parent notified');
});

child.increment(); // triggers both child and parent observers
await new Promise(queueMicrotask);
stopObserving();
untrack();
```

## `subscribe(target, callback)` / `notify(target, message)`

A message-passing channel over any observable. Unlike `observe`, messages are delivered synchronously and carry an explicit payload.

Returns a **disposer** function (from `subscribe`).

```javascript
import { subscribe, notify } from 'picosm';

const disposer = subscribe(counter, (msg) => console.log('Received:', msg));
notify(counter, { type: 'reset', value: 0 });
disposer();
```

## Async actions

Actions that return a `Promise` (whether declared `async` or not) notify observers after the promise settles, whether it resolves or rejects:

```javascript
class Store {
  static observableActions = ['fetchData'];
  data = null;

  async fetchData() {
    const res = await fetch('/api/data');
    this.data = await res.json();
  }
}

makeObservable(Store);
```

Intermediate state changes within an async action are not observable until the action completes. If you need to notify observers mid-action, split it into separate actions. For the same reason, a method that returns a Promise which only settles later (a confirmation dialog waiting for the user, say) should not be an action: make the synchronous part an action and return the Promise from a plain method.
