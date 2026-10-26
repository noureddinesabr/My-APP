import type { TFunction } from 'i18next';

/** "1 250 DH" / "1 250 درهم". Western digits, as used across Morocco. */
export function formatMoney(t: TFunction, amount: number) {
  return t('money', { amount: Math.round(amount).toLocaleString('fr-FR') });
}

/** Share of `part` in `total` as a whole percent, at least 1 when part > 0. */
export function percentOf(part: number, total: number) {
  if (part <= 0 || total <= 0) return 0;
  return Math.max(1, Math.round((part / total) * 100));
}

/** The currency word alone ("DH" / "درهم"), for inputs that show the number separately. */
export function currencyUnit(t: TFunction) {
  return t('money', { amount: '' }).trim();
}
