import { NotoKufiArabic_500Medium, NotoKufiArabic_700Bold } from '@expo-google-fonts/noto-kufi-arabic';
import { PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nManager, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { detectPreviewAi } from './ai';
import { CustomerSide } from './customer';
import { DriverSide } from './driver';
import { NoticeBanner } from './extras';
import { MapBackdrop } from './map/MapBackdrop';
import { recenter, useMapBig, useMapShown } from './map/trip';
import { applyDirection, setLanguage, useT, type Lang } from './i18n';
import { Chip, Confirm } from './shared';
import { getState, loadState, update, useStore } from './store';
import { customer, driver } from './theme';
import { Btn, Card, ColorsContext, mainScroll, T, tap, useColors } from './ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

const LANGS: { id: Lang; label: string }[] = [
  { id: 'ar', label: 'العربية' },
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
];

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    NotoKufiArabic_500Medium,
    NotoKufiArabic_700Bold,
  });
  const [stateLoaded, setStateLoaded] = useState(false);
  useEffect(() => {
    Promise.all([loadState(), detectPreviewAi()]).finally(() => {
      const lang = getState().lang;
      applyDirection(lang);
      // A phone whose layout direction doesn't match the saved language flips once.
      if (Platform.OS !== 'web' && I18nManager.isRTL !== (lang === 'ar')) setLanguage(lang);
      setStateLoaded(true);
    });
  }, []);
  const ready = fontsLoaded && stateLoaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Root />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const [role, setRole] = useState<'customer' | 'driver'>('customer');
  const [settings, setSettings] = useState(false);
  const insets = useSafeAreaInsets();
  const palette = role === 'driver' ? driver : customer;
  // The map strip under the top buttons stays put: it shows where you are, then the trip, and
  // can be moved with a finger. Only the panel under it scrolls, and its words vanish at its edge.
  const { height: screenH } = useWindowDimensions();
  const big = useMapBig() && role === 'customer';
  const mapWindow = { top: insets.top + 64, height: big ? Math.round(screenH * 0.5) : 170 };
  const mapShown = useMapShown() || role === 'driver';
  const { t } = useT();
  const c = palette;
  return (
    <ColorsContext.Provider value={palette}>
      <StatusBar style={role === 'driver' ? 'light' : 'dark'} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} />
      {mapShown ? <MapBackdrop window={mapWindow} veil={role === 'driver' ? 'rgba(19, 20, 26, 0.8)' : 'rgba(247, 246, 243, 0.45)'} /> : null}
      <View style={{ flex: 1 }} pointerEvents="box-none">
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }} pointerEvents="box-none">
          <TopBar role={role} setRole={setRole} openSettings={() => setSettings(true)} />
        </View>
        {mapShown ? (
          <View
            style={{
              height: mapWindow.top + mapWindow.height - (insets.top + 56),
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              paddingHorizontal: 12,
              paddingBottom: 8,
            }}
            pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recenter')}
              onPress={() => {
                tap();
                recenter();
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="locate" size={20} color={c.fg} />
            </Pressable>
          </View>
        ) : null}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            ref={(r) => {
              mainScroll.current = r;
            }}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: 14,
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: 16,
              gap: 16,
            }}>
            {role === 'driver' ? <DriverSide /> : <CustomerSide openSettings={() => setSettings(true)} />}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      <NoticeBanner side={role} />
      <Settings visible={settings} onClose={() => setSettings(false)} />
    </ColorsContext.Provider>
  );
}

function TopBar({ role, setRole, openSettings }: { role: 'customer' | 'driver'; setRole: (r: 'customer' | 'driver') => void; openSettings: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const next = LANGS[(LANGS.findIndex((l) => l.id === lang) + 1) % LANGS.length];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: c.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <T weight="heavy" color={c.onInk}>
            X
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: c.raised,
            borderRadius: 999,
            padding: 4,
            gap: 4,
          }}>
          {(['customer', 'driver'] as const).map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: role === r }}
              onPress={() => {
                tap();
                setRole(r);
              }}
              style={{
                paddingHorizontal: 12,
                minHeight: 36,
                borderRadius: 999,
                justifyContent: 'center',
                backgroundColor: role === r ? c.surface : 'transparent',
              }}>
              <T size={14} weight="bold" color={role === r ? c.fg : c.muted}>
                {r === 'customer' ? t('customer') : t('driver')}
              </T>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('language')}: ${next.label}`}
          onPress={() => {
            tap();
            setLanguage(next.id);
          }}
          style={{
            minWidth: 44,
            height: 44,
            paddingHorizontal: 10,
            borderRadius: 22,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 3,
          }}>
          <Ionicons name="globe-outline" size={20} color={c.fg} />
          <T size={12} weight="bold">
            {lang.toUpperCase()}
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings')}
          onPress={openSettings}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="settings-outline" size={22} color={c.fg} />
        </Pressable>
      </View>
    </View>
  );
}

function Settings({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const store = useStore();
  const { t, lang } = useT();
  const c = customer;
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState(store.aiKey);
  const [clear, setClear] = useState(false);
  const [saved, setSaved] = useState('');
  useEffect(() => {
    if (visible) {
      setKey(getState().aiKey);
      setSaved('');
    }
  }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ColorsContext.Provider value={customer}>
        <ScrollView
          style={{ backgroundColor: c.bg }}
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: 16,
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <T size={26} weight="heavy">
              {t('settings')}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('close')}
              onPress={onClose}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="close" size={26} color={c.fg} />
            </Pressable>
          </View>
          <View
            style={{
              backgroundColor: c.warnSoft,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}>
            <T size={13} color={c.warn}>
              {t('testBanner')}
            </T>
          </View>
          <Card>
            <T weight="heavy">{t('language')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LANGS.map((l) => (
                <Chip key={l.id} label={l.label} on={lang === l.id} onPress={() => setLanguage(l.id)} />
              ))}
            </View>
            <T size={13} muted>
              {t('langNote')}
            </T>
          </Card>
          <Card>
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
              style={{
                backgroundColor: c.raised,
                borderRadius: 14,
                padding: 14,
                fontSize: 15,
                color: c.fg,
                textAlign: 'left',
                writingDirection: 'ltr',
              }}
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
          </Card>
          <Card>
            <T weight="heavy">{t('testData')}</T>
            <T size={14} muted>
              {t('testDataSub')}
            </T>
            <Btn title={t('clearData')} kind="ghost" small onPress={() => setClear(true)} />
          </Card>
        </ScrollView>
        <Confirm
          visible={clear}
          title={t('clearTitle')}
          body={t('clearBody')}
          yes={t('clearYes')}
          onNo={() => setClear(false)}
          onYes={() => {
            update((s) => ({
              ...s,
              requests: [],
              offers: [],
              activeRequestId: null,
            }));
            setClear(false);
            setSaved(t('cleared'));
          }}
        />
      </ColorsContext.Provider>
    </Modal>
  );
}
