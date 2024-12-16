export function track(target, source) {
  const disposer = source.__observe?.(() => {
    target.__resetComputedProperties();
    target.__notifyObservers();
  });
  target.__resetComputedProperties();
  target.__notifyObservers();
  return disposer;
}
