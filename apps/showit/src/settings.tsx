import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setLanguage, useT, type Lang } from './i18n';
import { sideText } from './composer';
import { KeyboardScroll } from './keyboard';
import { ReportsSection } from './report';
import { Overlay } from './overlay';
import { Chip, Confirm } from './shared';
import { getState, update, useStore, type Role } from './store';
import { appearanceFor } from './theme';
import { Btn, Card, ColorsContext, T, tap, useColors } from './ui';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ar', label: 'العربية' },
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
];

/** A page drawn over the app (inside its own window, so the keyboard is measured), with a title and a close button. */
function Page({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Overlay visible={visible} onClose={onClose}>
      <ColorsContext.Provider value={c}>
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
function Row({ icon, title, sub, end, onPress, last, selected }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; end?: ReactNode; onPress?: () => void; last?: boolean; selected?: boolean }) {
  const c = useColors();
  const { rtl } = useT();
  return (
    <Pressable
      accessibilityRole={selected !== undefined ? 'radio' : onPress ? 'button' : undefined}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      disabled={!onPress}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: selected ? c.accent : c.raised, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={selected ? c.onAccent : c.fg} />
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

/** A choice in a list: the same size as the other rows, with a round mark on the chosen one. */
function Choice({ icon, title, sub, on, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; on: boolean; onPress: () => void; last?: boolean }) {
  const c = useColors();
  return (
    <Row
      icon={icon}
      title={title}
      sub={sub}
      last={last}
      onPress={onPress}
      selected={on}
      end={<Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? c.accent : c.muted} />}
    />
  );
}

export function Settings({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const store = useStore();
  const { t, lang } = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const look = appearanceFor(store.role, store.appearance);
  const [key, setKey] = useState(store.aiKey);
  const [clear, setClear] = useState(false);
  const [saved, setSaved] = useState('');
  const [info, setInfo] = useState<'terms' | 'privacy' | 'help' | null>(null);
  useEffect(() => {
    if (visible) {
      setKey(getState().aiKey);
      setSaved('');
    }
  }, [visible]);
  return (
    <>
      <Page visible={visible} onClose={onClose} title={t('settings')}>
        <KeyboardScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 18 }}>
          <Group title={t('useAppAs')}>
            {(['customer', 'driver'] as const).map((role, i) => (
              <Choice
                key={role}
                icon={role === 'customer' ? 'cube-outline' : 'car-outline'}
                title={role === 'customer' ? t('modeCustomer') : t('modeDriver')}
                sub={role === 'customer' ? t('modeCustomerSub') : t('modeDriverSub')}
                on={store.role === role}
                last={i === 1}
                onPress={() => {
                  if (role === store.role) return;
                  update((s) => ({ ...s, role }));
                  onClose();
                }}
              />
            ))}
          </Group>
          {/* Light · switch · Dark on one line, like the Sounds switch. Light is the default. */}
          <Group title={t('appearanceTitle')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: 60, direction: 'ltr' }}>
              <Pressable accessibilityRole="radio" accessibilityState={{ selected: look === 'light' }} onPress={() => update((s) => ({ ...s, appearance: 'light' }))} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minHeight: 44 }}>
                <T weight={look === 'light' ? 'heavy' : 'regular'} color={look === 'light' ? c.fg : c.muted}>
                  {t('lightMode')}
                </T>
                <Ionicons name="sunny" size={20} color={look === 'light' ? c.accent : c.muted} />
              </Pressable>
              <Toggle on={look === 'dark'} label={t('appearanceTitle')} onChange={(dark) => update((s) => ({ ...s, appearance: dark ? 'dark' : 'light' }))} />
              <Pressable accessibilityRole="radio" accessibilityState={{ selected: look === 'dark' }} onPress={() => update((s) => ({ ...s, appearance: 'dark' }))} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, minHeight: 44 }}>
                <Ionicons name="moon" size={18} color={look === 'dark' ? c.accent : c.muted} />
                <T weight={look === 'dark' ? 'heavy' : 'regular'} color={look === 'dark' ? c.fg : c.muted}>
                  {t('darkMode')}
                </T>
              </Pressable>
            </View>
          </Group>
          {/* The same order in every language: English on the left, Français in the middle, العربية on the right. */}
          <Group title={t('language')}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 10, direction: 'ltr' }}>
              {(['en', 'fr', 'ar'] as const).map((id) => {
                const l = LANGS.find((x) => x.id === id)!;
                return (
                  <View key={id} style={{ flex: 1 }}>
                    <Chip label={l.label} on={lang === id} onPress={() => setLanguage(id)} />
                  </View>
                );
              })}
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
          <Group title={t('supportTitle')}>
            <Row icon="help-buoy-outline" title={t('helpTitleRow')} onPress={() => setInfo('help')} last />
          </Group>
          {/* Test version: the report tab, and the reports to send. */}
          <Group title={t('rpSection')}>
            <View style={{ paddingVertical: 10 }}>
              <ReportsSection />
            </View>
          </Group>
          <Group title={t('legalTitle')}>
            <Row icon="document-text-outline" title={t('termsTitle')} onPress={() => setInfo('terms')} />
            <Row icon="lock-closed-outline" title={t('privacyTitle')} onPress={() => setInfo('privacy')} last />
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
                style={[{ backgroundColor: c.raised, borderRadius: 14, padding: 14, fontSize: 15, color: c.fg }, sideText('left'), { outlineWidth: 0, outlineStyle: 'none' } as object]}
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
      <Page visible={info !== null} onClose={() => setInfo(null)} title={info === 'privacy' ? t('privacyTitle') : info === 'help' ? t('helpTitleRow') : t('termsTitle')}>
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
