import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Check,
  Chip,
  Empty,
  Label,
  PositionTag,
  RatingBadge,
  Screen,
  SectionTitle,
  Segmented,
  Stars,
  Stat,
  Tag,
  text,
} from '@/components/ui';
import { useStore } from '@/store';
import { colors, positionColors, teamColors } from '@/theme';
import type { Game, Player } from '@/types';
import { confirm, notify } from '@/utils/confirm';
import { formatGameDate, money, monthKey, parseLocal } from '@/utils/format';
import { displayName, nextPair, teamName } from '@/utils/names';
import { buildRatingMap } from '@/utils/rating';
import { confirmedIds, matchScore, waitlistIds } from '@/utils/stats';
import { drawTeams, teamAverage, teamSizes } from '@/utils/teams';
import { Pitch } from '@/components/Pitch';

const styles = StyleSheet.create({
  benchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  placeHere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
});

type Tab = 'lista' | 'times' | 'placar' | 'pagar' | 'notas';

const TABS: { key: Tab; label: string }[] = [
  { key: 'lista', label: 'Lista' },
  { key: 'times', label: 'Times' },
  { key: 'placar', label: 'Placar' },
  { key: 'pagar', label: 'Pagar' },
  { key: 'notas', label: 'Notas' },
];

export default function GameDetailScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const game = useStore((s) => s.games.find((g) => g.id === id));
  const players = useStore((s) => s.players);
  const games = useStore((s) => s.games);
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === initialTab) ? initialTab! : 'lista');

  const rating = useMemo(() => buildRatingMap(players, games), [players, games]);
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  if (!game) {
    return (
      <Screen>
        <Empty icon="alert-circle-outline" title="Jogo não encontrado" />
      </Screen>
    );
  }

  const confirmed = confirmedIds(game).map((a) => byId[a]).filter(Boolean) as Player[];

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: formatGameDate(game.date),
          headerRight: () => (
            <Pressable onPress={() => router.push(`/game-form/${game.id}`)} hitSlop={10} style={{ marginRight: 8 }}>
              <Ionicons name="create-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      {(!!game.location || !!game.notes) && (
        <View style={{ marginBottom: 12, gap: 4 }}>
          {!!game.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location-outline" size={15} color={colors.muted} />
              <Text style={text.muted}>{game.location}</Text>
            </View>
          )}
          {!!game.notes && <Text style={text.muted}>📝 {game.notes}</Text>}
        </View>
      )}

      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === 'lista' && <Attendance game={game} players={players} rating={rating} />}
      {tab === 'times' && <Teams game={game} attendees={confirmed} byId={byId} rating={rating} />}
      {tab === 'placar' && <Scoreboard game={game} byId={byId} goTeams={() => setTab('times')} />}
      {tab === 'pagar' && <Payments game={game} attendees={confirmed} />}
      {tab === 'notas' && <RateGame game={game} attendees={confirmed} />}
    </Screen>
  );
}

/* ---------------------------- Presença ---------------------------- */

