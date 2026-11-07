/**
 * Which page is on screen, in a few words, for test reports ("customer · card", "tab · messages").
 * Screens set it as they show; the report button reads it when tapped.
 */
let page = '';
let layer = '';
export const setPage = (name: string) => {
  page = name;
};
/** A page opened over the screen (a top tab, a chat); '' when it closes. */
export const setLayer = (name: string) => {
  layer = name;
};
export const whereNow = () => [page, layer].filter(Boolean).join(' › ');
