import { NotoKufiArabic_500Medium, NotoKufiArabic_700Bold } from '@expo-google-fonts/noto-kufi-arabic';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { detectPreviewAi } from './ai';
import { CustomerSide } from './customer';
import { NoticeBanner } from './extras';
import { DriverSide } from './driver';
import { Confirm } from './shared';
import { loadState, update, useStore } from './store';
import { customer, driver } from './theme';
import { Btn, Card, ColorsContext, T, tap, useColors } from './ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
    Promise.all([loadState(), detectPreviewAi()]).finally(() => setStateLoaded(true));
  }, []);
  const ready = fontsLoaded && stateLoaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [role, setRole] = useState<'customer' | 'driver'>('customer');
  const [settings, setSettings] = useState(false);
  const insets = useSafeAreaInsets();
  const palette = role === 'driver' ? driver : customer;
  return (
    <ColorsContext.Provider value={palette}>
      <StatusBar style={role === 'driver' ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 16 }}>
          <TopBar role={role} setRole={setRole} openSettings={() => setSettings(true)} />
          <View style={{ backgroundColor: palette.warnSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
            <T size={13} color={palette.warn}>
              Test version: everything stays on this phone. Switch between Customer and Driver to test both sides. No real driver comes and no money moves.
            </T>
          </View>
          {role === 'driver' ? <DriverSide /> : <CustomerSide openSettings={() => setSettings(true)} />}
        </ScrollView>
      </KeyboardAvoidingView>
      <NoticeBanner side={role} />
      <Settings visible={settings} onClose={() => setSettings(false)} />
    </ColorsContext.Provider>
  );
}

function TopBar({ role, setRole, openSettings }: { role: 'customer' | 'driver'; setRole: (r: 'customer' | 'driver') => void; openSettings: () => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
          <T weight="heavy" color={c.onInk}>
            X
          </T>
        </View>
        <T size={20} weight="heavy">
          Xapp
        </T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ flexDirection: 'row', backgroundColor: c.raised, borderRadius: 999, padding: 4, gap: 4 }}>
          {(['customer', 'driver'] as const).map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: role === r }}
              onPress={() => {
                tap();
                setRole(r);
              }}
              style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: 999, justifyContent: 'center', backgroundColor: role === r ? c.surface : 'transparent' }}>
              <T size={14} weight="bold" color={role === r ? c.fg : c.muted}>
                {r === 'customer' ? 'Customer' : 'Driver'}
              </T>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={openSettings} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="settings-outline" size={22} color={c.fg} />
        </Pressable>
      </View>
    </View>
  );
}

function Settings({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const store = useStore();
  const c = customer;
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState(store.aiKey);
  const [clear, setClear] = useState(false);
  const [saved, setSaved] = useState('');
  useEffect(() => {
    if (visible) {
      setKey(getKey());
      setSaved('');
    }
  }, [visible]);
  const getKey = () => store.aiKey;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ColorsContext.Provider value={customer}>
        <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={26} weight="heavy">
              Settings
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={26} color={c.fg} />
            </Pressable>
          </View>
          <Card>
            <T weight="heavy">AI that fills your card</T>
            <T size={14} muted>
              The AI reads your photo and your words and fills in the card. This test app calls Claude with your own Anthropic API key, kept only on this phone. Without a key, you fill the card yourself.
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
              style={{ backgroundColor: c.raised, borderRadius: 14, padding: 14, fontSize: 15, color: c.fg }}
            />
            <Btn
              title="Save key"
              small
              onPress={() => {
                update((s) => ({ ...s, aiKey: key.trim() }));
                setSaved(key.trim() ? 'Saved. The AI will fill your next card.' : 'Key removed. You will fill the card yourself.');
              }}
            />
            {saved ? (
              <T size={14} color={c.ok}>
                {saved}
              </T>
            ) : null}
          </Card>
          <Card>
            <T weight="heavy">Test data</T>
            <T size={14} muted>
              Requests, offers and trips are saved on this phone only.
            </T>
            <Btn title="Clear all test data" kind="ghost" small onPress={() => setClear(true)} />
          </Card>
        </ScrollView>
        <Confirm
          visible={clear}
          title="Clear all test data?"
          body="Every request, offer and trip on this phone is deleted. Your AI key and driver profile stay."
          yes="Clear everything"
          onNo={() => setClear(false)}
          onYes={() => {
            update((s) => ({ ...s, requests: [], offers: [], activeRequestId: null }));
            setClear(false);
            setSaved('Test data cleared.');
          }}
        />
      </ColorsContext.Provider>
    </Modal>
  );
}