function Attendance({ game, players, rating }: { game: Game; players: Player[]; rating: Record<string, number> }) {
  const toggleAttendee = useStore((s) => s.toggleAttendee);
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const inList = confirmedIds(game);
  const waiting = waitlistIds(game);
  const list = players
    .filter((p) => p.active || game.attendees.includes(p.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));

  const keepers = inList.filter((id) => byId[id]?.position === 'GOL').length;

  const share = () => {
    const line = (id: string, i: number) =>
      byId[id] ? `${i + 1}. ${displayName(byId[id])}${byId[id].position === 'GOL' ? ' 🧤' : ''}` : '';
    const vagas = game.maxPlayers ? ` (${inList.length}/${game.maxPlayers})` : ` (${inList.length})`;
    let msg = `⚽ ${formatGameDate(game.date)}${game.location ? `\n📍 ${game.location}` : ''}\n\nConfirmados${vagas}:\n${inList.map(line).join('\n')}`;
    if (game.maxPlayers && inList.length < game.maxPlayers) {
      msg += `\n\nAinda tem ${game.maxPlayers - inList.length} vaga(s)! Bora? 🙋`;
    }
    if (waiting.length) msg += `\n\n⏳ Lista de espera:\n${waiting.map(line).join('\n')}`;
    Share.share({ message: msg });
  };

  const addAllMonthly = () => {
    players
      .filter((p) => p.active && p.type === 'mensalista' && !game.attendees.includes(p.id))
      .forEach((p) => toggleAttendee(game.id, p.id));
  };

  if (players.length === 0) {
    return (
      <Empty
        icon="people-outline"
        title="Nenhum jogador cadastrado"
        text="Cadastre os jogadores na aba Jogadores para montar a lista."
      />
    );
  }

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <Stat
          label="Confirmados"
          value={game.maxPlayers ? `${inList.length}/${game.maxPlayers}` : String(inList.length)}
          color={colors.primary}
        />
        <Stat label="Espera" value={String(waiting.length)} color={waiting.length ? colors.warning : colors.muted} />
        <Stat label="Goleiros" value={String(keepers)} color={positionColors.GOL} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
        <Button title="Mensalistas" icon="people" variant="secondary" onPress={addAllMonthly} style={{ flex: 1 }} />
        <Button title="Enviar lista" icon="share-social" variant="secondary" onPress={share} style={{ flex: 1 }} />
      </View>

      <SectionTitle>Toque para confirmar / desconfirmar</SectionTitle>
      {list.map((p) => {
        const pos = inList.indexOf(p.id);
        const wait = waiting.indexOf(p.id);
        const on = pos >= 0 || wait >= 0;
        return (
          <Card
            key={p.id}
            onPress={() => toggleAttendee(game.id, p.id)}
            style={pos >= 0 ? { borderColor: colors.primary } : wait >= 0 ? { borderColor: colors.warning } : undefined}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Check checked={on} color={wait >= 0 ? colors.warning : colors.primary} />
              <Text style={[text.title, { flex: 1 }]} numberOfLines={1}>
                {displayName(p)}
              </Text>
              {pos >= 0 && <Text style={[text.muted, { fontWeight: '700' }]}>#{pos + 1}</Text>}
              {wait >= 0 && <Tag label={`ESPERA ${wait + 1}`} color={colors.warning} />}
              <PositionTag position={p.position} />
              <RatingBadge value={rating[p.id]} />
            </View>
          </Card>
        );
      })}
    </>
  );
}

/* ------------------------------ Times ------------------------------ */

