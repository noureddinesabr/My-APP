import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { CallScreen } from '@/components/rules/call';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { play } from '@/lib/sounds';
import { Radius, Spacing, useColors } from '@/theme';

/** Empty in the test version: the support number comes at launch, and the sheet says so. */
export const SUPPORT_PHONE = '';

const CLIENT_TOPICS = ['handover', 'late', 'change', 'pay', 'damage'];
const DRIVER_TOPICS = ['handover', 'price', 'helpers', 'cancel', 'pay'];

/** "Need help? Contact Xapp": on the customer's trip page and the driver's job page. */
export function HelpButton({ side }: { side: 'client' | 'driver' }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale
        accessibilityRole="button"
        scaleTo={0.97}
        onPress={() => {
          play('tap');
          setOpen(true);
        }}
        style={[styles.button, { borderColor: colors.rim }]}>
        <Ionicons name="help-buoy-outline" size={20} color={colors.primary} />
        <Text variant="label" color={colors.primary}>
          {t('help.btn')}
        </Text>
      </PressableScale>
      <HelpSheet side={side} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function HelpSheet({ side, visible, onClose }: { side: 'client' | 'driver'; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [calling, setCalling] = useState(false);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const topics = side === 'client' ? CLIENT_TOPICS : DRIVER_TOPICS;
  return (
    <>
      <Sheet visible={visible} onClose={onClose} drag="handle">
        <ScrollView contentContainerStyle={{ gap: Spacing.sm }}>
          <Text variant="title" center>
            {t('help.title')}
          </Text>
          <Text muted center>
            {t('help.intro')}
          </Text>
          <View style={styles.row}>
            <Contact
              icon="chatbubbles"
              label={t('help.write')}
              onPress={() => {
                onClose();
                router.push('/support');
              }}
            />
            <Contact
              icon="call"
              label={t('help.callApp')}
              onPress={() => {
                onClose();
                setCalling(true);
              }}
            />
          </View>
          {!SUPPORT_PHONE && (
            <Text variant="caption" muted center>
              {t('help.testNote')}
            </Text>
          )}
          <Text variant="label">{t('help.topics')}</Text>
          {topics.map((topic) => {
            const open = openTopic === topic;
            return (
              <PressableScale
                key={topic}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                scaleTo={0.99}
                onPress={() => {
                  play('pop');
                  setOpenTopic(open ? null : topic);
                }}
                style={[styles.topic, { backgroundColor: colors.surface, borderColor: open ? colors.primary : colors.rim }]}>
                <View style={styles.topicHead}>
                  <Text variant="label" style={{ flex: 1 }}>
                    {t(`help.q_${side}_${topic}`)}
                  </Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </View>
                {open && <Text muted>{t(`help.a_${side}_${topic}`)}</Text>}
              </PressableScale>
            );
          })}
        </ScrollView>
      </Sheet>
      <CallScreen person={calling ? { name: t('help.xapp') } : null} live={false} onClose={() => setCalling(false)} onChat={() => router.push('/support')} />
    </>
  );
}

function Contact({ icon, label, onPress }: { icon: 'chatbubbles' | 'call'; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.97}
      onPress={() => {
        play('tap');
        onPress();
      }}
      style={[styles.contact, { backgroundColor: icon === 'call' ? colors.successFill : colors.primaryFill }]}>
      <Ionicons name={icon} size={20} color={colors.onPrimary} />
      <Text variant="label" color={colors.onPrimary} center style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 48, borderRadius: Radius.pill, borderWidth: 1.5 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  contact: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, minHeight: 52, paddingHorizontal: Spacing.sm, borderRadius: Radius.pill },
  topic: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5 },
  topicHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
