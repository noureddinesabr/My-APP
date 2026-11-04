import type { TFunction } from 'i18next';

export function formatWeight(t: TFunction, tons: number, known = true) {
  if (!known) return t('request.weightUnknown');
  return tons < 1 ? t('request.weightKg', { kg: tons * 1000 }) : t('request.weightValue', { tons });
}
