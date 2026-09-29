import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth, useCanManage } from '@/auth';
import { Button, Empty, Screen } from '@/components/ui';
import { subscribeInbox, unreadCount } from '@/chat';
import { isCloudEnabled } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

/** Mensagens não lidas: busca ao abrir, a cada minuto e soma na hora quando chega mensagem nova. */
function useUnread() {
  const { session } = useAuth();
  const me = session?.user.id;
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isCloudEnabled || !me) return;
    const refresh = () => unreadCount().then(setCount);
    refresh();
    const timer = setInterval(refresh, 60_000);
    const stop = subscribeInbox(me, () => setCount((c) => c + 1));
    return () => {
      clearInterval(timer);
      stop();
    };
  }, [me]);
  return count;
}

export default function TabsLayout() {
  const { activeGroup, groups } = useAuth();
  const canManage = useCanManage();
  const unread = useUnread();

  if (isCloudEnabled && !activeGroup && groups.length === 0) return <NoGroup />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.displayBlack, fontSize: 30 },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 18, marginRight: 16 }}>
            <Link href="/me" asChild>
              <Pressable hitSlop={10}>
                <Ionicons name="person-circle-outline" size={24} color={colors.text} />
              </Pressable>
            </Link>
            {canManage && (
              <Link href="/settings" asChild>
                <Pressable hitSlop={10}>
                  <Ionicons name="settings-outline" size={22} color={colors.text} />
                </Pressable>
              </Link>
            )}
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jogos',
          tabBarIcon: ({ color, size }) => <Ionicons name="football" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Bora',
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontFamily: fonts.bold },
          href: isCloudEnabled ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

function NoGroup() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60 }}>
      <Screen>
        <Empty
          icon="people-circle-outline"
          title="Bora entrar na pelada!"
          text="Crie o clube da sua pelada, marque um jogo avulso ou entre com o código que um amigo te mandou."
        />
        <Button title="Criar clube ou entrar com código" icon="people" onPress={() => router.push('/group-join')} />
        <Button
          title="Marcar um jogo avulso"
          icon="flash"
          variant="secondary"
          onPress={() => router.push('/single-game')}
          style={{ marginTop: 10 }}
        />
        <Button
          title="Achar jogo e jogadores perto"
          icon="flame"
          variant="secondary"
          onPress={() => router.push('/bora')}
          style={{ marginTop: 10 }}
        />
        <Button
          title="Comunidade da empresa ou escola"
          icon="business-outline"
          variant="secondary"
          onPress={() => router.push('/communities')}
          style={{ marginTop: 10 }}
        />
        <Button title="Meu perfil" icon="person-circle-outline" variant="ghost" onPress={() => router.push('/me')} style={{ marginTop: 8 }} />
      </Screen>
    </View>
  );
}
