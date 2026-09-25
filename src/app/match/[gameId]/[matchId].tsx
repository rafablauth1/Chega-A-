import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Button, Card, Empty, Screen, SectionTitle, text } from '@/components/ui';
import { useStore } from '@/store';
import { colors, teamColors } from '@/theme';
import type { Player } from '@/types';
import { confirm } from '@/utils/confirm';
import { displayName, teamName } from '@/utils/names';
import { matchScore } from '@/utils/stats';

/** Cronômetros vivem fora do componente para não zerar ao sair e voltar da tela. */
const clocks: Record<string, { base: number; startedAt: number | null }> = {};

const fmt = (s: number) => {
  const sign = s < 0 ? '+' : '';
  const a = Math.abs(s);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(Math.floor(a % 60)).padStart(2, '0')}`;
};

type Step = { team: number; stage: 'scorer' } | { team: number; stage: 'assist'; scorer: string | null; ownGoal: boolean };

export default function MatchScreen() {
  const { gameId, matchId } = useLocalSearchParams<{ gameId: string; matchId: string }>();
  const game = useStore((s) => s.games.find((g) => g.id === gameId));
  const players = useStore((s) => s.players);
  const { addGoal, removeGoal, finishMatch, removeMatch } = useStore.getState();
  const match = game?.matches.find((m) => m.id === matchId);

  const clock = (clocks[matchId] ??= { base: 0, startedAt: null });
  const [, tick] = useState(0);
  const [step, setStep] = useState<Step | null>(null);
  const buzzed = useRef(false);

  const elapsed = clock.base + (clock.startedAt ? (Date.now() - clock.startedAt) / 1000 : 0);
  const running = clock.startedAt !== null;
  const total = (match?.durationMin ?? 10) * 60;
  const remaining = total - elapsed;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (remaining <= 0 && running && !buzzed.current) {
      buzzed.current = true;
      Vibration.vibrate([0, 600, 300, 600, 300, 600]);
    }
  });

  if (!game || !match) {
    return (
      <Screen>
        <Empty icon="alert-circle-outline" title="Partida não encontrada" />
      </Screen>
    );
  }

  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const roster = (t: number) => (game.teams?.[t] ?? []).map((id) => byId[id]).filter(Boolean) as Player[];
  const [ga, gb] = matchScore(match);
  const colorA = teamColors[match.teamA % teamColors.length];
  const colorB = teamColors[match.teamB % teamColors.length];

  const toggleClock = () => {
    if (running) {
      clock.base = elapsed;
      clock.startedAt = null;
    } else {
      clock.startedAt = Date.now();
    }
    tick((n) => n + 1);
  };
  const resetClock = () => {
    clock.base = 0;
    clock.startedAt = null;
    buzzed.current = false;
    tick((n) => n + 1);
  };

  const save = (assistId: string | null) => {
    if (!step || step.stage !== 'assist') return;
    addGoal(game.id, match.id, {
      team: step.team,
      playerId: step.scorer,
      assistId,
      ownGoal: step.ownGoal,
      minute: Math.round(elapsed),
    });
    setStep(null);
  };

  const finish = () => {
    finishMatch(game.id, match.id, true);
    clock.startedAt = null;
    router.back();
  };

  const remove = () =>
    confirm('Excluir partida', 'Apagar esta partida e seus gols?', () => {
      delete clocks[match.id];
      removeMatch(game.id, match.id);
      router.back();
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: match.finished ? 'Partida encerrada' : 'Partida ao vivo' }} />

      {/* Placar */}
      <Card style={{ paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.team, { color: colorA }]}>{teamName(match.teamA)}</Text>
          <Text style={styles.score}>
            {ga} <Text style={{ color: colors.muted }}>x</Text> {gb}
          </Text>
          <Text style={[styles.team, { color: colorB }]}>{teamName(match.teamB)}</Text>
        </View>

        {!match.finished && (
          <>
            <Text style={[styles.clock, remaining <= 0 && { color: colors.danger }]}>
              {remaining > 0 ? fmt(remaining) : `FIM ${fmt(remaining)}`}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
              <Pressable onPress={resetClock} hitSlop={10}>
                <Ionicons name="refresh" size={28} color={colors.muted} />
              </Pressable>
              <Pressable onPress={toggleClock} style={styles.play}>
                <Ionicons name={running ? 'pause' : 'play'} size={30} color={colors.onPrimary} />
              </Pressable>
              <View style={{ width: 28 }} />
            </View>
          </>
        )}
      </Card>

      {/* Registrar gol */}
      {!match.finished && !step && (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
          <Button title={`Gol ${teamName(match.teamA)}`} icon="football" onPress={() => setStep({ team: match.teamA, stage: 'scorer' })} style={{ flex: 1, backgroundColor: colorA, borderColor: colorA }} />
          <Button title={`Gol ${teamName(match.teamB)}`} icon="football" onPress={() => setStep({ team: match.teamB, stage: 'scorer' })} style={{ flex: 1, backgroundColor: colorB, borderColor: colorB }} />
        </View>
      )}

      {step && (
        <Card style={{ borderColor: colors.primary }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={text.title}>{step.stage === 'scorer' ? 'Quem fez o gol?' : 'Quem deu a assistência?'}</Text>
            <Pressable onPress={() => setStep(null)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {step.stage === 'scorer' ? (
              <>
                {roster(step.team).map((p) => (
                  <PickChip key={p.id} label={displayName(p)} onPress={() => setStep({ team: step.team, stage: 'assist', scorer: p.id, ownGoal: false })} />
                ))}
                <PickChip label="Não sei" muted onPress={() => setStep({ team: step.team, stage: 'assist', scorer: null, ownGoal: false })} />
                {/* Gol contra: jogador do adversário */}
                {roster(step.team === match.teamA ? match.teamB : match.teamA).length > 0 && (
                  <Text style={[text.muted, { width: '100%', marginTop: 6 }]}>Gol contra de:</Text>
                )}
                {roster(step.team === match.teamA ? match.teamB : match.teamA).map((p) => (
                  <PickChip key={'og' + p.id} label={displayName(p)} muted onPress={() => {
                    addGoal(game.id, match.id, { team: step.team, playerId: p.id, ownGoal: true, minute: Math.round(elapsed) });
                    setStep(null);
                  }} />
                ))}
              </>
            ) : (
              <>
                {roster(step.team)
                  .filter((p) => p.id !== step.scorer)
                  .map((p) => (
                    <PickChip key={p.id} label={displayName(p)} onPress={() => save(p.id)} />
                  ))}
                <PickChip label="Sem assistência" muted onPress={() => save(null)} />
              </>
            )}
          </View>
        </Card>
      )}

      {/* Lance a lance */}
      {match.goals.length > 0 && <SectionTitle>Gols</SectionTitle>}
      {[...match.goals].reverse().map((g) => {
        const scorer = g.playerId ? byId[g.playerId] : null;
        const assist = g.assistId ? byId[g.assistId] : null;
        return (
          <Card key={g.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={[text.muted, { width: 44 }]}>{g.minute !== undefined ? fmt(g.minute) : ''}</Text>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: teamColors[g.team % teamColors.length] }} />
              <View style={{ flex: 1 }}>
                <Text style={text.title}>
                  ⚽ {scorer ? displayName(scorer) : 'Gol'}
                  {g.ownGoal ? ' (contra)' : ''}
                </Text>
                {assist && <Text style={text.muted}>Assistência: {displayName(assist)}</Text>}
              </View>
              <Pressable hitSlop={10} onPress={() => confirm('Apagar gol', 'Remover este gol do placar?', () => removeGoal(game.id, match.id, g.id), 'Apagar')}>
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </Pressable>
            </View>
          </Card>
        );
      })}

      <View style={{ marginTop: 16, gap: 12 }}>
        {match.finished ? (
          <Button title="Reabrir partida" icon="lock-open-outline" variant="secondary" onPress={() => finishMatch(game.id, match.id, false)} />
        ) : (
          <Button title="Encerrar partida" icon="flag" onPress={finish} />
        )}
        <Button title="Excluir partida" icon="trash-outline" variant="danger" onPress={remove} />
      </View>
    </Screen>
  );
}

function PickChip({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pick,
        muted && { backgroundColor: 'transparent' },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={{ color: muted ? colors.muted : colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  team: { flex: 1, textAlign: 'center', fontWeight: '800', fontSize: 16 },
  score: { color: colors.text, fontSize: 48, fontWeight: '900', minWidth: 130, textAlign: 'center' },
  clock: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 12,
    fontVariant: ['tabular-nums'],
  },
  play: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pick: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