function Teams({
  game,
  attendees,
  byId,
  rating,
}: {
  game: Game;
  attendees: Player[];
  byId: Record<string, Player>;
  rating: Record<string, number>;
}) {
  const setTeams = useStore((s) => s.setTeams);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'campo' | 'lista'>('campo');
  const teams = game.teams ?? null;
  const inTeams = new Set(teams?.flat() ?? []);
  const outside = attendees.filter((p) => !inTeams.has(p.id));

  const draw = () => {
    if (attendees.length < 2) return notify('Poucos jogadores', 'Confirme pelo menos 2 jogadores na aba Lista.');
    const doDraw = () => {
      setTeams(game.id, drawTeams(attendees, game.playersPerTeam, rating));
      setSelected(null);
    };
    if (teams?.length) confirm('Sortear de novo?', 'Os times atuais serão substituídos.', doDraw, 'Sortear');
    else doDraw();
  };

  const manual = () => {
    const n = Math.max(2, teamSizes(attendees.length, game.playersPerTeam).length);
    const doIt = () => {
      setTeams(game.id, Array.from({ length: n }, () => []));
      setSelected(null);
    };
    if (teams?.flat().length) confirm('Escalar do zero?', 'Todos voltam para o banco.', doIt, 'Limpar');
    else doIt();
  };

  const tapPlayer = (pid: string) => {
    if (!teams) return;
    if (!selected || selected === pid) return setSelected(selected === pid ? null : pid);
    // Dois do banco: só troca a seleção
    if (!inTeams.has(selected) && !inTeams.has(pid)) return setSelected(pid);
    // Troca os dois de lugar (se um estiver fora dos times, ele entra no lugar do outro)
    setTeams(game.id, teams.map((t) => t.map((x) => (x === selected ? pid : x === pid ? selected : x))));
    setSelected(null);
  };

  const moveTo = (teamIdx: number) => {
    if (!teams || !selected) return;
    const next = teams.map((t) => t.filter((x) => x !== selected));
    next[teamIdx] = [...next[teamIdx], selected];
    setTeams(game.id, next);
    setSelected(null);
  };

  const share = () => {
    if (!teams) return;
    const body = teams
      .map(
        (t, i) =>
          `*${teamName(i)}* (média ${teamAverage(t, rating).toFixed(1)})\n` +
          t.map((id) => `• ${byId[id] ? displayName(byId[id]) : '?'}${byId[id]?.position === 'GOL' ? ' 🧤' : ''}`).join('\n'),
      )
      .join('\n\n');
    Share.share({ message: `⚽ Times - ${formatGameDate(game.date)}\n\n${body}` });
  };

  const addTeam = () => setTeams(game.id, [...(teams ?? []), []]);
  const removeTeam = (i: number) =>
    confirm(`Remover ${teamName(i)}?`, 'Os jogadores dele voltam para o banco.', () =>
      setTeams(game.id, (teams ?? []).filter((_, k) => k !== i)), 'Remover');

  if (!teams?.length) {
    return (
      <>
        <Empty
          icon="shirt-outline"
          title="Monte os times"
          text={`${attendees.length} confirmados, times de ${game.playersPerTeam}. O sorteio equilibra pela nota de cada jogador, pelas posições e distribui os goleiros. Ou escale você mesmo.`}
        />
        <View style={{ gap: 10 }}>
          <Button title="Sortear times equilibrados" icon="shuffle" onPress={draw} disabled={attendees.length < 2} />
          <Button title="Escalar na mão" icon="hand-left-outline" variant="secondary" onPress={manual} disabled={attendees.length < 2} />
        </View>
      </>
    );
  }

  const hint = selected
    ? inTeams.has(selected)
      ? 'Toque em outro jogador para trocar de lugar, ou em "Colocar aqui" em outro time.'
      : 'Agora toque em "Colocar aqui" no time desejado (ou num jogador para trocar).'
    : outside.length
      ? 'Toque num jogador do banco e depois em "Colocar aqui" no time.'
      : 'Toque em um jogador para trocar de time.';

  const bench =
    outside.length > 0 ? (
      <Card style={{ borderColor: colors.warning }}>
        <Text style={[text.title, { marginBottom: 8 }]}>
          🪑 Banco <Text style={text.muted}>· {outside.length} sem time</Text>
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {outside.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => tapPlayer(p.id)}
              style={[styles.benchChip, selected === p.id && { borderColor: colors.primary, backgroundColor: colors.primary + '33' }]}
            >
              <PositionTag position={p.position} />
              <Text style={{ color: colors.text, fontWeight: '700' }}>{displayName(p)}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    ) : null;

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <Button title="Sortear" icon="shuffle" variant="secondary" onPress={draw} style={{ flex: 1, paddingHorizontal: 8 }} />
        <Button title="Escalar" icon="hand-left-outline" variant="secondary" onPress={manual} style={{ flex: 1, paddingHorizontal: 8 }} />
        <Button title="Enviar" icon="share-social" onPress={share} style={{ flex: 1, paddingHorizontal: 8 }} />
      </View>
      <Segmented
        options={[
          { key: 'campo', label: '⚽ Campinho' },
          { key: 'lista', label: '☰ Lista' },
        ]}
        value={view}
        onChange={setView}
      />
      <Text style={[text.muted, { marginBottom: 10 }]}>{hint}</Text>

      {bench}

      {teams.map((t, i) => {
        const color = teamColors[i % teamColors.length];
        const members = t.map((id) => byId[id]).filter(Boolean) as Player[];
        const header = (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
            <Text style={[text.title, { color, flex: 1 }]}>
              {teamName(i)} <Text style={text.muted}>· {t.length}/{game.playersPerTeam}</Text>
            </Text>
            {selected && !t.includes(selected) ? (
              <Pressable onPress={() => moveTo(i)} hitSlop={8} style={styles.placeHere}>
                <Ionicons name="arrow-down-circle" size={16} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>Colocar aqui</Text>
              </Pressable>
            ) : (
              <>
                <RatingBadge value={teamAverage(t, rating)} />
                {t.length === 0 && teams.length > 2 && (
                  <Pressable onPress={() => removeTeam(i)} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
                  </Pressable>
                )}
              </>
            )}
          </View>
        );
        return (
          <Card key={i} style={{ borderLeftWidth: 4, borderLeftColor: color }}>
            {header}
            {view === 'campo' ? (
              <Pitch players={members} color={color} rating={rating} selectedId={selected} onPressPlayer={tapPlayer} />
            ) : (
              t.map((pid) => <PlayerRow key={pid} player={byId[pid]} selected={selected === pid} onPress={() => tapPlayer(pid)} />)
            )}
          </Card>
        );
      })}

      <Button title="Adicionar time" icon="add" variant="ghost" onPress={addTeam} />
    </>
  );
}

