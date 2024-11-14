# Pico State Manager

Live demo: https://yesil.github.io/picosm

## Introduction

This is an experimental lightweight, zero dependency state manager that attempts to replicate core MobX features without using Proxy objects.

It also provides a helper function to make Lit components observers and updates them on changes.

Currently, the non minified bundle size is `4938 bytes` and is around `~1.2kb` gzipped.

## Partially Supported Features

- `makeObservable` (instance level change detection)
- `observe` (callback when the instance of an observable class changes)
- `reaction` (react to specific changes)
- `computed` (cache computed values)

Also, an opinionated approach for tracking nested dependencies with `track/untrack` functions is added. If an observable wants to get notified by another one, these functions can be used.

## Why Yet Another State Manager

Libraries like Redux, Zustand, and Nanostores treat the state as a typeless object and require updating to the next version of the state manually. This results in verbose code with application logic scattered around in various functions, making it hard to understand.

## How to Use

See the demo app source code: https://github.com/yesil/picosm/tree/main/demo-app

## Contributing

Please feel free to:

Open a PR to contribute.
Create an issue to request a feature.

```

```
