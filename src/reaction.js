import { observe } from './makeObservable.js';
import { assertObservable } from './internal.js';
import { beginSpan, endReaction } from './trace.js';

export function reaction(targetOrTargets, callback, execute, timeout) {
  const targets = Array.isArray(targetOrTargets)
    ? targetOrTargets
    : [targetOrTargets];
  targets.forEach((t) => assertObservable(t, 'reaction()'));

  const select = () => {
    const props =
      targets.length === 1 ? callback(targets[0]) : callback(...targets);
    if (!Array.isArray(props)) {
      throw new TypeError('picosm: reaction() selector must return an array');
    }
    return props;
  };

  // Baseline: the effect runs only when the selected values change after this point
  let lastProps = select();

  const runner = () => {
    const span = beginSpan();
    const props = select();
    if (props.length === 0) {
      if (span !== null)
        endReaction(span, targets, callback, execute, 'skipped');
      return;
    }
    const unchanged =
      props.length === lastProps.length &&
      props.every((value, i) => Object.is(value, lastProps[i]));
    if (unchanged) {
      if (span !== null)
        endReaction(span, targets, callback, execute, 'unchanged');
      return;
    }
    lastProps = props;
    execute(...props);
    if (span !== null) endReaction(span, targets, callback, execute, 'changed');
  };

  const disposers = targets.map((t) => observe(t, runner, timeout));
  return () => disposers.forEach((d) => d());
}
