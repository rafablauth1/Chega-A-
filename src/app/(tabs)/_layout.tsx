import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useAuth, useCanManage } from '@/auth';
import { Button, Empty, Screen } from '@/components/ui';
import { isCloudEnabled } from '@/lib/supabase';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { activeGroup, groups } = useAuth();
  const canManage = useCanManage();

  if (isCloudEnabled && !activeGroup && groups.length === 0) return <NoGroup />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: '700' },
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
        name="players"
        options={{
          title: 'Jogadores',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Caixa',
          href: canManage ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
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
          text="Crie o grupo da sua pelada ou entre com o código de convite que um amigo te mandou."
        />
        <Button title="Criar ou entrar num grupo" icon="people" onPress={() => router.push('/group-join')} />
        <Button title="Meu perfil" icon="person-circle-outline" variant="ghost" onPress={() => router.push('/me')} style={{ marginTop: 8 }} />
      </Screen>
    </View>
  );
}
