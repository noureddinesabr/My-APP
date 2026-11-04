import { useTranslation } from 'react-i18next';

import { Conversations } from '@/components/conversations';
import { PageHeader } from '@/components/ds';
import { Screen } from '@/components/ui';

/** Messages tab (Doc 5 C23): one conversation per booking, newest first. */
export default function Messages() {
  const { t } = useTranslation();
  return (
    <Screen header={<PageHeader title={t('tabs.messages')} />}>
      <Conversations side="client" />
    </Screen>
  );
}
