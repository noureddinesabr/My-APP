import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { useCityName } from '@/components/city-picker';
import { formatMoney } from '@/components/money';
import { ProgressSteps } from '@/components/progress-steps';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { useRequestDraft } from '@/state/request-draft';
import { Radius, Spacing, useColors } from '@/theme';

/** Sign-up comes only after the client has built a request and seen its estimate. */
export default function SignUp() {
  const { t } = useTranslation();
  const colors = useColors();
  const cityName = useCityName();
  const { draft } = useRequestDraft();
  const [phone, setPhone] = useState('');

  const progressLabels = [
    t('request.progressAccount'),
    t('request.progressRoute'),
    t('request.progressLoad'),
    t('request.progressVehicle'),
    t('request.progressPrice'),
  ];

  const sendCode = () => {
    const message = t('signup.soon');
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert(message);
  };

  return (
    <Screen footer={<Button title={t('signup.cta')} variant="accent" icon="chatbubble-ellipses-outline" onPress={sendCode} />}>
      <IconButton label={t('common.back')} icon={<ForwardChevron color={colors.text} flip />} onPress={() => router.back()} />

      <ProgressSteps labels={progressLabels} completed={4} />

      <Text variant="title">{t('signup.title')}</Text>
      <Text muted>{t('signup.body')}</Text>

      <Card style={{ borderWidth: 1.5, borderColor: colors.success }}>
        <View style={styles.savedRow}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text variant="caption" color={colors.success}>
            {t('signup.saved')}
          </Text>
        </View>
        <Text variant="label">
          {draft.fromCity === draft.toCity
            ? t('request.sameCity', { city: cityName(draft.fromCity) })
            : t('request.resumeBody', { from: cityName(draft.fromCity), to: cityName(draft.toCity) })}
        </Text>
        <Text muted>
          {t(`vehicle.${draft.vehicle}`)} · {formatMoney(t, draft.price)}
        </Text>
      </Card>

      <View style={{ gap: Spacing.sm }}>
        <Text variant="label">{t('signup.phone')}</Text>
        <View style={styles.phoneRow}>
          <View style={[styles.prefix, { backgroundColor: colors.surfaceMuted }]}>
            <Text variant="label">🇲🇦 +212</Text>
          </View>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="6 12 34 56 78"
            keyboardType="phone-pad"
            autoComplete="tel"
            style={{ flex: 1, textAlign: 'left', writingDirection: 'ltr' }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  phoneRow: { flexDirection: 'row', gap: Spacing.sm, direction: 'ltr' },
  prefix: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
});
