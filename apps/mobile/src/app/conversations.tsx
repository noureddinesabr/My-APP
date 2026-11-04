import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Conversations } from '@/components/conversations';
import { PageHeader } from '@/components/ds';
import { Screen } from '@/components/ui';

/** The driver's messages (from the Profile tab and job screens): one conversation per job. */
export default function DriverConversations() {
  const { t } = useTranslation();
  return (
    <Screen header={<PageHeader title={t('tabs.messages')} onBack={() => router.back()} />}>
      <Conversations side="driver" />
    </Screen>
  );
}
