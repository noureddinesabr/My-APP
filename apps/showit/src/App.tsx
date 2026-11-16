import { Tajawal_500Medium, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
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
import { goHome, onHome, onOpenTab, onOpenTrip, openTab, openTrip, setBarsOpen, useCameraFull, type TabId } from './home';
import { loadRestart, saveOnRestart, takeRestored } from './resume';
import { KeyboardScroll, KeyboardShell } from './keyboard';
import { ReportTab } from './report';
import { LANGS, Settings } from './settings';
import { BAR_H, TabBar, TabPage, useUnread } from './tabs';
import { MapBackdrop } from './map/MapBackdrop';
import { VoiceAgent } from './voice/agent';
import { recenter, useMapBig, useMapPanel, useMapShown } from './map/trip';
import { applyDirection, setLanguage, useT } from './i18n';
import { getState, isLive, loadState, notify, update, useStore, type Role } from './store';
import { checkForUpdate } from './updates';
import { appearanceFor, fade, paletteFor } from './theme';
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
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_600SemiBold,
    Tajawal_500Medium,
    Tajawal_700Bold,
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
    setBarsOpen(false);
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
  const bigHeight = panel ? Math.max(150, screenH - barBottom - panel - insets.bottom - BAR_H - 24) : Math.round(screenH * 0.42);
  const mapWindow = { top: barBottom, height: big ? bigHeight : 170 };
  // Simple design: drivers see the map only while a trip is open (DriverSide sets it).
  const mapShown = useMapShown();
  const { t } = useT();
  const c = palette;
  // Owner's rule: the customer's first page is the camera alone, edge to edge (no bars).
  const cam = useCameraFull();
  const camPage = role === 'customer' && cam.full && !(tab && tabRole === role);
  const showBars = !camPage || cam.bars;
  return (
    <ColorsContext.Provider value={palette}>
      <StatusBar style={dark || camPage ? 'light' : 'dark'} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} />
      {mapShown ? <MapBackdrop window={mapWindow} veil={big ? 'transparent' : c.veil} /> : null}
      <View style={{ flex: 1 }} pointerEvents="box-none">
        {camPage ? null : (
          <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 12, height: barBottom }} pointerEvents="box-none">
            <TopBar openSettings={() => setSettings(true)} />
          </View>
        )}
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
            <Pressable hitSlop={4}
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
          contentContainerStyle={
            camPage
              ? { flexGrow: 1 }
              : {
                  flexGrow: 1,
                  justifyContent: big ? 'flex-end' : 'flex-start',
                  paddingTop: 14,
                  // Room for the bottom bar (research round, decision 1).
                  paddingBottom: insets.bottom + BAR_H + (big ? 12 : 24),
                  paddingHorizontal: big ? 12 : 16,
                  gap: 16,
                }
          }>
          {role === 'driver' ? <DriverSide /> : <CustomerSide openSettings={() => setSettings(true)} />}
        </KeyboardScroll>
      </View>
      {tab && tabRole === role ? (
        <View style={{ position: 'absolute', top: barBottom, left: 0, right: 0, bottom: BAR_H + insets.bottom }}>
          <TabPage tab={tab} role={role} chat={chat} setChat={setChat} onClose={closeTab} />
        </View>
      ) : null}
      {/* Over the camera, the camera's menu button brings the top bar back. */}
      {camPage && cam.bars ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 12, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: c.bg, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
          <TopBar openSettings={() => setSettings(true)} />
        </View>
      ) : null}
      {/* Navigation at the bottom, within reach of the thumb (research round, decision 1). */}
      {showBars ? <TabBar
        role={role}
        tab={tab && tabRole === role ? tab : null}
        onTab={(next) => {
          // Carte: with a trip in progress it is the trip itself (its live map); otherwise the map page.
          if (next === 'map' && hasLiveTrip(role)) {
            closeTab();
            openTrip();
            return;
          }
          // Tapping the open page's button again closes it.
          setChat(null);
          setTabRole(role);
          setTab(tab === next && tabRole === role ? null : next);
        }}
        onHome={() => {
          closeTab();
          goHome();
        }}
      /> : null}
      <OverlayHost />
      <NoticeBanner side={role} />
      {/* Simple design preview: the driver's voice assistant (Settings › Voice assistant). */}
      {role === 'driver' && store.voice?.on ? <VoiceAgent /> : null}
      <Settings visible={settings} onClose={() => setSettings(false)} />
      <ReportTab />
    </ColorsContext.Provider>
  );
}

