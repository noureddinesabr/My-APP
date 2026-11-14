import { NotoKufiArabic_500Medium, NotoKufiArabic_700Bold } from '@expo-google-fonts/noto-kufi-arabic';
import { PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { I18nManager, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { detectPreviewAi } from './ai';
import { startTripEngine } from './engine';
import { CustomerSide } from './customer';
import { DriverSide } from './driver';
import { NoticeBanner } from './extras';
import { Overlay, OverlayHost } from './overlay';
import { goHome, onHome, onOpenTab, onOpenTrip, type TabId } from './home';
import { loadRestart, saveOnRestart, takeRestored } from './resume';
import { KeyboardScroll, KeyboardShell } from './keyboard';
import { ReportTab } from './report';
import { LANGS, Settings } from './settings';
import { TabBar, TabPage } from './tabs';
import { MapBackdrop } from './map/MapBackdrop';
import { recenter, useMapBig, useMapPanel, useMapShown } from './map/trip';
import { applyDirection, setLanguage, useT } from './i18n';
import { getState, loadState, notify, update, useStore, type Role } from './store';
import { checkForUpdate } from './updates';
import { appearanceFor, paletteFor } from './theme';
import { ColorsContext, mainScroll, T, tap, useColors } from './ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Browser preview only: lets the automatic screen tour switch language and colours on any page.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  (window as unknown as { __xapp: object }).__xapp = {
    setLanguage,
    setAppearance: (appearance: 'light' | 'dark') => update((s) => ({ ...s, appearance })),
  };
}

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
    Promise.all([loadState(), detectPreviewAi(), loadRestart()]).finally(() => {
      const lang = getState().lang;
      applyDirection(lang);
      // A phone whose layout direction doesn't match the saved language flips once.
      if (Platform.OS !== 'web' && I18nManager.isRTL !== (lang === 'ar')) setLanguage(lang);
      setStateLoaded(true);
      startTripEngine();
      // A newer version from expo.dev: downloaded, announced, then the app restarts on the same page.
      checkForUpdate(() => notify(getState().role ?? 'customer', 'nt_updateReady', 'success'));
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
        <KeyboardShell>
          <Root />
        </KeyboardShell>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const store = useStore();
  const role: Role = store.role ?? 'customer';
  // After a language restart (#101) the page that was open (settings, a tab, a chat) opens again.
  const [snap] = useState(() => takeRestored<{ settings: boolean; tab: TabId | null; chat: string | null; tabRole: Role }>('root'));
  const [settings, setSettings] = useState(!!snap?.settings);
  // A page from the top bar (messages, offers, profile) shown over the current screen; the request in progress stays as it was.
  const [tab, setTab] = useState<TabId | null>(snap?.tab ?? null);
  const [chat, setChat] = useState<string | null>(snap?.chat ?? null);
  // The side a page was opened on: after switching side it is never shown (or marked read) as the other side.
  const [tabRole, setTabRole] = useState<Role>(snap?.tabRole ?? role);
  const live = useRef({ settings, tab, chat, tabRole });
  live.current = { settings, tab, chat, tabRole };
  useEffect(() => saveOnRestart('root', () => live.current), []);
  const closeTab = () => {
    setTab(null);
    setChat(null);
  };
  useEffect(() => onHome(closeTab), []);
  useEffect(() => onOpenTrip(closeTab), []);
  useEffect(
    () =>
      onOpenTab((next, conversation) => {
        setTabRole(getState().role ?? 'customer');
        setTab(next);
        setChat(conversation ?? null);
      }),
    [],
  );
  // Changing between customer and driver (in Settings) starts on that side's first page.
  const firstRole = useRef(true);
  useEffect(() => {
    // Not at start-up: a page reopened after a language restart stays open.
    if (firstRole.current) {
      firstRole.current = false;
      return;
    }
    closeTab();
  }, [role]);
  const insets = useSafeAreaInsets();
  const palette = paletteFor(role, store.appearance);
  const dark = appearanceFor(role, store.appearance) === 'dark';
  // The map strip under the top buttons stays put: it shows where you are, then the trip, and
  // can be moved with a finger. Only the panel under it scrolls, and its words vanish at its edge.
  const { height: screenH } = useWindowDimensions();
  const big = useMapBig() && role === 'customer';
  // While waiting for offers the map fills the screen; the pickup and destination are framed in its upper part.
  const panel = useMapPanel();
  // Big map: the trip is framed in the space between the top buttons and the cards at the bottom.
  const barBottom = insets.top + 72;
  const bigHeight = panel ? Math.max(150, screenH - barBottom - panel - insets.bottom - 24) : Math.round(screenH * 0.42);
  const mapWindow = { top: barBottom, height: big ? bigHeight : 170 };
  // Simple design: drivers see the map only while a trip is open (DriverSide sets it).
  const mapShown = useMapShown();
  const { t } = useT();
  const c = palette;
  return (
    <ColorsContext.Provider value={palette}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} />
      {mapShown ? <MapBackdrop window={mapWindow} veil={big ? 'transparent' : dark ? 'rgba(19, 20, 26, 0.8)' : 'rgba(247, 246, 243, 0.68)'} /> : null}
      <View style={{ flex: 1 }} pointerEvents="box-none">
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 12, height: barBottom }} pointerEvents="box-none">
          <TopBar
            role={role}
            tab={tab}
            onTab={(next) => {
              // Tapping the open page's button again closes it.
              setChat(null);
              setTabRole(role);
              setTab(tab === next && tabRole === role ? null : next);
            }}
            openSettings={() => setSettings(true)}
          />
        </View>
        {mapShown ? (
          <View
            style={{
              height: mapWindow.height,
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
        {/* Every typing box in the panel is scrolled to sit fully above the keyboard. */}
        <KeyboardScroll
          ref={(r: unknown) => {
            mainScroll.current = r as typeof mainScroll.current;
          }}
          bottomOffset={40}
          keyboardShouldPersistTaps="handled"
          // The panel sits under the map window (which keeps the pickup and destination in view), so it can
          // always scroll: on a short screen (or with a browser's bars) nothing is ever cut off or stuck.
          scrollEnabled
          pointerEvents="auto"
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: big ? 'flex-end' : 'flex-start',
            paddingTop: 14,
            paddingBottom: insets.bottom + (big ? 12 : 24),
            paddingHorizontal: big ? 12 : 16,
            gap: 16,
          }}>
          {role === 'driver' ? <DriverSide /> : <CustomerSide openSettings={() => setSettings(true)} />}
        </KeyboardScroll>
      </View>
      {tab && tabRole === role ? (
        <View style={{ position: 'absolute', top: barBottom, left: 0, right: 0, bottom: 0 }}>
          <TabPage tab={tab} role={role} chat={chat} setChat={setChat} onClose={closeTab} />
        </View>
      ) : null}
      <OverlayHost />
      <NoticeBanner side={role} />
      <Settings visible={settings} onClose={() => setSettings(false)} />
      <ReportTab />
    </ColorsContext.Provider>
  );
}

