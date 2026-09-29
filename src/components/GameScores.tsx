import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { reloadGroup } from '@/cloud';
import { Pressable, Text, View } from 'react-native';
import { Avatar, Button, Card, SectionTitle, ScorePicker, Tag, text } from '@/components/ui';
import { useAuth, useCanManage } from '@/auth';
import { useScoreControl } from '@/utils/scorekeeper';
import { SCORING } from '@/config/scoring';
import { isCloudEnabled } from '@/lib/supabase';
import { useStore } from '@/store';
import { colors, fonts, positionColors, teamColors } from '@/theme';
import type { Game, Player } from '@/types';
import { confirm, notify } from '@/utils/confirm';
import { displayName, teamName } from '@/utils/names';
import { scoreColor } from '@/utils/rating';
import { participantsOf, scoreGame, voteStatus, type PlayerGameScore } from '@/utils/scoring';

const n1 = (n: number) => n.toFixed(1).replace('.', ',');
const n2 = (n: number) => n.toFixed(2).replace('.', ',');

/**
 * Aba "Notas" do jogo: encerrar o jogo, avaliar a galera (24 h) e a pontuação estilo Cartola.
 * Sem conta (modo local) ou com servidor antigo (sem a migração 011), a nota é dada pelo organizador.
 */
export function GameScores({ game, byId }: { game: Game; byId: Record<string, Player> }) {
  const { session } = useAuth();
  const canManage = useCanManage();
  const sc = useScoreControl(game);
  const closeGame = useStore((s) => s.closeGame);
  const ratePlayer = useStore((s) => s.ratePlayer);
  const setMvp = useStore((s) => s.setMvp);
  const [open, setOpen] = useState<string | null>(null);

  const me = session?.user.id ?? '';
  // Votação da galera só com conta e com o servidor já atualizado (a coluna closed_at vem da migração 011)
  const peerVoting = isCloudEnabled ? 'closedAt' in game : true;
  const organizerRates = !isCloudEnabled || !peerVoting;
  const status = voteStatus(game);
  const participants = participantsOf(game);
  const iPlayed = !!game.teams?.some((t) => t.includes(me));

  // Os votos são secretos e não chegam em tempo real: busca a soma atualizada ao abrir a aba
  useEffect(() => {
    if (isCloudEnabled && peerVoting && game.closedAt) reloadGroup();
  }, [peerVoting, game.closedAt]);

  const scores = useMemo(() => scoreGame(game, (id) => byId[id]?.position), [game, byId]);
  const rows = useMemo(
    () =>
      participants
        .map((id) => ({ p: byId[id], s: scores[id] }))
        .filter((r): r is { p: Player; s: PlayerGameScore } => !!r.p && !!r.s)
        .sort((a, b) => (b.s.points ?? -1) - (a.s.points ?? -1)),
    [participants, byId, scores],
  );

  const askClose = () => {
    if (!game.teams?.length) return notify('Monte os times antes', 'A avaliação separa votos de companheiros e de adversários, então precisa dos times.');
    confirm(
      'Encerrar o jogo',
      `As partidas em aberto serão finalizadas e a galera terá ${SCORING.votes.windowHours} horas para avaliar todo mundo que jogou.`,
      () => closeGame(game.id),
      'Encerrar',
    );
  };

  return (
    <>
      {/* Situação da avaliação */}
      {!organizerRates && (
        <Card style={{ gap: 10, borderColor: status.state === 'open' ? colors.primary : colors.border }}>
          {status.state === 'not-closed' && (
            <>
              <Text style={text.title}>Avaliação da galera</Text>
              <Text style={text.muted}>
                {sc.canScore
                  ? `Terminou a pelada? Encerre o jogo para liberar a avaliação por ${SCORING.votes.windowHours} horas.`
                  : canManage
                    ? 'Quem encerra o jogo é o marcador do placar (ele finaliza as partidas). O dono pode assumir na aba Placar.'
                    : 'A avaliação abre quando o organizador encerrar o jogo.'}
              </Text>
              {sc.canScore && <Button title="Encerrar jogo e abrir avaliação" icon="flag" onPress={askClose} />}
            </>
          )}
          {status.state === 'open' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={[text.title, { flex: 1 }]}>Avaliação aberta · faltam {status.hoursLeft}h</Text>
              </View>
              <Text style={text.muted}>
                {game.voters ?? 0} de {participants.length} já votaram. Todo mundo que jogou avalia todo mundo. A pontuação abaixo
                é parcial até o prazo acabar.
              </Text>
              {iPlayed && (
                <Button
                  title="Avaliar a galera"
                  icon="star"
                  onPress={() => router.push({ pathname: '/rate/[gameId]', params: { gameId: game.id } })}
                />
              )}
            </>
          )}
          {status.state === 'finished' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-done" size={20} color={colors.success} />
              <Text style={[text.body, { flex: 1 }]}>Avaliação encerrada · {game.voters ?? 0} pessoas votaram</Text>
            </View>
          )}
        </Card>
      )}

      <SectionTitle>{status.state === 'open' ? 'Pontuação parcial' : 'Pontuação da rodada'}</SectionTitle>
      {organizerRates && (
        <Text style={[text.muted, { marginBottom: 10 }]}>
          Dê a nota de 1 a 10 de cada um. A pontuação soma vitória, gols, assistências, defesa e o craque e o bagre de cada time.
        </Text>
      )}

      {rows.map(({ p, s }) => {
        const expanded = open === p.id;
        const tColor = s.team !== null ? teamColors[s.team % teamColors.length] : colors.muted;
        return (
          <Card key={p.id} onPress={() => setOpen(expanded ? null : p.id)} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={p.name} photo={p.photo} size={36} color={positionColors[p.position]} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={text.title} numberOfLines={1}>
                    {displayName(p)}
                  </Text>
                  {s.highlight === 'craque' && <Tag label="🏆 Craque do time" color={colors.gold} />}
                  {s.highlight === 'bagre' && <Tag label="🐟 Bagre" color={colors.muted} />}
                </View>
                <Text style={text.muted}>
                  {s.team !== null ? teamName(s.team) : 'Sem time'} · {p.position}
                  {s.goals ? ` · ⚽${s.goals}` : ''}
                  {s.assists ? ` · 🅰️${s.assists}` : ''}
                </Text>
              </View>
              {s.points !== null ? (
                <Text style={{ color: scoreColor(Math.min(10, s.points)), fontFamily: fonts.displayBlack, fontSize: 22 }}>{n1(s.points)}</Text>
              ) : (
                <Tag label="Sem avaliação" color={colors.muted} />
              )}
              {canManage && (
                <Pressable onPress={() => setMvp(game.id, game.mvp === p.id ? null : p.id)} hitSlop={8} accessibilityLabel="Craque do jogo">
                  <Ionicons name={game.mvp === p.id ? 'trophy' : 'trophy-outline'} size={20} color={game.mvp === p.id ? colors.gold : colors.border} />
                </Pressable>
              )}
            </View>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: tColor, opacity: 0.6 }} />

            {expanded && <Breakdown s={s} />}
            {organizerRates && canManage && (
              <ScorePicker value={game.ratings[p.id] ?? 0} onChange={(v) => ratePlayer(game.id, p.id, v)} />
            )}
          </Card>
        );
      })}

      <HowItWorks />
    </>
  );
}

