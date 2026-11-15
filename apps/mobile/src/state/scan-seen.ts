/** The photo-scan screen opens first, once per app start, until the person moves on. */
let seen = false;
export const scanSeen = () => seen;
export const markScanSeen = () => {
  seen = true;
};
