import { useTranslation } from 'react-i18next';

import { AccountMenu } from '@/components/account-menu';
import { PageHeader } from '@/components/ds';
import { Screen } from '@/components/ui';

/** Account tab (Doc 5 C25–C28): profile, saved places, history, preferences, help and legal. */
export default function Account() {
  const { t } = useTranslation();
  return (
    <Screen header={<PageHeader title={t('tabs.account')} />}>
      <AccountMenu
        items={[
          { icon: 'map-marker-star-outline', label: t('menu.savedPlaces'), href: '/profile' },
          { icon: 'history', label: t('menu.clientHistory'), href: '/history' },
        ]}
      />
    </Screen>
  );
}
