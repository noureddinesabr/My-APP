import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useQuery } from '@/backend';
import type { FreightRequest } from '@/backend/types';
import { useLocationLabel } from '@/components/location-label';
import { HomeHeader } from '@/components/home-header';
import { formatMoney } from '@/components/money';
import { Text } from '@/components/text';
import { Button, Card, ForwardChevron, Gradient, Screen } from '@/components/ui';
import { VEHICLE_TYPES } from '@/constants/vehicles';
import { useLanguage } from '@/i18n/language-provider';
import { useAccount } from '@/state/account';
import { useRequestDraft } from '@/state/request-draft';
import { Gradients, Radius, softShadow, Spacing, useColors } from '@/theme';

/** Progress of a saved draft: account type + furthest wizard step reached, out of 5. */
const draftPercent = (step: number) => Math.round(((step + 1) / 5) * 100);

export default function ClientHome() {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const { client } = useAccount();
  const requests = useQuery('requests', client ? [['clientId', client.id]] : null);
  const mine = [...(requests ?? [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const { rtl } = useLanguage();
  const { draft, hasDraft } = useRequestDraft();
  // Vehicles should drive in the reading direction.
  const flip = rtl ? { transform: [{ scaleX: -1 }] } : undefined;

  return (
    <Screen>
      <HomeHeader title={t('client.greeting')} subtitle={t('client.whereTo')} />

      {hasDraft && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/request')}
          style={[styles.resume, { backgroundColor: colors.surface, borderColor: colors.primary }, softShadow(colors.primary)]}>
          <View style={styles.resumeTop}>
            <View style={[styles.resumeIcon, { backgroundColor: colors.primarySoft }]}>
              <MaterialCommunityIcons name="progress-clock" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('request.resumeTitle')}</Text>
              <Text variant="caption" muted>
                {names.cityRoute(draft.from, draft.to)}
                {' · '}
                {formatMoney(t, draft.price)}
              </Text>
            </View>
            <ForwardChevron color={colors.primary} />
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
            <Gradient
              colors={Gradients.primary}
              style={{ ...styles.fill, width: `${draftPercent(draft.step)}%` }}
            />
          </View>
          <Text variant="caption" color={colors.primary}>
            {t('request.percentDone', { percent: draftPercent(draft.step) })}
          </Text>
        </Pressable>
      )}

      {mine.length > 0 && (
        <View style={{ gap: Spacing.sm }}>
          <Text variant="subtitle">{t('client.myRequests')}</Text>
          {mine.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </View>
      )}

      <Gradient colors={Gradients.primary} style={styles.hero}>
        <View style={styles.heroDecor} />
        <MaterialCommunityIcons name="truck-fast" size={40} color={colors.onPrimary} style={flip} />
        <Text variant="title" color={colors.onPrimary}>
          {t('request.newRequest')}
        </Text>
        <View style={styles.heroRoute}>
          <Ionicons name="location" size={16} color={colors.onPrimary} />
          <Text variant="caption" color={colors.onPrimary}>
            {names.label(draft.from)}
          </Text>
        </View>
        <View style={{ marginTop: Spacing.sm }}>
          <Button
            title={hasDraft ? t('request.resumeTitle') : t('client.postRequest')}
            variant="accent"
            icon="flash-outline"
            onPress={() => router.push('/request')}
          />
        </View>
        <Text variant="caption" color={colors.onPrimary} center style={{ opacity: 0.85 }}>
          {t('request.noAccountNeeded')}
        </Text>
      </Gradient>

      <Text variant="subtitle">{t('client.vehicles')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicles}>
        {VEHICLE_TYPES.map((vehicle) => (
          <View key={vehicle.id} style={[styles.vehicle, { backgroundColor: colors.surface }, softShadow(colors.shadow, 0.5)]}>
            <View style={[styles.vehicleIcon, { backgroundColor: colors.primarySoft }]}>
              <MaterialCommunityIcons name={vehicle.icon} size={30} color={colors.primary} style={flip} />
            </View>
            <Text variant="caption" center numberOfLines={2}>
              {t(`vehicle.${vehicle.id}`)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Text variant="subtitle">{t('client.howItWorks')}</Text>
      <Card>
        {(['client.step1', 'client.step2', 'client.step3'] as const).map((key, index) => (
          <View key={key} style={styles.step}>
            <Gradient colors={Gradients.primary} style={styles.stepNumber}>
              <Text variant="label" color={colors.onPrimary}>
                {index + 1}
              </Text>
            </Gradient>
            <Text style={{ flex: 1 }}>{t(key)}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const STATUS_TONE = { open: 'primary', assigned: 'success', completed: 'muted', cancelled: 'accent' } as const;

function RequestRow({ request }: { request: FreightRequest }) {
  const { t } = useTranslation();
  const colors = useColors();
  const names = useLocationLabel();
  const tone = STATUS_TONE[request.status];
  const color = tone === 'muted' ? colors.textMuted : colors[tone];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/track/[id]', params: { id: request.id } })}
      style={[styles.requestRow, { backgroundColor: colors.surface }, softShadow(colors.shadow, 0.5)]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {names.cityRoute(request.from, request.to)}
        </Text>
        <Text variant="caption" color={color}>
          {t(`requestStatus.${request.status}`)} · {formatMoney(t, request.price)}
        </Text>
      </View>
      <ForwardChevron color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  resume: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.lg, gap: Spacing.sm },
  resumeTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  resumeIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.sm, overflow: 'hidden' },
  heroDecor: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -80,
    end: -60,
  },
  heroRoute: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, opacity: 0.9 },
  vehicles: { gap: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: 2 },
  vehicle: { width: 104, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', gap: Spacing.sm },
  vehicleIcon: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
