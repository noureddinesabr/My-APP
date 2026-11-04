import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AccountMenu } from '@/components/account-menu';
import { useDriverInvoices } from '@/components/driver/use-invoices';
import { useDriverRecord } from '@/components/driver/use-driver-record';
import { ListRow, PageHeader, StatusBadge } from '@/components/ds';
import { Screen } from '@/components/ui';
import { useDriver, verificationSteps } from '@/state/driver';

/**
 * Profile tab (Doc 5 D41–D47): verification, vehicles, documents and their expiry, ratings,
 * messages, account restriction status, then the shared account items (language, settings,
 * help, switch role, sign out).
 */
export default function DriverProfileTab() {
  const { t } = useTranslation();
  const { profile } = useDriver();
  const { account, record } = useDriverRecord();
  const { paused } = useDriverInvoices(account);
  const steps = verificationSteps(profile);
  const done = steps.filter((s) => s.done).length;
  const verification = record?.verification === 'suspended' ? 'suspended' : profile.status === 'approved' ? 'verified' : 'pending';
  return (
    <Screen header={<PageHeader title={t('tabs.profile')} />}>
      <AccountMenu
        items={[
          { icon: 'car-outline', label: t('dprofile.vehicles'), href: '/vehicles' },
          { icon: 'file-document-multiple-outline', label: t('dprofile.documents'), value: t('dprofile.docsDone', { done, total: steps.length }), href: '/driver-documents' },
          { icon: 'star-outline', label: t('dprofile.ratings'), value: record ? `★ ${record.rating.toFixed(1)} · ${record.ratingCount}` : undefined, href: '/profile' },
          { icon: 'message-outline', label: t('tabs.messages'), href: '/conversations' },
        ]}
        extra={
          <>
            <ListRow icon="shield-check-outline" title={t('dprofile.verification')} right={<StatusBadge status={verification} label={t(`dprofile.ver_${verification}`)} />} onPress={() => router.push('/driver-documents')} />
            <ListRow
              icon={paused ? 'pause-circle-outline' : 'check-circle-outline'}
              title={t('dprofile.restriction')}
              subtitle={paused ? t('invoice.pausedShort') : t('dprofile.noRestriction')}
              right={<StatusBadge status={paused ? 'overdue' : 'verified'} label={paused ? t('dprofile.restricted') : t('dprofile.allowed')} />}
              onPress={() => router.push('/invoices')}
            />
          </>
        }
      />
    </Screen>
  );
}
