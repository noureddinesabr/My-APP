import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CallScreen } from './call';
import { BitBubble, Composer } from './composer';
import { useT, type Key } from './i18n';
import { Overlay } from './overlay';
import { play } from './sounds';
import { newId, update, useStore, type SupportMessage } from './store';
import { Sheet } from './trip';
import { T, tap, useColors, useKeyboardInset } from './ui';

/**
 * Xapp support's phone / WhatsApp number. Empty in the test version: the Help sheet then says
 * plainly that calling support comes at launch, and offers the answers to common questions.
 * Put the real number here (international form, e.g. "+212600000000") when it exists.
 */
export const SUPPORT_PHONE: string = '';

const TOPICS: { q: Key; a: Key; icon: keyof typeof Ionicons.glyphMap }[] = [
  { q: 'hq_code', a: 'ha_code', icon: 'keypad-outline' },
  { q: 'hq_late', a: 'ha_late', icon: 'time-outline' },
  { q: 'hq_change', a: 'ha_change', icon: 'create-outline' },
  { q: 'hq_pay', a: 'ha_pay', icon: 'cash-outline' },
  { q: 'hq_damage', a: 'ha_damage', icon: 'alert-circle-outline' },
];

/** A clear Help button for a trip or a job: opens the Help sheet. */
export function HelpButton() {
  const c = useColors();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 })}>
        <Ionicons name="help-buoy" size={20} color={c.accent} />
        <T size={15} weight="heavy">
          {t('helpBtn')}
        </T>
      </Pressable>
      <HelpSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { t } = useT();
  const [shown, setShown] = useState<Key | null>(null);
  const [chat, setChat] = useState(false);
  const [call, setCall] = useState(false);
  const dial = (kind: 'phone' | 'whatsapp') => {
    tap();
    if (!SUPPORT_PHONE) return;
    const n = SUPPORT_PHONE.replace(/[^\d+]/g, '');
    Linking.openURL(kind === 'phone' ? `tel:${n}` : `https://wa.me/${n.replace('+', '')}`).catch(() => {});
  };
  // Four ways to reach Xapp (round 8): write or call inside the app, a normal call, or WhatsApp.
  const contact = (icon: keyof typeof Ionicons.glyphMap, label: string, color: string, press: () => void, off?: boolean) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={off}
      onPress={press}
      style={({ pressed }) => ({ width: '48.5%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 8, borderRadius: 16, backgroundColor: color, opacity: off ? 0.45 : pressed ? 0.85 : 1 })}>
      <Ionicons name={icon} size={19} color="#FFFFFF" />
      <T size={14} weight="heavy" color="#FFFFFF" style={{ flexShrink: 1 }} numberOfLines={2}>
        {label}
      </T>
    </Pressable>
  );
  return (
    <>
      <Sheet visible={visible && !chat && !call} onClose={onClose} title={t('helpTitle2')}>
        <View style={{ gap: 12 }}>
          <T size={14} muted>
            {t('helpIntro')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
            {contact('chatbubbles', t('helpWrite'), c.accent, () => {
              tap();
              setChat(true);
            })}
            {contact('call', t('helpCallApp'), c.live, () => {
              tap();
              setCall(true);
            })}
            {contact('phone-portrait-outline', t('helpCallPhone'), '#334155', () => dial('phone'), !SUPPORT_PHONE)}
            {contact('logo-whatsapp', 'WhatsApp', '#1FA855', () => dial('whatsapp'), !SUPPORT_PHONE)}
          </View>
          {!SUPPORT_PHONE ? (
            <T size={12} color={c.warn}>
              {t('helpTestNote')}
            </T>
          ) : null}
          <T size={14} weight="heavy" style={{ marginTop: 4 }}>
            {t('helpTopics')}
          </T>
          {TOPICS.map((topic) => (
            <View key={topic.q} style={{ backgroundColor: c.raised, borderRadius: 14 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: shown === topic.q }}
                onPress={() => {
                  tap();
                  setShown(shown === topic.q ? null : topic.q);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12 }}>
                <Ionicons name={topic.icon} size={18} color={c.accent} />
                <T size={14} weight="bold" style={{ flex: 1 }}>
                  {t(topic.q)}
                </T>
                <Ionicons name={shown === topic.q ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
              </Pressable>
              {shown === topic.q ? (
                <T size={14} style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                  {t(topic.a)}
                </T>
              ) : null}
            </View>
          ))}
        </View>
      </Sheet>
      <SupportChat visible={visible && chat} onClose={() => setChat(false)} />
      <CallScreen person={visible && call ? { role: 'customer', name: t('xappSupport') } : null} onClose={() => setCall(false)} onChat={() => setChat(true)} />
    </>
  );
}

/** Writing to Xapp support inside the app: text, a voice note, a photo or a file. */
function SupportChat({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const store = useStore();
  const list = store.support ?? [];
  const scroll = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [list.length, visible]);
  const add = (m: SupportMessage) => update((s) => ({ ...s, support: [...(s.support ?? []), m].slice(-200) }));
  return (
    <Overlay visible={visible} onClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 6, paddingBottom: keyboard ? keyboard + 8 : insets.bottom + 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={c.fg} />
          </Pressable>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="help-buoy" size={20} color={c.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="heavy">{t('xappSupport')}</T>
            <T size={12} muted>
              {t('supportSub')}
            </T>
          </View>
        </View>
        <ScrollView ref={(r) => { scroll.current = r as unknown as typeof scroll.current; }} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignSelf: 'center', backgroundColor: c.raised, borderRadius: 14, padding: 10, maxWidth: '90%' }}>
            <T size={13} muted style={{ textAlign: 'center' }}>
              {t('supportHello')}
            </T>
          </View>
          {list.map((m) => (
            <BitBubble key={m.id} bit={{ id: m.id, kind: m.kind, text: m.text, uri: m.uri, ms: m.ms, name: m.name, at: m.at }} mine={m.from === 'me'} side={m.from === 'me' ? 'right' : 'left'} />
          ))}
        </ScrollView>
        <View style={{ paddingHorizontal: 10 }}>
          <Composer
            camera
            hint={t('supportHint')}
            onSend={(bit) => {
              play('send');
              add({ id: newId(), from: 'me', kind: bit.kind, text: bit.text, uri: bit.uri, ms: bit.ms, name: bit.name, at: Date.now() });
              // Test version: an honest automatic answer, once per conversation burst.
              const lastXapp = [...(store.support ?? [])].reverse().find((m) => m.from === 'xapp');
              if (!lastXapp || Date.now() - lastXapp.at > 10 * 60_000) setTimeout(() => add({ id: newId(), from: 'xapp', kind: 'text', text: t('supportAuto'), at: Date.now() }), 1200);
            }}
          />
        </View>
      </View>
    </Overlay>
  );
}
