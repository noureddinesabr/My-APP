import { useTranslation } from 'react-i18next';

import { getCity } from '@/constants/cities';
import { getPlace, nearestPlace, placeLabel, type Location } from '@/constants/places';
import { useLanguage } from '@/i18n/language-provider';

/**
 * Wraps a place name put inside a sentence so it keeps its own reading direction: a Latin
 * name inside an Arabic sentence ("موقعي، قرب Ad Darwa") no longer reorders the words around it.
 */
const isolate = (text: string) => `\u2068${text}\u2069`;

/** Readable names for locations in the app language. */
export function useLocationLabel() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const label = (location: Location) => {
    if (location.label) return location.label;
    const place = getPlace(location.placeId);
    if (place) return placeLabel(place, language);
    const near = placeLabel(nearestPlace(location), language);
    return t(location.source === 'gps' ? 'place.myLocationNear' : 'place.pointNear', { place: isolate(near) });
  };

  /** "Maarif, Casablanca → Agdal, Rabat", or "Move inside Casablanca" when both are the city itself. */
  const route = (from: Location, to: Location) => {
    if (from.placeId && from.placeId === to.placeId && from.placeId === from.cityId) {
      return t('request.sameCity', { city: getCity(from.cityId).name[language] });
    }
    return t('request.resumeBody', { from: isolate(label(from)), to: isolate(label(to)) });
  };

  /** City names only, for compact cards. */
  const cityRoute = (from: Location, to: Location) =>
    from.cityId === to.cityId
      ? t('request.sameCity', { city: getCity(from.cityId).name[language] })
      : t('request.resumeBody', { from: getCity(from.cityId).name[language], to: getCity(to.cityId).name[language] });

  /** The place's own name without its city ("Maarif"), for routes inside one city. */
  const short = (location: Location) => {
    const place = getPlace(location.placeId);
    if (place) return place.name[language];
    return label(location);
  };

  /**
   * The shortest route that still tells trips apart: "Maarif → Racine" inside one city,
   * "Casablanca → Rabat" between cities, "Move inside Casablanca" when nothing more is known.
   */
  const shortRoute = (from: Location, to: Location) => {
    if (from.cityId !== to.cityId) return cityRoute(from, to);
    const a = short(from);
    const b = short(to);
    if (a === b) return t('request.sameCity', { city: getCity(from.cityId).name[language] });
    return t('request.resumeBody', { from: isolate(a), to: isolate(b) });
  };

  return { label, route, cityRoute, shortRoute };
}
