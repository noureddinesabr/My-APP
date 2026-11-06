import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setLanguage, useT, type Key, type Lang } from './i18n';
import { KeyboardScroll } from './keyboard';
import { Overlay } from './overlay';
import { Chip, Confirm } from './shared';
import { getState, update, useStore, type Role } from './store';
import { customer, driver } from './theme';
import { Btn, Card, ColorsContext, T, tap, useColors } from './ui';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ar', label: 'العربية' },
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
];

/** A page drawn over the app (inside its own window, so the keyboard is measured), with a title and a close button. */
function Page({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const c = customer;
  const insets = useSafeAreaInsets();
  return (
    <Overlay visible={visible} onClose={onClose}>
      <ColorsContext.Provider value={customer}>
        <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 }}>
            <T size={26} weight="heavy" style={{ flexShrink: 1 }}>
              {title}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel={getState().lang === 'ar' ? 'إغلاق' : 'Close'} onPress={onClose} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color={c.fg} />
            </Pressable>
          </View>
          {children}
        </View>
      </ColorsContext.Provider>
    </Overlay>
  );
}

/** A row in a settings list: icon, title, optional line under it, and what's on its end. */
function Row({ icon, title, sub, end, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; end?: ReactNode; onPress?: () => void; last?: boolean }) {
  const c = useColors();
  const { rtl } = useT();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={c.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="bold">{title}</T>
        {sub ? (
          <T size={12} muted>
            {sub}
          </T>
        ) : null}
      </View>
      {end ?? (onPress ? <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={c.muted} /> : null)}
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <T size={13} weight="bold" muted style={{ paddingHorizontal: 4 }}>
        {title}
      </T>
      <Card style={{ paddingVertical: 4, gap: 0 }}>{children}</Card>
    </View>
  );
}

/** An on/off switch drawn the same way in every language (the system one mirrors oddly right to left). */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={() => {
        tap();
        onChange(!on);
      }}
      hitSlop={8}
      style={{ width: 52, height: 32, borderRadius: 16, padding: 3, backgroundColor: on ? c.accent : c.line, alignItems: on ? 'flex-end' : 'flex-start', justifyContent: 'center', direction: 'ltr' }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
    </Pressable>
  );
}

/** The two ways to use the app, as two big choices. */
function ModeChoice({ role, onRole }: { role: Role; onRole: (r: Role) => void }) {
  const c = useColors();
  const { t } = useT();
  const item = (r: Role, icon: keyof typeof Ionicons.glyphMap, title: Key, sub: Key) => {
    const on = role === r;
    const look = r === 'driver' ? driver : customer;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        onPress={() => {
          tap();
          onRole(r);
        }}
        style={({ pressed }) => ({ flex: 1, borderRadius: 20, padding: 14, gap: 8, backgroundColor: look.bg, borderWidth: on ? 2.5 : 1, borderColor: on ? c.accent : c.line, opacity: pressed ? 0.9 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: look.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={22} color={look.onAccent} />
          </View>
          <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? c.accent : look.muted} />
        </View>
        <T size={17} weight="heavy" color={look.fg}>
          {t(title)}
        </T>
        <T size={12} color={look.muted}>
          {t(sub)}
        </T>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {item('customer', 'cube', 'modeCustomer', 'modeCustomerSub')}
      {item('driver', 'car', 'modeDriver', 'modeDriverSub')}
    </View>
  );
}

export function Settings({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const store = useStore();
  const { t, lang } = useT();
  const c = customer;
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState(store.aiKey);
  const [clear, setClear] = useState(false);
  const [saved, setSaved] = useState('');
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  useEffect(() => {
    if (visible) {
      setKey(getState().aiKey);
      setSaved('');
    }
  }, [visible]);
  return (
    <>
      <Page visible={visible} onClose={onClose} title={t('settings')}>
        <KeyboardScroll bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 18 }}>
          <View style={{ gap: 6 }}>
            <T size={13} weight="bold" muted style={{ paddingHorizontal: 4 }}>
              {t('useAppAs')}
            </T>
            <ModeChoice
              role={store.role}
              onRole={(role) => {
                if (role === store.role) return;
                update((s) => ({ ...s, role }));
                onClose();
              }}
            />
          </View>
          <Group title={t('language')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 }}>
              {LANGS.map((l) => (
                <Chip key={l.id} label={l.label} on={lang === l.id} onPress={() => setLanguage(l.id)} />
              ))}
            </View>
          </Group>
          <Group title={t('prefsTitle')}>
            <Row
              icon="volume-high-outline"
              title={t('soundsTitle')}
              sub={t('soundsSub')}
              last
              end={<Toggle on={store.sounds !== false} label={t('soundsTitle')} onChange={(v) => update((s) => ({ ...s, sounds: v }))} />}
            />
          </Group>
          <Group title={t('legalTitle')}>
            <Row icon="document-text-outline" title={t('termsTitle')} onPress={() => setLegal('terms')} />
            <Row icon="lock-closed-outline" title={t('privacyTitle')} onPress={() => setLegal('privacy')} last />
          </Group>
          <Group title={t('testTitle')}>
            <View style={{ backgroundColor: c.warnSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 }}>
              <T size={13} color={c.warn}>
                {t('testBanner')}
              </T>
            </View>
            <View style={{ gap: 10, paddingVertical: 12 }}>
              <T weight="heavy">{t('aiTitle')}</T>
              <T size={14} muted>
                {t('aiBody')}
              </T>
              <TextInput
                value={key}
                onChangeText={setKey}
                placeholder="sk-ant-..."
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                accessibilityLabel="Anthropic API key"
                style={[{ backgroundColor: c.raised, borderRadius: 14, padding: 14, fontSize: 15, color: c.fg, textAlign: 'left', writingDirection: 'ltr' }, { outlineWidth: 0, outlineStyle: 'none' } as object]}
              />
              <Btn
                title={t('saveKey')}
                small
                onPress={() => {
                  update((s) => ({ ...s, aiKey: key.trim() }));
                  setSaved(key.trim() ? t('keySaved') : t('keyRemoved'));
                }}
              />
              {saved ? (
                <T size={14} color={c.ok}>
                  {saved}
                </T>
              ) : null}
            </View>
            <Row icon="trash-outline" title={t('clearData')} sub={t('testDataSub')} onPress={() => setClear(true)} last />
          </Group>
          <T size={12} muted style={{ textAlign: 'center' }}>
            {t('versionLine')}
          </T>
        </KeyboardScroll>
      </Page>
      <Page visible={legal !== null} onClose={() => setLegal(null)} title={legal === 'privacy' ? t('privacyTitle') : t('termsTitle')}>
        {/* Left empty on purpose for now: the text will be added later. */}
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <T muted>{t('legalSoon')}</T>
        </ScrollView>
      </Page>
      <Confirm
        visible={clear}
        title={t('clearTitle')}
        body={t('clearBody')}
        yes={t('clearYes')}
        onNo={() => setClear(false)}
        onYes={() => {
          update((s) => ({ ...s, requests: [], offers: [], activeRequestId: null }));
          setClear(false);
          setSaved(t('cleared'));
        }}
      />
    </>
  );
}
