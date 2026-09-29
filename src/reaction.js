import { observe } from './makeObservable.js';
import { assertObservable } from './internal.js';

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
    const props = select();
    if (props.length === 0) return;
    const unchanged =
      props.length === lastProps.length &&
      props.every((value, i) => Object.is(value, lastProps[i]));
    if (unchanged) return;
    lastProps = props;
    execute(...props);
  };

  const disposers = targets.map((t) => observe(t, runner, timeout));
  return () => disposers.forEach((d) => d());
}
