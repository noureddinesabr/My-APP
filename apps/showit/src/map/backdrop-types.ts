/** The clear strip of map under the top buttons, in screen points. */
export type MapWindow = { top: number; height: number };

export type BackdropProps = {
  window: MapWindow;
  /** Veil over the map below the strip (behind the scrolling panel), warm white or ink. */
  veil: string;
};