function PlayerRow({ player, selected, onPress }: { player?: Player; selected: boolean; onPress: () => void }) {
  if (!player) return null;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
        paddingHorizontal: 6,
        borderRadius: 8,
        backgroundColor: selected ? colors.primary + '33' : 'transparent',
      }}
    >
      <Avatar name={player.name} size={30} color={positionColors[player.position]} />
      <Text style={[text.body, { flex: 1 }]}>{displayName(player)}</Text>
      <PositionTag position={player.position} />
    </Pressable>
  );
}

/* ------------------------------ Placar ------------------------------ */

function Scoreboard({ game, byId, goTeams }: { game: Game; byId: Record<string, Player>; goTeams: () => void }) {
  const addMatch = useStore((s) => s.addMatch);
  const minutes = useStore((s) => s.settings.defaultMatchMinutes);
  const teams = game.teams ?? [];
  const suggested = nextPair(game);
  const [a, setA] = useState(suggested[0]);
  const [b, setB] = useState(suggested[1]);

  if (teams.length < 2) {
    return (
      <>
        <Empty icon="timer-outline" title="Sorteie os times primeiro" text="O placar usa os times sorteados para registrar gols e assistências." />
        <Button title="Ir para Times" icon="shuffle" variant="secondary" onPress={goTeams} />
      </>
    );
  }

  const start = () => {
    if (a === b) return notify('Escolha dois times diferentes');
    const matchId = addMatch(game.id, a, b, minutes);
    router.push(`/match/${game.id}/${matchId}`);
  };

  // Placar geral por time (vitórias)
  const table = teams.map((_, i) => ({ i, w: 0, d: 0, l: 0, gf: 0, ga: 0 }));
  for (const m of game.matches.filter((x) => x.finished)) {
    const [ga, gb] = matchScore(m);
    const A = table[m.teamA];
    const B = table[m.teamB];
    if (!A || !B) continue;
    A.gf += ga; A.ga += gb; B.gf += gb; B.ga += ga;
    if (ga > gb) { A.w++; B.l++; } else if (gb > ga) { B.w++; A.l++; } else { A.d++; B.d++; }
  }
  const sorted = [...table].sort((x, y) => y.w * 3 + y.d - (x.w * 3 + x.d) || y.gf - y.ga - (x.gf - x.ga));

  const scorers: Record<string, number> = {};
  game.matches.forEach((m) => m.goals.forEach((g) => g.playerId && !g.ownGoal && (scorers[g.playerId] = (scorers[g.playerId] ?? 0) + 1)));
  const topScorers = Object.entries(scorers).sort((x, y) => y[1] - x[1]).slice(0, 5);

  return (
    <>
      <Card>
        <Label>Nova partida</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {teams.map((_, i) => (
            <Chip key={'a' + i} label={teamName(i)} selected={a === i} color={teamColors[i % teamColors.length]} onPress={() => setA(i)} />
          ))}
        </View>
        <Text style={[text.muted, { textAlign: 'center', marginVertical: 6, fontWeight: '800' }]}>VS</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {teams.map((_, i) => (
            <Chip key={'b' + i} label={teamName(i)} selected={b === i} color={teamColors[i % teamColors.length]} onPress={() => setB(i)} />
          ))}
        </View>
        <Button title={`Começar (${minutes} min)`} icon="play" onPress={start} />
      </Card>

      {game.matches.length > 0 && <SectionTitle>Partidas</SectionTitle>}
      {game.matches.map((m, idx) => {
        const [ga, gb] = matchScore(m);
        return (
          <Card key={m.id} onPress={() => router.push(`/match/${game.id}/${m.id}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[text.muted, { width: 22 }]}>{idx + 1}ª</Text>
              <Text style={[text.title, { flex: 1, textAlign: 'right', color: teamColors[m.teamA % teamColors.length] }]}>
                {teamName(m.teamA)}
              </Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', minWidth: 64, textAlign: 'center' }}>
                {ga} x {gb}
              </Text>
              <Text style={[text.title, { flex: 1, color: teamColors[m.teamB % teamColors.length] }]}>{teamName(m.teamB)}</Text>
              {!m.finished && <Tag label="AO VIVO" color={colors.danger} />}
            </View>
          </Card>
        );
      })}

      {game.matches.some((m) => m.finished) && (
        <>
          <SectionTitle>Classificação do dia</SectionTitle>
          <Card>
            {sorted.map((r, pos) => (
              <View key={r.i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 }}>
                <Text style={[text.muted, { width: 20 }]}>{pos + 1}º</Text>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: teamColors[r.i % teamColors.length] }} />
                <Text style={[text.body, { flex: 1 }]}>{teamName(r.i)}</Text>
                <Text style={text.muted}>
                  {r.w}V {r.d}E {r.l}D · {r.gf}:{r.ga}
                </Text>
                <Text style={{ color: colors.primary, fontWeight: '800', width: 34, textAlign: 'right' }}>{r.w * 3 + r.d}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {topScorers.length > 0 && (
        <>
          <SectionTitle>Artilharia do dia</SectionTitle>
          <Card>
            {topScorers.map(([pid, n]) => (
              <View key={pid} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
                <Text style={text.body}>⚽ {byId[pid] ? displayName(byId[pid]) : '?'}</Text>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{n}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

/* --------------------------- Pagamentos --------------------------- */

function Payments({ game, attendees }: { game: Game; attendees: Player[] }) {
  const togglePaid = useStore((s) => s.togglePaid);
  const toggleMonthly = useStore((s) => s.toggleMonthly);
  const month = monthKey(parseLocal(game.date));
  const monthlyPaid = useStore((s) => s.monthly[month]) ?? [];

  const avulsos = attendees.filter((p) => p.type === 'avulso');
  const mensalistas = attendees.filter((p) => p.type === 'mensalista');
  const received = avulsos.filter((p) => game.paid.includes(p.id)).length * game.pricePerPlayer;
  const expected = avulsos.length * game.pricePerPlayer;

  if (!attendees.length) {
    return <Empty icon="cash-outline" title="Ninguém confirmado ainda" text="Confirme a presença para controlar os pagamentos." />;
  }

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
        <Stat label="Recebido" value={money(received)} color={colors.primary} />
        <Stat label="Falta" value={money(expected - received)} color={expected > received ? colors.warning : colors.muted} />
      </View>

      {avulsos.length > 0 && <SectionTitle>Avulsos · {money(game.pricePerPlayer)}</SectionTitle>}
      {avulsos.map((p) => {
        const paid = game.paid.includes(p.id);
        return (
          <Card key={p.id} onPress={() => togglePaid(game.id, p.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Check checked={paid} />
              <Text style={[text.title, { flex: 1 }]}>{displayName(p)}</Text>
              <Tag label={paid ? 'PAGO' : 'PENDENTE'} color={paid ? colors.primary : colors.warning} />
            </View>
          </Card>
        );
      })}

      {mensalistas.length > 0 && <SectionTitle>Mensalistas · mensalidade do mês</SectionTitle>}
      {mensalistas.map((p) => {
        const paid = monthlyPaid.includes(p.id);
        return (
          <Card key={p.id} onPress={() => toggleMonthly(month, p.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Check checked={paid} />
              <Text style={[text.title, { flex: 1 }]}>{displayName(p)}</Text>
              <Tag label={paid ? 'MÊS PAGO' : 'MÊS EM ABERTO'} color={paid ? colors.primary : colors.danger} />
            </View>
          </Card>
        );
      })}
    </>
  );
}

/* ---------------------------- Avaliação ---------------------------- */

function RateGame({ game, attendees }: { game: Game; attendees: Player[] }) {
  const ratePlayer = useStore((s) => s.ratePlayer);
  const setMvp = useStore((s) => s.setMvp);
  const rated = attendees.filter((p) => game.ratings[p.id]).length;

  if (!attendees.length) {
    return <Empty icon="star-outline" title="Ninguém para avaliar" text="Confirme quem jogou na aba Lista." />;
  }

  return (
    <>
      <Text style={[text.muted, { marginBottom: 12 }]}>
        Dê nota de 1 a 5 para a atuação de cada um e toque no troféu para eleger o craque do jogo. As notas entram na
        média usada nos próximos sorteios. ({rated}/{attendees.length} avaliados)
      </Text>
      {attendees.map((p) => {
        const isMvp = game.mvp === p.id;
        return (
          <Card key={p.id} style={isMvp && { borderColor: colors.gold }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => setMvp(game.id, isMvp ? null : p.id)} hitSlop={8}>
                <Ionicons name={isMvp ? 'trophy' : 'trophy-outline'} size={22} color={isMvp ? colors.gold : colors.border} />
              </Pressable>
              <Text style={[text.title, { flex: 1 }]} numberOfLines={1}>
                {displayName(p)}
              </Text>
              <Stars value={game.ratings[p.id] ?? 0} onChange={(v) => ratePlayer(game.id, p.id, v)} size={24} />
            </View>
          </Card>
        );
      })}
    </>
  );
}
