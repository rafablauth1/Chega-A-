import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Card, SectionTitle, Stat, text } from '@/components/ui';
import { colors, fonts } from '@/theme';
import { SKILLS, type Game, type Player } from '@/types';
import { liveSkills, seasonScores } from '@/utils/scoring';

/**
 * Atributos atualizados pelos jogos + pontuação estilo Cartola do jogador.
 * Sem jogos avaliados, mostra só os atributos do perfil e o aviso "Sem avaliações ainda".
 */
export function LiveAttributes({ player, games }: { player: Player; games: Game[] }) {
  const live = useMemo(() => liveSkills(player, games), [player, games]);
  const season = useMemo(
    () => seasonScores(games, (id) => (id === player.id ? player.position : undefined))[player.id],
    [games, player],
  );

  return (
    <>
      <SectionTitle>Pontuação</SectionTitle>
      {season ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Stat label="Total" value={season.total.toFixed(1)} color={colors.primary} />
          <Stat label="Média" value={season.average.toFixed(1)} />
          <Stat label="Nota galera" value={season.nota === null ? '—' : season.nota.toFixed(1)} />
        </View>
      ) : (
        <Card>
          <Text style={text.body}>Sem avaliações ainda</Text>
          <Text style={text.muted}>A pontuação aparece depois que um jogo é encerrado e a galera avalia.</Text>
        </Card>
      )}
      {season && (season.craques > 0 || season.bagres > 0) && (
        <Text style={[text.muted, { marginBottom: 8 }]}>
          🏆 Craque do time {season.craques}x · 🐟 Bagre {season.bagres}x
        </Text>
      )}

      <SectionTitle>Atributos</SectionTitle>
      <Card style={{ gap: 8 }}>
        {SKILLS.map((s) => {
          const base = player.skills[s.key];
          const now = live.skills[s.key];
          const diff = Math.round((now - base) * 10) / 10;
          return (
            <View key={s.key} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={text.body}>{s.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {diff !== 0 && (
                    <Ionicons name={diff > 0 ? 'arrow-up' : 'arrow-down'} size={14} color={diff > 0 ? colors.success : colors.danger} />
                  )}
                  <Text style={{ color: colors.text, fontFamily: fonts.bold }}>{(now * 2).toFixed(1)}</Text>
                </View>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
                <View style={{ height: 6, borderRadius: 3, width: `${(now / 5) * 100}%`, backgroundColor: colors.primary }} />
              </View>
            </View>
          );
        })}
        <Text style={[text.muted, { fontSize: 13 }]}>
          {live.games
            ? `Atualizados pelos últimos ${live.games} jogos avaliados (${Math.round(live.weight * 100)}% desempenho, o resto é o perfil).`
            : 'Ainda iguais ao perfil. Vão mudando conforme a galera avalia os jogos.'}
        </Text>
      </Card>
    </>
  );
}
