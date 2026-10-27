import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ensureClient, publishRequest } from '@/backend/actions';
import { useStore } from '@/backend';
import { useLocationLabel } from '@/components/location-label';
import { formatMoney } from '@/components/money';
import { ProgressSteps } from '@/components/progress-steps';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button, Card, ForwardChevron, IconButton, Screen } from '@/components/ui';
import { play } from '@/lib/sounds';
import { useAccount } from '@/state/account';
import { useRequestDraft } from '@/state/request-draft';
import { Radius, Spacing, useColors } from '@/theme';

/** Code accepted in test mode; real SMS codes come with the hosted backend. */
const TEST_CODE = '1234';

/**
 * Test sign-in by phone. For a client coming from the request wizard, signing in
 * sends the saved request right away (sign-up only after the estimate was shown).
 */
export default function Login() {
  const { role = 'client', next } = useLocalSearchParams<{ role?: 'client' | 'driver'; next?: 'publish' }>();
  const { t } = useTranslation();
  const colors = useColors();
  const store = useStore();
  const names = useLocationLabel();
  const { signIn, client, driver } = useAccount();
  const { draft, discard } = useRequestDraft();
  const existing = role === 'client' ? client : driver;
  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone.replace(/^\+212\s?/, '') ?? '');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publishing = role === 'client' && next === 'publish';

  const phoneValid = phone.replace(/\D/g, '').length >= 9 && name.trim().length >= 2;

  const verify = async () => {
    if (code !== TEST_CODE) {
      play('error');
      setError(t('login.wrongCode'));
      return;
    }
    setBusy(true);
    try {
      const account = signIn(role, name, `+212 ${phone.trim()}`);
      if (role === 'client') {
        await ensureClient(store, account);
        if (publishing) {
          const id = await publishRequest(store, account, draft);
          play('send');
          discard();
          router.dismissAll();
          router.replace({ pathname: '/track/[id]', params: { id, sent: '1' } });
          return;
        }
      }
      play('success');
      router.back();
    } catch {
      play('error');
      setError(t('login.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        step === 'phone' ? (
          <Button title={t('login.sendCode')} disabled={!phoneValid} icon="chatbubble-ellipses-outline" onPress={() => setStep('code')} />
        ) : (
          <Button
            title={busy ? t('login.sending') : publishing ? t('login.verifyAndSend') : t('login.verify')}
            variant="accent"
            icon={publishing ? 'paper-plane-outline' : 'checkmark'}
            disabled={code.length !== 4 || busy}
            sound={null}
            onPress={verify}
          />
        )
      }
      header={
        <IconButton
          label={t('common.back')}
          icon={<ForwardChevron color={colors.text} flip />}
          onPress={() => (step === 'code' ? setStep('phone') : router.back())}
        />
      }>

      {publishing && (
        <ProgressSteps
          labels={[
            t('request.progressAccount'),
            t('request.progressRoute'),
            t('request.progressLoad'),
            t('request.progressVehicle'),
            t('request.progressPrice'),
          ]}
          completed={4}
        />
      )}

      <Text variant="title">{publishing ? t('signup.title') : t(role === 'driver' ? 'login.driverTitle' : 'login.title')}</Text>
      <Text muted>{publishing ? t('signup.body') : t('login.body')}</Text>

      {publishing && (
        <Card style={{ borderWidth: 1.5, borderColor: colors.success }}>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text variant="caption" color={colors.success}>
              {t('signup.saved')}
            </Text>
          </View>
          <Text variant="label">{names.route(draft.from, draft.to)}</Text>
          <Text muted>
            {t(`vehicle.${draft.vehicle}`)} · {formatMoney(t, draft.price)}
          </Text>
        </Card>
      )}

      {step === 'phone' ? (
        <View style={{ gap: Spacing.sm }}>
          <Text variant="label">{t('login.name')}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t('login.namePlaceholder')} autoComplete="name" />
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
      ) : (
        <View style={{ gap: Spacing.md }}>
          <Text variant="label">{t('login.codeSent', { phone: `+212 ${phone}` })}</Text>
          <TextInput
            autoFocus
            value={code}
            onChangeText={(value) => {
              setError(null);
              setCode(value.replace(/\D/g, '').slice(0, 4));
            }}
            keyboardType="number-pad"
            placeholder="• • • •"
            style={styles.code}
          />
          <View style={[styles.testNote, { backgroundColor: colors.accentSoft }]}>
            <MaterialCommunityIcons name="flask-outline" size={18} color={colors.accent} />
            <Text variant="caption" color={colors.accent} style={{ flex: 1 }}>
              {t('login.testCode', { code: TEST_CODE })}
            </Text>
          </View>
          {error && (
            <Text variant="caption" color={colors.accent}>
              {error}
            </Text>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  phoneRow: { flexDirection: 'row', gap: Spacing.sm, direction: 'ltr' },
  prefix: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  code: { fontSize: 28, letterSpacing: 12, textAlign: 'center', writingDirection: 'ltr', minHeight: 64 },
  testNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
});
