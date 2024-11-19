# Pico State Manager 🎷

Live demo: https://yesil.github.io/picosm

## Introduction

This is an experimental lightweight, zero dependency state manager that attempts to replicate core MobX features without using Proxy objects.

It also provides a helper function to make Lit components observers and updates them on changes.

Currently, the non minified bundle size is `4938 bytes` and is around `~1.2kb` gzipped.

## Partially Supported Features

- `makeObservable`: generates a new class whose instances are observable
- `observe`: callback when the instance of an observable class changes
- `reaction`: react to specific changes
- `computed`: cache computed values

Also, an opinionated approach for tracking nested dependencies with `track/untrack` functions is added. <br>
If an observable wants to get notified by another one, these functions can be used.

## How to Use

Add the picosm dependency

```bash
npm add https://github.com/yesil/picosm/releases/download/v1.0.2/picosm-1.0.2.tgz
```

See the unit test: https://github.com/yesil/picosm/blob/main/test/LitObserver.test.js <br>
See the demo app source code: https://github.com/yesil/picosm/tree/main/app for a more comprehensive example.

## Contributing

Please feel free to:

Open a PR to contribute.
Create an issue to request a feature.
