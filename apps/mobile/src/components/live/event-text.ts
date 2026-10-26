import { useTranslation } from 'react-i18next';

import type { Message } from '@/backend/types';
import { useDateFormat } from '@/components/date-format';
import { formatMoney } from '@/components/money';

/** Readable text for a trip event written into the chat (same story on both sides). */
export function useEventText() {
  const { t } = useTranslation();
  const dates = useDateFormat();
  return (message: Message) => {
    if (message.kind !== 'event' || !message.event) return message.text;
    const params = message.params ?? {};
    const values: Record<string, string | number> = { ...params };
    if (typeof params.at === 'string') values.at = dates.pickupAt(params.at);
    if (typeof params.price === 'number') values.price = formatMoney(t, params.price);
    if (message.event === 'arrivedPickup' && params.minutes) return t('event.arrivedPickupLate', values);
    return t(`event.${message.event}`, values);
  };
}
