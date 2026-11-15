import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { Button } from '@/components/ui';
import { play } from '@/lib/sounds';
import { Radius, Spacing, useColors } from '@/theme';

const CLIENT = ['cr_plans', 'cr_found', 'cr_late', 'cr_wrong', 'cr_other'];
const DRIVER = ['dr_vehicle', 'dr_emergency', 'dr_reach', 'dr_load', 'dr_other'];

/**
 * Cancelling with a reason, gently (Xapp Simple): the customer cancels for free before the
 * driver sets off; the driver's request goes back to other drivers and the customer is told.
 * The reason goes to the chat. A preset reason (helpers who didn't come, no deal on the price)
 * is listed first and picked, and never counts against anyone.
 */
export function CancelSheet({
  visible,
  side,
  body,
  preset,
  confirm,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  side: 'client' | 'driver';
  /** What cancelling means now, in plain words. */
  body: string;
  preset?: string;
  confirm: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const base = side === 'client' ? CLIENT : DRIVER;
  const reasons = preset && !base.includes(preset) ? [preset, ...base] : base;
  const [picked, setPicked] = useState<string | null>(preset ?? null);
  const [other, setOther] = useState('');
  const [shownPreset, setShownPreset] = useState(preset);
  if (shownPreset !== preset) {
    setShownPreset(preset);
    setPicked(preset ?? null);
  }
  const isOther = picked === 'cr_other' || picked === 'dr_other';
  const ready = !!picked && (!isOther || !!other.trim());

  return (
    <Sheet visible={visible} onClose={onClose} drag="handle">
      <ScrollView contentContainerStyle={{ gap: Spacing.sm }} keyboardShouldPersistTaps="handled">
        <Text variant="title" center>
          {side === 'client' ? t('cancel.tripTitle') : t('cancel.jobTitle')}
        </Text>
        <Text muted center>
          {body}
        </Text>
        <View style={{ gap: Spacing.xs }}>
          {reasons.map((reason) => {
            const on = picked === reason;
            return (
              <PressableScale
                key={reason}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                scaleTo={0.98}
                onPress={() => {
                  play('pop');
                  setPicked(reason);
                }}
                style={[styles.reason, { backgroundColor: on ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.rim }]}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.textMuted} />
                <Text variant="label" style={{ flex: 1 }}>
                  {t(`cancel.${reason}`)}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {isOther && <TextInput value={other} onChangeText={setOther} placeholder={t('cancel.otherHint')} multiline style={{ minHeight: 72 }} />}
        <Button title={t('cancel.keep')} variant="accent" onPress={onClose} />
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          feedback="warning"
          onPress={() => onConfirm(isOther ? other.trim() : picked!)}
          style={[styles.destructive, { borderColor: colors.accent, opacity: ready ? 1 : 0.45 }]}>
          <Text variant="label" color={colors.accent}>
            {confirm}
          </Text>
        </PressableScale>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reason: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 52, paddingHorizontal: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5 },
  destructive: { minHeight: 52, borderRadius: Radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
