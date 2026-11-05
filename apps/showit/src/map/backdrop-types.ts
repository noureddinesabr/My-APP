/** The clear strip of map under the top buttons, in screen points. */
export type MapWindow = { top: number; height: number };

export type BackdropProps = {
  window: MapWindow;
  /** Veil over the rest of the map so text on it stays readable (warm white or ink). */
  veil: string;
};
