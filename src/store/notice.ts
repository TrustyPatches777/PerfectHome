/** A way for the stores to tell the person something without importing the UI store (which would be a cycle). */
let notifier: (message: string) => void = () => undefined;
export const setNotifier = (fn: (message: string) => void) => {
  notifier = fn;
};
export const notify = (message: string) => notifier(message);
