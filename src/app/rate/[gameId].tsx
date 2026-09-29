import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, Button, Card, Empty, Screen, SectionTitle, ScorePicker, Tag, text } from '@/components/ui';
import { useAuth } from '@/auth';
import { SCORING } from '@/config/scoring';
import { reloadGroup } from '@/cloud';
import { useStore } from '@/store';
import { colors, fonts, positionColors, teamColors } from '@/theme';
import type { Player } from '@/types';
import { notify } from '@/utils/confirm';
import { displayName, teamName } from '@/utils/names';
import { teamOf, voteStatus } from '@/utils/scoring';
import { myVotes, submitVotes, voteError } from '@/votes';

/** Avaliar todo mundo que jogou (menos você), dentro do prazo depois que o jogo foi encerrado. */
export default function RateScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { session, activeGroup } = useAuth();
  const game = useStore((s) => s.games.find((g) => g.id === gameId));
  const players = useStore((s) => s.players);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const me = session?.user.id ?? '';
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  useEffect(() => {
    if (!gameId || !me) return;
    myVotes(gameId, me)
      .then((v) => {
        setScores(v);
        setSent(Object.keys(v).length > 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId, me]);

  if (!game || !activeGroup) {
    return (
      <Screen>
        <Empty icon="alert-circle-outline" title="Jogo não encontrado" />
      </Screen>
    );
  }

  const status = voteStatus(game);
  const myTeam = teamOf(game, me);
  const others = (game.teams ?? [])
    .flatMap((t, i) => t.map((id) => ({ id, team: i })))
    .filter((x) => x.id !== me && byId[x.id]);
  const mates = others.filter((x) => x.team === myTeam);
  const rivals = others.filter((x) => x.team !== myTeam);
  const missing = others.filter((x) => !scores[x.id]).length;

  if (myTeam === null) {
    return (
      <Screen>
        <Empty icon="football-outline" title="Você não jogou esta pelada" text="Só quem esteve em um dos times avalia." />
      </Screen>
    );
  }
  if (status.state !== 'open') {
    return (
      <Screen>
        <Empty
          icon="time-outline"
          title={status.state === 'finished' ? 'Prazo encerrado' : 'Avaliação ainda fechada'}
          text={status.state === 'finished' ? `A avaliação fica aberta por ${SCORING.votes.windowHours}h depois do jogo.` : 'Ela abre quando o organizador encerrar o jogo.'}
        />
      </Screen>
    );
  }

  const send = async () => {
    if (missing) return notify('Faltam notas', `Avalie todo mundo que jogou: falta${missing > 1 ? 'm' : ''} ${missing}.`);
    setBusy(true);
    try {
      await submitVotes(game.id, activeGroup.id, me, scores);
      setSent(true);
      reloadGroup();
      notify('Notas enviadas ✅', `Você pode corrigir até o prazo acabar (faltam ${status.hoursLeft}h). Ninguém vê a nota que você deu.`);
      router.back();
    } catch (e: any) {
      notify('Não deu certo', voteError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const row = ({ id, team }: { id: string; team: number }) => {
    const p = byId[id] as Player;
    return (
      <Card key={id} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={p.name} photo={p.photo} size={36} color={positionColors[p.position]} />
          <View style={{ flex: 1 }}>
            <Text style={text.title} numberOfLines={1}>
              {displayName(p)}
            </Text>
            <Text style={text.muted}>
              {teamName(team)} · {p.position}
            </Text>
          </View>
          {scores[id] ? (
            <Text style={{ color: colors.text, fontFamily: fonts.displayBlack, fontSize: 20 }}>{scores[id]}</Text>
          ) : (
            <Tag label="Falta" color={colors.warning} />
          )}
        </View>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: teamColors[team % teamColors.length], opacity: 0.5 }} />
        <ScorePicker value={scores[id] ?? 0} onChange={(v) => setScores((s) => ({ ...s, [id]: v }))} />
      </Card>
    );
  };

  return (
    <Screen>
      <Card style={{ gap: 6, borderColor: colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <Text style={[text.title, { flex: 1 }]}>Faltam {status.hoursLeft}h para votar</Text>
        </View>
        <Text style={text.muted}>
          Dê de 1 a 10 para a atuação de cada um. Seu voto é secreto. Voto em companheiro vale ×{SCORING.votes.ownTeamWeight} e em
          adversário ×{SCORING.votes.opponentWeight}.
        </Text>
        {sent && <Text style={[text.muted, { color: colors.success }]}>Você já votou. Pode corrigir até o prazo acabar.</Text>}
        <Text style={{ color: colors.primary, fontFamily: fonts.semibold }} onPress={() => router.push('/scoring-help')}>
          Como isso vira a nota final?
        </Text>
      </Card>

      {loading ? null : (
        <>
          {mates.length > 0 && <SectionTitle>Seu time</SectionTitle>}
          {mates.map(row)}
          {rivals.length > 0 && <SectionTitle>Adversários</SectionTitle>}
          {rivals.map(row)}
          <Button
            title={busy ? 'Enviando...' : missing ? `Falta avaliar ${missing}` : sent ? 'Salvar correções' : 'Enviar notas'}
            icon="send"
            onPress={send}
            disabled={busy}
            style={{ marginTop: 12 }}
          />
        </>
      )}
    </Screen>
  );
}
