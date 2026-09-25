import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useStore } from '@/store';
import { buildDemo } from '@/utils/demo';
import { colors } from '@/theme';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useStore.persist.hasHydrated());
    return unsub;
  }, []);

  // Atalho de desenvolvimento na web: abrir com ?demo=1 carrega o grupo de exemplo
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'web' || !hydrated) return;
    if (new URLSearchParams(window.location.search).has('demo') && useStore.getState().players.length === 0) {
      useStore.getState().replaceAll(buildDemo());
    }
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: 'Voltar',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="player/[id]" options={{ title: 'Jogador' }} />
        <Stack.Screen name="game/[id]" options={{ title: 'Jogo' }} />
        <Stack.Screen name="game-form/[id]" options={{ title: 'Jogo' }} />
        <Stack.Screen name="match/[gameId]/[matchId]" options={{ title: 'Partida' }} />
        <Stack.Screen name="settings" options={{ title: 'Ajustes do grupo' }} />
      </Stack>
    </ThemeProvider>
  );
}
