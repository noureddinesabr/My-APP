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

/** The trip (request id) whose page or conversation is on screen, so its news needs no banner. */
let trip = '';
let chatTrip = '';
export const setTripOnScreen = (id: string) => {
  trip = id;
};
export const setChatOnScreen = (id: string) => {
  chatTrip = id;
};
export const tripOnScreen = (id?: string) => !!id && (chatTrip === id || (!layer && trip === id));
