export function reaction(target, callback, execute) {
  let lastProps = [];
  return target.__observe(async () => {
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
}
