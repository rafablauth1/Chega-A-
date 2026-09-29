import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Chip, text } from '@/components/ui';
import { useAuth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';
import type { Game, Player } from '@/types';
import { confirm } from '@/utils/confirm';
import { displayName } from '@/utils/names';
import { useScoreControl } from '@/utils/scorekeeper';

/** "Quem marca o placar" + passar a vez para outro admin (ou o dono assumir). */
export function ScorekeeperCard({ game, byId }: { game: Game; byId: Record<string, Player> }) {
  const { session, activeGroup } = useAuth();
  const sc = useScoreControl(game);
  const [admins, setAdmins] = useState<string[]>([]);
  const me = session?.user.id ?? '';

  useEffect(() => {
    if (!sc.enabled || !activeGroup) return;
    supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', activeGroup.id)
      .in('role', ['owner', 'admin'])
      .then(({ data }) => setAdmins((data ?? []).map((r: any) => r.user_id)));
  }, [sc.enabled, activeGroup?.id]);

  if (!sc.enabled) return null;

  const name = (id: string | null) => (id ? (id === me ? 'Você' : byId[id] ? displayName(byId[id]) : 'Um admin') : null);
  const others = admins.filter((id) => id !== sc.keeper);

  const pass = (id: string) =>
    confirm(
      id === me ? 'Assumir o placar' : 'Passar o placar',
      id === me
        ? 'Você passa a marcar gols, cronômetro e fim das partidas deste jogo.'
        : `${name(id)} passa a marcar o placar. Você só vai acompanhar.`,
      () => sc.passTo(id),
      id === me ? 'Assumir' : 'Passar',
    );

  return (
    <Card style={{ gap: 8, borderColor: sc.isKeeper ? colors.primary : colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="mic" size={20} color={sc.isKeeper ? colors.primary : colors.muted} />
        <Text style={[text.title, { flex: 1 }]}>
          {sc.keeper ? `Marcador do placar: ${name(sc.keeper)}` : 'Ninguém marcando o placar ainda'}
        </Text>
      </View>
      <Text style={text.muted}>
        {sc.keeper
          ? sc.isKeeper
            ? 'Só você marca gols, cronômetro e fim das partidas. Pode passar a vez a qualquer momento.'
            : 'Só o marcador mexe no placar; os outros acompanham ao vivo.'
          : 'O primeiro admin que começar uma partida vira o marcador.'}
      </Text>
      {sc.canTransfer && others.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {others.map((id) => (
            <Chip key={id} label={id === me ? 'Assumir eu' : `Passar para ${name(id)}`} onPress={() => pass(id)} />
          ))}
        </View>
      )}
    </Card>
  );
}
