# Performance tracing

`startTrace()` records which store changes ask Lit views to update, and what each update cost, until `stopTrace()` returns the trace. It covers views made with `makeLitObserver`. The trace uses the Chrome trace event format, so [Perfetto](https://ui.perfetto.dev) and the Chrome DevTools Performance panel open it as a JSON file.

```javascript
import { startTrace, stopTrace } from 'picosm';

startTrace();
// … use the app …
const trace = stopTrace();
console.table(trace.otherData.views); // updates, updatesPerSecond and totalMs per view
// In the DevTools console, copy(JSON.stringify(trace)) puts it on the clipboard
```

Every span has a numeric `args.id`, and `args.kind` says what it records:

| `kind` | Span name | Details in `args` |
|---|---|---|
| `view-request` | `<cart-view> update requested` | An observed store changed and the view called `requestUpdate`: `view`, `property`, `store` (`Cart#1`, numbering instances of a class in order of appearance) and `throttleMs`, 0 for a property without `throttle` |
| `view-update` | `<cart-view> update` | Lit's render and DOM commit: `firstUpdate`, and `causes`, the ids of the requests it answers, empty when a property change caused it |

`otherData.views` sums up the updates of each view tag name, the views with the most time spent first: `updates` counts every update of its elements, first updates included, `updatesPerSecond` divides that count by the trace's duration, and `totalMs` adds up the updates' durations. A trace that lasted 0 ms on the browser's rounded clock has an `updatesPerSecond` of `null`.

A trace holds names, counts and timings only, never store values. Store names come from `constructor.name`, so trace a build that keeps class names: a minifier that renames classes renames them in the trace too.

`startTrace()` adds a `picosm trace start` performance mark, and `otherData.startTime` is that mark's `startTime`. Event times (`ts`, `dur`) are microseconds on the `performance.now()` clock, so you can line the trace up with a browser trace recorded at the same time. Browsers round `performance.now()`, so a short span can show a duration of 0.

While no trace is recording, a view only checks whether one is. `startTrace({ maxEvents })` limits the recorded events, 100,000 by default, and `otherData.droppedEventCount` counts the events past the limit; `otherData.views` still counts their updates. `startTrace()` throws while a trace is recording, and `stopTrace()` throws when none is.
