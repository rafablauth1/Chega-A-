import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GroupDetail } from '@/components/GroupDetail';
import { Button, Chip, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/auth';
import { colors, fonts } from '@/theme';

/** Aba "Clube": mostra o clube ativo (com tudo dentro). Sem clube ativo, oferece criar/entrar/ver comunidades. */
export default function ClubTab() {
  const { groups, activeGroup, setActiveGroup } = useAuth();
  const clubs = groups.filter((g) => g.kind !== 'avulso');

  const switcher = (
    <View style={{ marginBottom: 12, gap: 8 }}>
      {clubs.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {clubs.map((c) => (
            <Chip key={c.id} label={c.name} selected={c.id === activeGroup?.id} onPress={() => setActiveGroup(c.id)} />
          ))}
        </ScrollView>
      )}
      <Pressable onPress={() => router.push('/communities')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <Ionicons name="business-outline" size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 }}>Minhas comunidades</Text>
      </Pressable>
    </View>
  );

  if (!activeGroup) {
    return (
      <Screen>
        {switcher}
        <Empty
          icon="people-circle-outline"
          title="Nenhum clube aberto"
          text="Crie um clube, marque um jogo avulso, entre com um código ou veja suas comunidades."
        />
        <Button title="Criar clube ou entrar com código" icon="people" onPress={() => router.push('/group-join')} />
        <Button title="Marcar um jogo avulso" icon="flash" variant="secondary" onPress={() => router.push('/single-game')} style={{ marginTop: 10 }} />
      </Screen>
    );
  }

  return <GroupDetail id={activeGroup.id} embedded topExtra={switcher} />;
}
