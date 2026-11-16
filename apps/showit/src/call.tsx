import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Linking, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from './i18n';
import { Overlay } from './overlay';
import { Avatar, type Person } from './people';
import { T, tap, useColors } from './ui';
import { fade, SIGNAL } from './theme';

/**
 * Calling the other side inside the app (over the internet, no phone number shown), from the
 * customer's trip page, the driver's job page and the chat.
 *
 * Honest about the test version: a real call between two phones needs the app's server to
 * connect them, and there is none yet. So the call screen opens with everything in place
 * (photo, name, mute, speaker, hang up) but says plainly that the call can't reach the other
 * person yet; it never pretends to ring or to be connected.
 */
// Whether a call screen is open (passing notices stay hidden meanwhile).
let openCalls = 0;
const callListeners = new Set<() => void>();
const setCallOpen = (d: number) => {
  openCalls = Math.max(0, openCalls + d);
  callListeners.forEach((l) => l());
};
export const useCallOpen = () =>
  useSyncExternalStore(
    (l) => {
      callListeners.add(l);
      return () => callListeners.delete(l);
    },
    () => openCalls > 0,
  );

export function CallButton({ person, onChat, size = 48, label }: { person: Person; onChat?: () => void; size?: number; /** Stitch: a wide dark pill with the word ("Call driver"). */ label?: string }) {
  const c = useColors();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('callBtn', { name: person.name })}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        hitSlop={4}
        style={({ pressed }) =>
          label
            ? { flexDirection: 'row', minHeight: 48, borderRadius: 999, paddingHorizontal: 16, gap: 8, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] }
            : { width: size, height: size, borderRadius: size / 2, backgroundColor: c.live, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] }
        }>
        <Ionicons name="call" size={label ? 18 : Math.round(size * 0.44)} color={label ? c.onAccent : c.onInverse} />
        {label ? (
          <T size={15} weight="bold" color={c.onAccent}>
            {label}
          </T>
        ) : null}
      </Pressable>
      <CallScreen person={open ? person : null} onClose={() => setOpen(false)} onChat={onChat} />
    </>
  );
}

export function CallScreen({ person, onClose, onChat }: { person: Person | null; onClose: () => void; onChat?: () => void }) {
  const c = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const short = height < 700;
  const shown = !!person;
  useEffect(() => {
    if (!shown) return;
    setCallOpen(1);
    return () => setCallOpen(-1);
  }, [shown]);
  const [mute, setMute] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  // In-app call first (no number shared); when it isn't answered, a normal phone call is offered
  // (round 7), only during a live trip. The number is dialled, never written on the screen.
  const [noAnswer, setNoAnswer] = useState(false);
  useEffect(() => {
    if (!shown) {
      setNoAnswer(false);
      return;
    }
    const timer = setTimeout(() => setNoAnswer(true), 6000);
    return () => clearTimeout(timer);
  }, [shown]);
  const round = (icon: keyof typeof Ionicons.glyphMap, label: string, on: boolean, press: () => void) => (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel={label}
        onPress={() => {
          tap();
          press();
        }}
        style={({ pressed }) => ({ width: 64, height: 64, borderRadius: 32, backgroundColor: on ? c.onInverse : fade(c.onInverse, 0.14), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
        <Ionicons name={icon} size={26} color={on ? c.inverseDeep : c.onInverse} />
      </Pressable>
      <T size={12} color={fade(c.onInverse, 0.8)}>
        {label}
      </T>
    </View>
  );
  return (
    <Overlay visible={!!person} onClose={onClose}>
      {person ? (
        <ScrollView style={{ flex: 1, backgroundColor: c.inverseDeep }} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + (short ? 20 : 48), paddingBottom: insets.bottom + (short ? 16 : 32), paddingHorizontal: 24, alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <View style={{ alignItems: 'center', gap: short ? 10 : 14, alignSelf: 'stretch' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="lock-closed" size={12} color={fade(c.onInverse, 0.6)} />
              <T size={13} color={fade(c.onInverse, 0.6)}>
                {t('callInApp')}
              </T>
            </View>
            <View style={{ padding: 6, borderRadius: 70, borderWidth: 2, borderColor: fade(c.onInverse, 0.18) }}>
              <Avatar name={person.name} uri={person.photo} size={short ? 88 : 120} />
            </View>
            <T size={28} weight="heavy" color={c.onInverse} style={{ textAlign: 'center' }}>
              {person.name}
            </T>
            <View style={{ backgroundColor: fade(SIGNAL.callNotice, 0.18), borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
              <T size={14} weight="bold" color={SIGNAL.callNoticeText}>
                {t('callNotYet')}
              </T>
            </View>
            <T size={14} color={fade(c.onInverse, 0.72)} style={{ textAlign: 'center', maxWidth: 340 }}>
              {t('callTestNote', { name: person.name })}
            </T>
          </View>
          <View style={{ alignSelf: 'stretch', gap: short ? 16 : 28, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 40 }}>
              {round(mute ? 'mic-off' : 'mic', t('callMute'), mute, () => setMute(!mute))}
              {round('volume-high', t('callSpeaker'), speaker, () => setSpeaker(!speaker))}
            </View>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('callEnd')}
                onPress={() => {
                  tap();
                  onClose();
                }}
                style={({ pressed }) => ({ width: 72, height: 72, borderRadius: 36, backgroundColor: c.dangerFill, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}>
                <Ionicons name="call" size={30} color={c.onInverse} style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
              <T size={12} color={fade(c.onInverse, 0.8)}>
                {t('callEnd')}
              </T>
            </View>
            {noAnswer ? (
              person.phone ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    Linking.openURL(`tel:${person.phone!.replace(/[^\d+]/g, '')}`).catch(() => {});
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingHorizontal: 18, borderRadius: 999, backgroundColor: SIGNAL.callPhone }}>
                  <Ionicons name="call-outline" size={18} color={c.onInverse} />
                  <T size={15} weight="heavy" color={c.onInverse}>
                    {t('callByPhone', { name: person.name })}
                  </T>
                </Pressable>
              ) : (
                <T size={13} color={fade(c.onInverse, 0.7)} style={{ textAlign: 'center', maxWidth: 320 }}>
                  {t('callNoPhone', { name: person.name })}
                </T>
              )
            ) : null}
            {onChat ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  tap();
                  onClose();
                  onChat();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: fade(c.onInverse, 0.12) }}>
                <Ionicons name="chatbubbles-outline" size={18} color={c.onInverse} />
                <T size={14} weight="bold" color={c.onInverse}>
                  {t('callChat')}
                </T>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      ) : null}
    </Overlay>
  );
}
