<<<<<<< HEAD
import { Slot } from 'expo-router';
import { UserProvider } from '../context/UserContext';
import { I18nextProvider } from 'react-i18next'; 
import i18n from '../i18n'; 
import { useEffect } from 'react';

export default function Layout() {
  useEffect(() => {
    console.log('i18n initialized:', i18n.isInitialized);
    console.log('Available languages:', i18n.languages);
  }, []);

  useEffect(() => {

    console.log('English translations:', i18n.getResourceBundle('en', 'account'));
    console.log('Portuguese translations:', i18n.getResourceBundle('pt', 'account'));
  }, []);
  return (
    <UserProvider>
      <I18nextProvider i18n={i18n}> 
        <Slot />
      </I18nextProvider>
    </UserProvider>
  );
}
=======
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
>>>>>>> 1dfc7ef186b686640f80cb313e05c6a934b90e90
