import { observe } from './makeObservable.js';

export function reaction(target, callback, execute, timeout) {
  let lastProps = [];
  return observe(
    target,
    async () => {
      const props = callback(target);
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
    },
    timeout,
  );
}
