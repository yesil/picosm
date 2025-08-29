import { observe } from './makeObservable.js';

export function reaction(targetOrTargets, callback, execute, timeout) {
  let lastProps = [];
  const targets = Array.isArray(targetOrTargets)
    ? targetOrTargets
    : [targetOrTargets];

  const runner = () => {
    const props =
      targets.length === 1 ? callback(targets[0]) : callback(...targets);
    if (lastProps === props) return;
    let shouldExecute = false;
    for (let i = 0; i < props.length; i++) {
      if (lastProps[i] !== props[i]) {
        shouldExecute = true;
        break;
      }
    }
    if (shouldExecute) {
      lastProps = props;
      execute(...props);
    }
  };

  const disposers = targets.map((t) => observe(t, runner, timeout));
  return () => disposers.forEach((d) => d());
}