/** A booked trip that is not finished, for this side (Carte opens it). */
function hasLiveTrip(role: Role) {
  const st = getState();
  if (role === 'customer') return st.requests.some((r) => r.id === st.activeRequestId && (isLive(r.stage) || r.stage === 'open'));
  return st.requests.some((r) => !!st.driver.name && r.driverName === st.driver.name && isLive(r.stage));
}

function TopBar({ openSettings }: { openSettings: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const store = useStore();
  const role: Role = store.role ?? 'customer';
  const unreadN = useUnread(role);
  const [langMenu, setLangMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const round = { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' } as const;
  const me = role === 'driver' ? store.driver.name : store.customer.name;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {/* The Xapp mark: back to the main page (progress is kept). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xapp"
        onPress={() => {
          tap();
          goHome();
        }}
        hitSlop={6}
        style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center' }}>
        <T size={18} weight="heavy" color={c.inverseAccent}>
          X
        </T>
      </Pressable>
      {/* Stitch: Client | Chauffeur, the side in use is the lime pill. */}
      <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: 999, borderWidth: 1, borderColor: c.line, padding: 3, flexShrink: 1 }}>
        {(['customer', 'driver'] as const).map((r) => {
          const on = role === r;
          return (
            <Pressable
              key={r}
              testID={`role-${r}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return;
                tap();
                update((s) => ({ ...s, role: r }));
              }}
              style={{ minHeight: 32, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? c.accent : 'transparent', flexShrink: 1 }}>
              <T size={12} weight={on ? 'heavy' : 'semibold'} color={on ? c.onAccent : c.muted} numberOfLines={1}>
                {r === 'customer' ? t('roleClient') : t('roleDriver')}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chooseLanguage')}
        onPress={() => {
          tap();
          setLangMenu(true);
        }}
        style={round}>
        <T size={12} weight="heavy" color={c.fg}>
          {lang.toUpperCase()}
        </T>
      </Pressable>
      {/* Messages live behind the chat button (the bottom bar follows the Stitch tabs). */}
      <Pressable
        testID="open-messages"
        accessibilityRole="button"
        accessibilityLabel={unreadN ? `${t('tabMessages')} (${unreadN})` : t('tabMessages')}
        onPress={() => {
          tap();
          openTab('messages');
        }}
        style={round}>
        <Ionicons name="chatbubble-ellipses-outline" size={19} color={c.fg} />
        {unreadN ? (
          <View style={{ position: 'absolute', top: -3, end: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
            <T size={10} weight="heavy" color={c.onAccent} style={{ lineHeight: 12 }}>
              {String(Math.min(9, unreadN))}
            </T>
          </View>
        ) : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('settings')} onPress={openSettings} style={[round, { backgroundColor: c.inverse, borderColor: c.inverse }]}>
        {me ? (
          <T size={13} weight="heavy" color={c.inverseAccent}>
            {me.trim().slice(0, 1).toUpperCase()}
          </T>
        ) : (
          <Ionicons name="settings-outline" size={19} color={c.inverseAccent} />
        )}
      </Pressable>
      {/* The language list: the person picks Arabic, French or English. */}
      <Overlay visible={langMenu} onClose={() => setLangMenu(false)}>
        <Pressable style={{ flex: 1, backgroundColor: fade(c.shadow, 0.25) }} onPress={() => setLangMenu(false)}>
          <View style={{ position: 'absolute', top: insets.top + 64, end: 16, minWidth: 200, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingVertical: 6, shadowColor: c.shadow, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
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
