import { observe, observeSlow } from './makeObservable.js';

export function reaction(target, callback, execute) {
  setTimeout(() => {
    let lastProps = [];
    return observe(target, async () => {
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
    });
  }, 0);
}

export function reactionSlow(target, callback, execute, timeout) {
  setTimeout(() => {
    let lastProps = [];
    return observeSlow(timeout)(target, async () => {
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
    });
  }, 0);
}
