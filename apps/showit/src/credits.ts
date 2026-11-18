/**
 * Where the app's pictures come from (owner's round 18 Nov 2026: 3D vehicles and 3D load kinds).
 * Shown in Settings › Photo credits, as the licences ask.
 */
export type PhotoCredit = { vehicle: string; title: string; author: string; license: string; url: string };
export const PHOTO_CREDITS: PhotoCredit[] = [
  { vehicle: 'vehicles', title: 'Vehicles in 3D', author: 'Made for Xapp in Blender (scripts/render-vehicles.py)', license: 'Xapp', url: '' },
  { vehicle: 'kinds', title: 'Fluent Emoji 3D (the kinds of load)', author: 'Microsoft Corporation', license: 'MIT License', url: 'https://github.com/microsoft/fluentui-emoji' },
  { vehicle: 'camera', title: 'Example photo on the camera', author: 'Xapp design (owner’s Google Stitch export)', license: 'Xapp', url: '' },
];
