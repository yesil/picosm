# Performance tracing

`startTrace()` records what picosm does until `stopTrace()` returns the trace: actions, notifications, computed values, `track()` forwards, reactions, messages, Lit updates and router steps. The trace uses the Chrome trace event format, so [Perfetto](https://ui.perfetto.dev) and the Chrome DevTools Performance panel open it as a JSON file.

```javascript
import { startTrace, stopTrace } from 'picosm';

startTrace();
// … use the app …
const trace = stopTrace();
// In the DevTools console, copy(JSON.stringify(trace)) puts it on the clipboard
```

Every span has a numeric `args.id`, and `args.kind` says what it records:

| `kind` | Span name | Details in `args` |
|---|---|---|
| `action` | `Cart.addItem` | `instance` (`Cart#1`) and `outcome`: `returned`, `threw`, or `pending` for an action that returned a Promise |
| `action-settled` | `Cart.checkout settled` | When an async action's Promise settled: `action` (the action's id) and `outcome`, `resolved` or `rejected`. An async span named after the action covers the wait. |
| `notification` | `Cart notification` | `observers`, and `causes`: the ids of the actions and forwards whose changes it delivers |
| `computed` | `Cart.total computed` | A recomputed getter. Reads from the cache are counted in `otherData.computedHits`, by `Class.getter`. |
| `track` | `track Cart → Summary` | `source`, `target`, and the `notification` being forwarded |
| `reaction` | `reaction showBadge` | `targets`, `selector`, `effect`, the `notification` that ran it, and `result`: `changed`, `unchanged`, or `skipped` when the selector returned `[]` |
| `message` | `Cart message` | `subscribers` |
| `view-request` | `<cart-view> update requested` | A store change asking a Lit view to update: `store`, `property`, `throttleMs`, and the `notification`, which is `null` when a throttled observer calls later |
| `view-update` | `<cart-view> update` | `firstUpdate`, `domMutations` in the render root, and `causes`: the ids of the update requests it answers, empty when a property change caused it. An update with no DOM mutations re-rendered without changing anything. |
| `router` | `router write`, `router onRoute`, `router sync`, `router register` | `step` and its details: `mode` (`push` or `replace`), `trigger`, `outcome` or `store`. Navigation guards get an async `router guards` span with their `outcome`. |

A trace holds names, counts and timings only, never action arguments, return values, messages, store state or URLs. Names come from `constructor.name` and from the names of your selector and effect functions, so trace a build that keeps them: a minifier that renames classes renames them in the trace too.

`startTrace()` adds a `picosm trace start` performance mark, and `otherData.startTime` is that mark's `startTime`. Event times (`ts`, `dur`) are microseconds on the `performance.now()` clock, so you can line the trace up with a browser trace recorded at the same time. Browsers round `performance.now()`, so a short span can show a duration of 0.

While no trace is recording, each instrumented step only checks whether one is. While recording, every Lit update observes its render root with a `MutationObserver` to count its DOM mutations. `startTrace({ maxEvents })` limits the recorded events, 100,000 by default, and `otherData.droppedEventCount` counts the events past the limit. `startTrace()` throws while a trace is recording, and `stopTrace()` throws when none is.
