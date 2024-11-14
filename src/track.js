export function track(target, source) {
  if (!target.__observers || !source?.__observers) return;
  const disposer = source.__observe(() => {
    target.__resetComputedProperties();
    target.__notifyListeners();
  });
  target.__dependencies.set(source, disposer);
  target.__resetComputedProperties();
  target.__notifyListeners();
}

export function untrack(target, source) {
  if (!target.__observers || !source?.__observers) return;
  const disposer = target.__dependencies.get(source);
  if (disposer) {
    target.__dependencies.delete(source);
    disposer();
    target.__resetComputedProperties();
    target.__notifyListeners();
  }
}
