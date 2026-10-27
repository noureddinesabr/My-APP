import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/cairo';
import { Stack, type NativeStackNavigationOptions } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackendProvider } from '@/backend';
import { LiveEvents } from '@/components/live-events';
import { ToastProvider } from '@/components/toast';
import '@/i18n';
import { LanguageProvider } from '@/i18n/language-provider';
import { AccountProvider, useAccount } from '@/state/account';
import { DriverProvider } from '@/state/driver';
import { RequestDraftProvider } from '@/state/request-draft';
import { RoleProvider, useRole } from '@/state/role';
import { ThemeProvider, useColors, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Settings and Language slide up like sheets but stay inside the safe frame (native
// form sheets drew under Android's navigation buttons on some phones).
const SHEET: NativeStackNavigationOptions = {
  animation: 'slide_from_bottom',
};

function AppStack() {
  const colors = useColors();
  const { scheme } = useTheme();
  const { loaded: roleLoaded } = useRole();
  const { loaded: accountLoaded } = useAccount();
  const loaded = roleLoaded && accountLoaded;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* One safe frame for every screen: nothing sits under the status bar, the camera
          cut-out, the rounded corners or Android's navigation bar. Screens inside it must not
          add the safe-area insets again (floating layers in a Modal still do). */}
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}>
          {/* Short, temporary screens open as draggable sheets (swipe down to close). */}
          <Stack.Screen name="language" options={SHEET} />
          <Stack.Screen name="settings" options={SHEET} />
        </Stack>
      </SafeAreaView>
      <LiveEvents />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LanguageProvider>
          <BackendProvider>
            <RoleProvider>
              <AccountProvider>
                <RequestDraftProvider>
                  <DriverProvider>
                    <ToastProvider>
                      <AppStack />
                    </ToastProvider>
                  </DriverProvider>
                </RequestDraftProvider>
              </AccountProvider>
            </RoleProvider>
          </BackendProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
