import { useTranslation } from 'react-i18next';

import { getCity } from '@/constants/cities';
import { getPlace, nearestPlace, placeLabel, type Location } from '@/constants/places';
import { useLanguage } from '@/i18n/language-provider';

/** Readable names for locations in the app language. */
export function useLocationLabel() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const label = (location: Location) => {
    if (location.label) return location.label;
    const place = getPlace(location.placeId);
    if (place) return placeLabel(place, language);
    const near = placeLabel(nearestPlace(location), language);
    return t(location.source === 'gps' ? 'place.myLocationNear' : 'place.pointNear', { place: near });
  };

  /** "Maarif, Casablanca → Agdal, Rabat", or "Move inside Casablanca" when both are the city itself. */
  const route = (from: Location, to: Location) => {
    if (from.placeId && from.placeId === to.placeId && from.placeId === from.cityId) {
      return t('request.sameCity', { city: getCity(from.cityId).name[language] });
    }
    return t('request.resumeBody', { from: label(from), to: label(to) });
  };

  /** City names only, for compact cards. */
  const cityRoute = (from: Location, to: Location) =>
    from.cityId === to.cityId
      ? t('request.sameCity', { city: getCity(from.cityId).name[language] })
      : t('request.resumeBody', { from: getCity(from.cityId).name[language], to: getCity(to.cityId).name[language] });

  return { label, route, cityRoute };
}
