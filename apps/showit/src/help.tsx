import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { useT, type Key } from './i18n';
import { Sheet } from './trip';
import { T, tap, useColors } from './ui';

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
  const reach = (kind: 'call' | 'whatsapp') => {
    tap();
    if (!SUPPORT_PHONE) return;
    const n = SUPPORT_PHONE.replace(/[^\d+]/g, '');
    Linking.openURL(kind === 'call' ? `tel:${n}` : `https://wa.me/${n.replace('+', '')}`).catch(() => {});
  };
  const contact = (icon: keyof typeof Ionicons.glyphMap, label: string, kind: 'call' | 'whatsapp', color: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!SUPPORT_PHONE}
      onPress={() => reach(kind)}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 16, backgroundColor: color, opacity: !SUPPORT_PHONE ? 0.45 : pressed ? 0.85 : 1 })}>
      <Ionicons name={icon} size={20} color="#FFFFFF" />
      <T size={15} weight="heavy" color="#FFFFFF">
        {label}
      </T>
    </Pressable>
  );
  return (
    <Sheet visible={visible} onClose={onClose} title={t('helpTitle2')}>
      <View style={{ gap: 12 }}>
        <T size={14} muted>
          {t('helpIntro')}
        </T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {contact('call', t('helpCall'), 'call', c.live)}
          {contact('logo-whatsapp', 'WhatsApp', 'whatsapp', '#1FA855')}
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
  );
}
