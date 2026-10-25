import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/cairo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { BackendProvider } from '@/backend';
import { LiveEvents } from '@/components/live-events';
import { ToastProvider } from '@/components/toast';
import '@/i18n';
import { LanguageProvider } from '@/i18n/language-provider';
import { AccountProvider, useAccount } from '@/state/account';
import { DriverProvider } from '@/state/driver';
import { RequestDraftProvider } from '@/state/request-draft';
import { RoleProvider, useRole } from '@/state/role';
import { useColors } from '@/theme';

SplashScreen.preventAutoHideAsync();

function AppStack() {
  const colors = useColors();
  const { loaded: roleLoaded } = useRole();
  const { loaded: accountLoaded } = useAccount();
  const loaded = roleLoaded && accountLoaded;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="language" options={{ presentation: 'modal' }} />
      </Stack>
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
    <LanguageProvider>
      <BackendProvider>
        <RoleProvider>
          <AccountProvider>
            <RequestDraftProvider>
              <DriverProvider>
                <ToastProvider>
                  <StatusBar style="auto" />
                  <AppStack />
                </ToastProvider>
              </DriverProvider>
            </RequestDraftProvider>
          </AccountProvider>
        </RoleProvider>
      </BackendProvider>
    </LanguageProvider>
  );
}
