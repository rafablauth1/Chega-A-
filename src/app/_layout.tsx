import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
  useFonts,
} from '@expo-google-fonts/barlow';
import { BigShouldersDisplay_800ExtraBold, BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth';
import { AppDialog } from '@/components/AppDialog';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { isCloudEnabled } from '@/lib/supabase';
import { useStore } from '@/store';
import { buildDemo } from '@/utils/demo';
import { colors, fonts } from '@/theme';

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

/**
 * Se alguma tela quebrar (erro inesperado), mostra isto em vez de fechar o app.
 * O Expo Router usa este export automaticamente para todas as telas.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
      <Text style={{ fontSize: 48 }}>🤕</Text>
      <Text style={{ color: colors.text, fontSize: 24, textAlign: 'center', fontWeight: '800' }}>Deu uma lesão aqui</Text>
      <Text style={{ color: colors.muted, fontSize: 15, textAlign: 'center' }}>
        Algo deu errado nesta tela. Seus dados estão salvos. Tente de novo; se continuar, feche e abra o app.
      </Text>
      {__DEV__ && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'center' }}>{error?.message}</Text>}
      <Pressable
        onPress={() => retry()}
        style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 6 }}
      >
        <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 16 }}>Tentar de novo</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

function App() {
  const { ready, session, holdSession } = useAuth();
  // Sem Supabase configurado o app funciona como antes, sem login
  const signedIn = !isCloudEnabled || (!!session && !holdSession);
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BigShouldersDisplay_800ExtraBold,
    BigShouldersDisplay_900Black,
  });

  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useStore.persist.hasHydrated());
    return unsub;
  }, []);

  // Atalho de desenvolvimento na web: abrir com ?demo=1 carrega o grupo de exemplo
  useEffect(() => {
    if (!__DEV__ || isCloudEnabled || Platform.OS !== 'web' || !hydrated) return;
    if (new URLSearchParams(window.location.search).has('demo') && useStore.getState().players.length === 0) {
      useStore.getState().replaceAll(buildDemo());
    }
  }, [hydrated]);

  if (!hydrated || !ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <Image source={require('../../assets/android-icon-foreground.png')} style={{ width: 120, height: 120 }} resizeMode="contain" />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <UpdatePrompt />
      <AppDialog />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: 'Voltar',
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="player/[id]" options={{ title: 'Jogador' }} />
          <Stack.Screen name="game/[id]" options={{ title: 'Jogo' }} />
          <Stack.Screen name="game-form/[id]" options={{ title: 'Jogo' }} />
          <Stack.Screen name="match/[gameId]/[matchId]" options={{ title: 'Partida' }} />
          <Stack.Screen name="settings" options={{ title: 'Ajustes do grupo' }} />
          <Stack.Screen name="finance" options={{ title: 'Caixa' }} />
          <Stack.Screen name="me" options={{ title: 'Meu perfil' }} />
          <Stack.Screen name="group-join" options={{ title: 'Clubes' }} />
          <Stack.Screen name="single-game" options={{ title: 'Jogo avulso' }} />
          <Stack.Screen name="group/[id]" options={{ title: 'Clube' }} />
          <Stack.Screen name="profile-edit" options={{ title: 'Editar perfil' }} />
          <Stack.Screen name="athlete/[id]" options={{ title: 'Atleta' }} />
          <Stack.Screen name="communities" options={{ title: 'Comunidades' }} />
          <Stack.Screen name="community/[id]" options={{ title: 'Comunidade' }} />
          <Stack.Screen name="call-new" options={{ title: 'Publicar vaga' }} />
          <Stack.Screen name="bora" options={{ title: 'Bora jogar?' }} />
          <Stack.Screen name="chat/[id]" options={{ title: 'Conversa' }} />
          <Stack.Screen name="account-security" options={{ title: 'Senha e segurança' }} />
          <Stack.Screen name="rate/[gameId]" options={{ title: 'Avaliar a galera' }} />
          <Stack.Screen name="scoring-help" options={{ title: 'Como funciona a nota' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ title: 'Esqueci minha senha' }} />
        </Stack.Protected>
        {/* Privacidade e termos abrem com ou sem login */}
        <Stack.Screen name="legal/[doc]" options={{ title: 'Documento' }} />
      </Stack>
    </ThemeProvider>
  );
}
