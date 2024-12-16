# Pico State Manager 🎷

Live demo: https://yesil.github.io/picosm

## Introduction

Pico State Manager is an experimental, lightweight, zero-dependency state manager that replicates core MobX features without using Proxy objects.

It also provides a helper function to make Lit components observers and updates them on changes.

Currently, the non-minified bundle size is `5992 bytes` and around `1536 bytes` gzipped.

You can also import only the specific modules you need from the source to further reduce the size.

## Partially Supported Features

- `makeObservable`: Generates a new class whose instances are observable.
- `observe`: Callback when the instance of an observable class changes.
- `reaction`: React to specific changes.
- `track`: Tracks other observables and notifies own observers on change.
- `subscribe`: Subscribe to changes in an observable.
- `notify`: Notify all subscribers of changes.
- `computed`: Cache computed values.

## How to Use

Add the picosm dependency:

```bash
npm add https://github.com/yesil/picosm/releases/download/v1.0.3/picosm-1.0.3.tgz
```

See the unit test: https://github.com/yesil/picosm/blob/main/test/LitObserver.test.js <br>
See the demo app source code: https://github.com/yesil/picosm/tree/main/app for a more comprehensive example.

## API Documentation

### `makeObservable`

Generates a new class whose instances are observable.

### `observe`

Creates an observer for a given observable.

Returns a `disposer` function.

### `reaction`

React to specific changes.

Returns a `disposer` function.

### `track`

Tracks other observables and notifies own observers on change.

Returns a `disposer` function.

### `subscribe`

An observable becomes automatically a subscription queue, where one can register several subscriptions for receiving arbitrary messages.

Returns a `disposer` function.

#### Example

```javascript
const disposer = subscribe(observableInstance, (message) => {
  console.log('Message received', message);
});
```

### `notify`

Notify all subscribers of changes.

#### Example

```javascript
notify(observableInstance, message);
```

### `computed`

Cache computed values.

## Contributing

Please feel free to:

- Open a PR to contribute.
- Create an issue to request a feature.
