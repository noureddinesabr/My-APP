import { useTranslation } from 'react-i18next';

import type { Message } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { formatMoney } from '@/components/money';

/** A cancel reason: one of the listed reasons (a key), or what the person wrote. */
export function useReasonText() {
  const { t } = useTranslation();
  return (reason: string | null | undefined) => (!reason ? '' : /^(cr|dr)_\w+$/.test(reason) ? t(`cancel.${reason}`) : reason);
}

/** Readable text for a trip event or an automatic message in the chat (same story on both sides, in the reader's language). */
export function useEventText() {
  const { t } = useTranslation();
  const dates = useDateFormat();
  const reasonText = useReasonText();
  return (message: Message) => {
    const params = message.params ?? {};
    const values: Record<string, string | number> = { ...params };
    if (typeof params.at === 'string') values.at = dates.pickupAt(params.at);
    if (typeof params.price === 'number') values.price = formatMoney(t, params.price);
    if (typeof params.old === 'number') values.old = formatMoney(t, params.old);
    // Some texts name the driver as {{name}}, others as {{driver}}.
    if (typeof params.driver === 'string' && values.name === undefined) values.name = params.driver;
    if (typeof params.reason === 'string') values.reason = reasonText(params.reason);
    if (message.auto) return t(`auto.${message.auto}`, values);
    if (message.kind !== 'event' || !message.event) return message.text;
    if (message.event === 'arrivedPickup' && params.minutes) return t('event.arrivedPickupLate', values);
    if ((message.event === 'cancelledByClient' || message.event === 'cancelledByDriver') && params.reason)
      return t(`event.${message.event}Reason`, values);
    if (message.event === 'helpersFewer' && params.n === 1) return t('event.helpersFewer1');
    return t(`event.${message.event}`, values);
  };
}
