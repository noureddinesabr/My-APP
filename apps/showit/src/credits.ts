/**
 * Where the app's pictures come from (owner's round 18 Nov 2026: 3D vehicles and 3D load kinds).
 * Shown in Settings › Photo credits, as the licences ask.
 */
export type PhotoCredit = { vehicle: string; title: string; author: string; license: string; url: string };
export const PHOTO_CREDITS: PhotoCredit[] = [
  { vehicle: 'vehicles', title: 'Vehicles in 3D', author: 'Made for Xapp in Blender (scripts/render-vehicles.py)', license: 'Xapp', url: '' },
  { vehicle: 'kinds', title: 'Fluent Emoji 3D (the kinds of load)', author: 'Microsoft Corporation', license: 'MIT License', url: 'https://github.com/microsoft/fluentui-emoji' },
  { vehicle: 'places', title: 'Neighbourhood names (street or neighbourhood search)', author: '© OpenStreetMap contributors', license: 'ODbL 1.0', url: 'https://www.openstreetmap.org/copyright' },
  { vehicle: 'places', title: 'Towns of Morocco', author: 'GeoNames', license: 'CC BY 4.0', url: 'https://www.geonames.org/' },
  { vehicle: 'camera', title: 'Camera example: packing up', author: 'Joanna Bourne (Flickr)', license: 'CC BY 2.0', url: 'https://www.flickr.com/photos/66992990@N00/6532911971' },
  { vehicle: 'camera', title: 'Camera example: Moving today', author: 'chrisweible (Flickr)', license: 'CC BY 2.0', url: 'https://www.flickr.com/photos/26546594@N04/5560522359' },
  { vehicle: 'camera', title: 'Camera example: Piling boxes again', author: 'lejoe (Flickr)', license: 'CC BY 2.0', url: 'https://www.flickr.com/photos/21458229@N00/2965482260' },
  { vehicle: 'camera', title: 'Camera example: living room sofa (Mill Rose Inn)', author: 'Wonderlane (Flickr)', license: 'CC BY 2.0', url: 'https://www.flickr.com/photos/71401718@N00/2982196181' },
  { vehicle: 'camera', title: 'Camera example: Close up of stacked cement bags', author: 'Ivan Radic (Flickr)', license: 'CC BY 2.0', url: 'https://www.flickr.com/photos/26344495@N05/50550618521' },
  { vehicle: 'camera', title: 'Camera example: Dining Table', author: 'Matt Bango (StockSnap)', license: 'CC0 1.0', url: 'https://stocksnap.io/photo/dining-table-LTCQNB2L7A' },
];
