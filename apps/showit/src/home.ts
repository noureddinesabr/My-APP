/** The X logo: "go to the main page" for whichever side is showing (progress is kept). */
const listeners = new Set<() => void>();
export function goHome() {
  listeners.forEach((l) => l());
}
export function onHome(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
