/**
 * Tiny event channel between the API client and the app shell.
 * When any API call answers 402 SUBSCRIPTION_REQUIRED the client calls `emitPaywall()` and the shell
 * shows the "buy a plan" popup, wherever the student was.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onPaywall(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitPaywall(): void {
  listeners.forEach((fn) => fn());
}
