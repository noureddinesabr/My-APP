import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { phoneDigits } from '@/components/contact-buttons';
import { callUrl, ExternalLink } from '@/components/external-link';
import { Avatar } from '@/components/live/parts';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Text } from '@/components/text';
import { play } from '@/lib/sounds';
import { Radius, Spacing, useColors } from '@/theme';

export type CallPerson = {
  name: string;
  photo?: string | null;
  /** Dialled only when the in-app call isn't answered during a live trip; never written on screen. */
  phone?: string | null;
};

/**
 * Calls go inside the app first (over the internet, nobody sees a number). In this test version
 * there's no server to connect two phones yet, and the call screen says so plainly: it never
 * pretends to ring. After 6 seconds without an answer it offers a normal phone call, only
 * during a live trip (Xapp Simple, round 7).
 */
export function CallButton({ person, live, onChat, size = 48 }: { person: CallPerson; live: boolean; onChat?: () => void; size?: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('call.btn', { name: person.name })}
        scaleTo={0.92}
        onPress={() => {
          play('tap');
          setOpen(true);
        }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.successFill, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="call" size={Math.round(size * 0.44)} color={colors.onPrimary} />
      </PressableScale>
      <CallScreen person={open ? person : null} live={live} onClose={() => setOpen(false)} onChat={onChat} />
    </>
  );
}

/** A wide "Call" button with the word, for the trip and job pages. */
export function CallRow({ person, live, onChat, unread = 0 }: { person: CallPerson; live: boolean; onChat?: () => void; unread?: number }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityRole="button"
        scaleTo={0.97}
        onPress={() => {
          play('tap');
          setOpen(true);
        }}
        style={[styles.action, { backgroundColor: colors.successFill }]}>
        <Ionicons name="call" size={20} color={colors.onPrimary} />
        <Text variant="label" color={colors.onPrimary}>
          {t('call.short')}
        </Text>
      </PressableScale>
      {onChat && (
        <PressableScale
          accessibilityRole="button"
          scaleTo={0.97}
          onPress={() => {
            play('tap');
            onChat();
          }}
          style={[styles.action, { backgroundColor: colors.control }]}>
          <Ionicons name="chatbubbles" size={20} color={colors.primary} />
          <Text variant="label" color={colors.onControl}>
            {t('chat.title')}
          </Text>
          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.accentFill, borderColor: colors.surface }]}>
              <Text variant="caption" color={colors.onPrimary} style={{ fontSize: 13, lineHeight: 18 }}>
                {unread > 9 ? '9+' : unread}
              </Text>
            </View>
          )}
        </PressableScale>
      )}
      <CallScreen person={open ? person : null} live={live} onClose={() => setOpen(false)} onChat={onChat} />
    </View>
  );
}

export function CallScreen({ person, live, onClose, onChat }: { person: CallPerson | null; live: boolean; onClose: () => void; onChat?: () => void }) {
  // Mounted fresh for each call, so mute / speaker / "no answer" start over.
  return person ? <Call person={person} live={live} onClose={onClose} onChat={onChat} /> : null;
}

function Call({ person, live, onClose, onChat }: { person: CallPerson; live: boolean; onClose: () => void; onChat?: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mute, setMute] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [noAnswer, setNoAnswer] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setNoAnswer(true), 6000);
    return () => clearTimeout(timer);
  }, []);
  const digits = person.phone ? phoneDigits(person.phone) : '';

  const round = (icon: keyof typeof Ionicons.glyphMap, label: string, on: boolean, press: () => void) => (
    <View style={{ alignItems: 'center', gap: Spacing.xs }}>
      <PressableScale
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel={label}
        scaleTo={0.92}
        onPress={() => {
          play('tap');
          press();
        }}
        style={[styles.round, { backgroundColor: on ? colors.primaryFill : colors.control }]}>
        <Ionicons name={icon} size={26} color={on ? colors.onPrimary : colors.onControl} />
      </PressableScale>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.screen, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={{ alignItems: 'center', gap: Spacing.md, alignSelf: 'stretch' }}>
          <View style={styles.inApp}>
            <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
            <Text variant="caption" muted>
              {t('call.inApp')}
            </Text>
          </View>
          <View style={[styles.ring, { borderColor: colors.primary }]}>
            <Avatar name={person.name} photo={person.photo} size={112} />
          </View>
          <Text variant="title" center>
            {person.name}
          </Text>
          <View style={[styles.pill, { backgroundColor: colors.primarySoft }]}>
            <Text variant="label" color={colors.primary} center>
              {t('call.notYet')}
            </Text>
          </View>
          <Text muted center style={{ maxWidth: 340 }}>
            {t('call.testNote', { name: person.name })}
          </Text>
        </View>
        <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: Spacing.lg }}>
          <View style={styles.controls}>
            {round(mute ? 'mic-off' : 'mic', t('call.mute'), mute, () => setMute(!mute))}
            {round('volume-high', t('call.speaker'), speaker, () => setSpeaker(!speaker))}
          </View>
          <View style={{ alignItems: 'center', gap: Spacing.xs }}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('call.end')}
              scaleTo={0.92}
              onPress={() => {
                play('tap');
                onClose();
              }}
              style={[styles.end, { backgroundColor: colors.accentFill }]}>
              <Ionicons name="call" size={30} color={colors.onPrimary} style={{ transform: [{ rotate: '135deg' }] }} />
            </PressableScale>
            <Text variant="caption" muted>
              {t('call.end')}
            </Text>
          </View>
          {noAnswer &&
            (live && digits ? (
              <ExternalLink href={callUrl(digits)} label={t('call.byPhone', { name: person.name })} style={[styles.wide, { backgroundColor: colors.successFill }]}>
                <Ionicons name="call-outline" size={18} color={colors.onPrimary} />
                <Text variant="label" color={colors.onPrimary} center style={{ flexShrink: 1 }}>
                  {t('call.byPhone', { name: person.name })}
                </Text>
              </ExternalLink>
            ) : (
              <Text variant="caption" muted center style={{ maxWidth: 340 }}>
                {live ? t('call.noPhone', { name: person.name }) : t('call.onlyLive')}
              </Text>
            ))}
          {onChat && (
            <PressableScale
              accessibilityRole="button"
              scaleTo={0.97}
              onPress={() => {
                onClose();
                onChat();
              }}
              style={[styles.wide, { backgroundColor: colors.control }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
              <Text variant="label" color={colors.onControl}>
                {t('call.chat')}
              </Text>
            </PressableScale>
          )}
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xl },
  inApp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ring: { padding: 6, borderRadius: 70, borderWidth: 2 },
  pill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  round: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  end: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  wide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 52, paddingHorizontal: Spacing.lg, borderRadius: Radius.pill, alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, minHeight: 48, borderRadius: Radius.pill },
  badge: { position: 'absolute', top: -6, end: -4, minWidth: 22, height: 22, paddingHorizontal: 4, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
