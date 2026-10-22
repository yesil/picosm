import { observe } from './makeObservable.js';
import { assertObservable } from './internal.js';

// source -> Map(target -> number of active track() calls): the direction notifications flow
const forwards = new WeakMap();

function forwardsTo(from, to) {
  const pending = [from];
  const visited = new Set();
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === to) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of forwards.get(node)?.keys() ?? []) pending.push(next);
  }
  return false;
}

export function track(target, source) {
  assertObservable(target, 'track() target');
  assertObservable(source, 'track() source');
  if (forwardsTo(target, source)) {
    throw new Error(
      'picosm: track(target, source) would create a notification cycle, target already forwards its notifications to source',
    );
  }

  const stopObserving = observe(source, () => {
    target.__resetComputedProperties();
    target.__notifyObservers();
  });
  const targets = forwards.get(source) ?? new Map();
  forwards.set(source, targets);
  targets.set(target, (targets.get(target) ?? 0) + 1);

  target.__resetComputedProperties();
  target.__notifyObservers();

  let tracking = true;
  return () => {
    if (!tracking) return;
    tracking = false;
    stopObserving();
    const count = targets.get(target) - 1;
    if (count === 0) targets.delete(target);
    else targets.set(target, count);
  };
}