function TopBar({ role, tab, onTab, openSettings }: { role: Role; tab: TabId | null; onTab: (t: TabId) => void; openSettings: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const [langMenu, setLangMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const round = { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {/* The X logo: back to the main page (progress is kept). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xapp"
        onPress={() => {
          tap();
          goHome();
        }}
        hitSlop={6}
        style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
        <T weight="heavy" color={c.onInk}>
          X
        </T>
      </Pressable>
      <TabBar tab={tab} onTab={onTab} role={role} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chooseLanguage')}
        onPress={() => {
          tap();
          setLangMenu(true);
        }}
        style={round}>
        <Ionicons name="globe-outline" size={20} color={c.fg} />
        <View style={{ position: 'absolute', bottom: -3, end: -3, backgroundColor: c.ink, borderRadius: 7, paddingHorizontal: 4, minWidth: 20, alignItems: 'center' }}>
          <T size={9} weight="heavy" color={c.onInk} style={{ lineHeight: 13 }}>
            {lang.toUpperCase()}
          </T>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('settings')} onPress={openSettings} style={round}>
        <Ionicons name="settings-outline" size={21} color={c.fg} />
      </Pressable>
      {/* The language list: the person picks Arabic, French or English. */}
      <Overlay visible={langMenu} onClose={() => setLangMenu(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} onPress={() => setLangMenu(false)}>
          <View style={{ position: 'absolute', top: insets.top + 64, end: 16, minWidth: 200, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
            <T size={12} muted weight="semibold" style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
              {t('chooseLanguage')}
            </T>
            {LANGS.map((l) => (
              <Pressable
                key={l.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: lang === l.id }}
                onPress={() => {
                  tap();
                  setLangMenu(false);
                  if (l.id !== lang) setLanguage(l.id);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 48 }}>
                <T size={16} weight={lang === l.id ? 'heavy' : 'regular'} style={{ flex: 1 }}>
                  {l.label}
                </T>
                {lang === l.id ? <Ionicons name="checkmark" size={20} color={c.accent} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Overlay>
    </View>
  );
}