/** A conta aberta: nota × resultado × scout × destaque. */
function Breakdown({ s }: { s: PlayerGameScore }) {
  const line = (label: string, value: string, hint?: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Text style={[text.muted, { flex: 1 }]}>
        {label}
        {hint ? <Text style={{ fontSize: 12 }}>{`  ${hint}`}</Text> : null}
      </Text>
      <Text style={[text.body, { fontFamily: fonts.bold }]}>{value}</Text>
    </View>
  );
  const result = s.wins + s.draws + s.losses ? `${s.wins}V ${s.draws}E ${s.losses}D` : 'sem partidas encerradas';
  return (
    <View style={{ gap: 4, backgroundColor: colors.cardAlt, padding: 10, borderRadius: 10 }}>
      {line(
        'Nota da galera',
        s.nota === null ? '—' : n1(s.nota),
        s.source === 'galera' ? `${s.votes} votos` : s.source === 'organizador' ? 'do organizador' : 'ninguém avaliou ainda',
      )}
      {line('× Resultado', n2(s.resultMult), result)}
      {line('× Scout', n2(s.scoutFactor), `${n1(s.scoutPoints)} pts · ⚽${s.goals} 🅰️${s.assists} 🛡️${n1(s.defense)}`)}
      {line('× Destaque', n2(s.highlightMult), s.highlight === 'craque' ? 'craque do time' : s.highlight === 'bagre' ? 'bagre do time' : '')}
      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />
      {line('= Pontuação', s.points === null ? '—' : n1(s.points))}
    </View>
  );
}

function HowItWorks() {
  const [show, setShow] = useState(false);
  const S = SCORING;
  const pos = S.scout.byPosition;
  return (
    <Card onPress={() => setShow(!show)} style={{ marginTop: 8, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="help-circle-outline" size={20} color={colors.muted} />
        <Text style={[text.body, { flex: 1 }]}>Como a pontuação funciona</Text>
        <Ionicons name={show ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </View>
      {show &&
        [
          `Nota da galera: todo mundo que jogou avalia todo mundo (0 a 10) em até ${S.votes.windowHours}h depois que o jogo é encerrado. Voto de companheiro vale ×${S.votes.ownTeamWeight}, de adversário ×${S.votes.opponentWeight}.`,
          `Resultado: vitória ×${S.result.win}, empate ×${S.result.draw}, derrota ×${S.result.loss} (média das partidas do dia).`,
          `Scout: gol ${S.scout.goal} pt, assistência ${S.scout.assist} pt; defesa por partida: ${S.scout.concededPoints.join(' / ')} pts com 0 / 1 / 2 / 3+ gols sofridos. Cada ponto aumenta a nota em ${S.scout.factorPerPoint * 100}%.`,
          `Por posição: atacante ${pos.ATA.attack}× ataque; meia ${pos.MEI.attack}× ataque + ${pos.MEI.defense}× defesa; zagueiro e goleiro ${pos.ZAG.defense}× defesa e gol/assistência valendo ×${pos.ZAG.attack}.`,
          `Destaque: o maior de cada time é o craque (×${S.highlight.craque}) e o menor é o bagre (×${S.highlight.bagre}).`,
          'Os atributos do jogador (técnica, físico, passe, finalização, defesa) vão se ajustando com essas pontuações.',
        ].map((t) => (
          <Text key={t} style={text.muted}>
            • {t}
          </Text>
        ))}
    </Card>
  );
}
