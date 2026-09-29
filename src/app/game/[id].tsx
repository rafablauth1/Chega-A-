import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
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
  Stat,
  Tag,
  text,
} from '@/components/ui';
import { useAuth, useCanManage } from '@/auth';
import { useStore } from '@/store';
import { colors, fonts, positionColors, teamColors } from '@/theme';
import type { Game, Player } from '@/types';
import { confirm, notify } from '@/utils/confirm';
import { formatGameDate, formatShortDate, gameEndTime, gameTimeRange, money, monthKey, parseLocal } from '@/utils/format';
import { isMensalista, useMonthlyOn } from '@/utils/monthly';
import { isCloudEnabled } from '@/lib/supabase';
import { PixCard } from '@/components/PixCard';
import { displayName, nextPair, teamName } from '@/utils/names';
import { buildRatingMap } from '@/utils/rating';
import { confirmedIds, matchScore, waitlistIds } from '@/utils/stats';
import { drawTeams, teamAverage, teamSizes } from '@/utils/teams';
import { GameScores } from '@/components/GameScores';
import { ScorekeeperCard } from '@/components/ScorekeeperCard';
import { useScoreControl } from '@/utils/scorekeeper';
import { Pitch } from '@/components/Pitch';
import { shareView } from '@/utils/share';
import { roundSelection, summaryText } from '@/utils/selection';

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
  const { id, tab: initialTab, group } = useLocalSearchParams<{ id: string; tab?: Tab; group?: string }>();
  const { activeGroup, setActiveGroup } = useAuth();
  const [waited, setWaited] = useState(false);
  // Veio de outro clube (lista da tela inicial / convite): abre aquele clube e espera os dados chegarem
  useEffect(() => {
    if (group && activeGroup?.id !== group) setActiveGroup(group);
    const t = setTimeout(() => setWaited(true), 8000);
    return () => clearTimeout(t);
  }, [group]);
  const game = useStore((s) => s.games.find((g) => g.id === id));
  const players = useStore((s) => s.players);
  const games = useStore((s) => s.games);
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === initialTab) ? initialTab! : 'lista');
  const canManage = useCanManage();
  const defaultMatchMinutes = useStore((s) => s.settings.defaultMatchMinutes);

  const rating = useMemo(() => buildRatingMap(players, games), [players, games]);
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  if (!game) {
    return (
      <Screen>
        {group && !waited ? (
          <View style={{ paddingTop: 80, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={text.muted}>Abrindo o jogo...</Text>
          </View>
        ) : (
          <Empty icon="alert-circle-outline" title="Jogo não encontrado" />
        )}
      </Screen>
    );
  }

  const confirmed = confirmedIds(game).map((a) => byId[a]).filter(Boolean) as Player[];

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: formatGameDate(game.date),
          headerRight: canManage
            ? () => (
                <Pressable onPress={() => router.push(`/game-form/${game.id}`)} hitSlop={10} style={{ marginRight: 8 }}>
                  <Ionicons name="create-outline" size={22} color={colors.text} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Ionicons name="time-outline" size={15} color={colors.muted} />
        <Text style={text.muted}>
          Quadra {gameTimeRange(game)} · partidas de {game.matchMinutes ?? defaultMatchMinutes} min
        </Text>
      </View>
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
      {tab === 'notas' && <RateGame game={game} attendees={confirmed} byId={byId} />}
    </Screen>
  );
}

/* ---------------------------- Presença ---------------------------- */

function Attendance({ game, players, rating }: { game: Game; players: Player[]; rating: Record<string, number> }) {
  const toggleAttendee = useStore((s) => s.toggleAttendee);
  const canManage = useCanManage();
  const { session, activeGroup } = useAuth();
  const myId = session?.user.id;
  const withMonthly = useMonthlyOn();
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const inList = confirmedIds(game);

  // Convite: quem entra pelo código vira membro do clube (ou do jogo avulso) e confirma presença aqui
  const invite = () => {
    if (!activeGroup) return;
    const avulso = activeGroup.kind === 'avulso';
    Share.share({
      message:
        `⚽ Bora jogar! ${formatGameDate(game.date)} até ${gameEndTime(game)}${game.location ? `\n📍 ${game.location}` : ''}\n\n` +
        `Baixe o app Vaia Aí, crie sua conta e toque em ${avulso ? '"Entrar num jogo"' : '"Entrar num clube"'} com o código: ${activeGroup.invite_code}`,
    });
  };
  const waiting = waitlistIds(game);
  const list = players
    .filter((p) => (canManage && p.active) || game.attendees.includes(p.id))
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
      .filter((p) => p.active && isMensalista(p, { monthlyEnabled: withMonthly }) && !game.attendees.includes(p.id))
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
      {myId && byId[myId] && <MyPresence game={game} myId={myId} />}
      {isCloudEnabled && activeGroup && (
        <Button title="Convidar para o jogo" icon="person-add" onPress={invite} style={{ marginBottom: 10 }} />
      )}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
        {canManage && withMonthly && (
          <Button title="Mensalistas" icon="people" variant="secondary" onPress={addAllMonthly} style={{ flex: 1 }} />
        )}
        <Button title="Enviar lista" icon="share-social" variant="secondary" onPress={share} style={{ flex: 1 }} />
      </View>

      <SectionTitle>{canManage ? 'Toque para confirmar / desconfirmar' : 'Quem vai'}</SectionTitle>
      {list.map((p) => {
        const pos = inList.indexOf(p.id);
        const wait = waiting.indexOf(p.id);
        const on = pos >= 0 || wait >= 0;
        return (
          <Card
            key={p.id}
            onPress={canManage ? () => toggleAttendee(game.id, p.id) : undefined}
            style={pos >= 0 ? { borderColor: colors.primary } : wait >= 0 ? { borderColor: colors.warning } : undefined}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Check checked={on} color={wait >= 0 ? colors.warning : colors.primary} />
              <Text style={[text.title, { flex: 1 }]} numberOfLines={1}>
                {displayName(p)}
              </Text>
              {pos >= 0 && <Text style={[text.muted, { fontFamily: fonts.bold }]}>#{pos + 1}</Text>}
              {wait >= 0 && <Tag label={`Espera ${wait + 1}`} color={colors.warning} />}
              <PositionTag position={p.position} />
              <RatingBadge value={rating[p.id]} />
            </View>
          </Card>
        );
      })}
    </>
  );
}

function MyPresence({ game, myId }: { game: Game; myId: string }) {
  const toggleAttendee = () =>
    useStore.setState((s) => ({
      games: s.games.map((g) =>
        g.id === game.id
          ? { ...g, attendees: g.attendees.includes(myId) ? g.attendees.filter((x) => x !== myId) : [...g.attendees, myId] }
          : g,
      ),
    }));
  const confirmed = confirmedIds(game);
  const inList = confirmed.indexOf(myId);
  const waiting = waitlistIds(game).indexOf(myId);
  const going = game.attendees.includes(myId);
  const full = !!game.maxPlayers && confirmed.length >= game.maxPlayers;
  const status =
    inList >= 0
      ? `Você está confirmado (#${inList + 1})`
      : waiting >= 0
        ? `Você está na lista de espera (${waiting + 1}º)`
        : 'Você ainda não confirmou';
  return (
    <Card style={{ borderColor: going ? (waiting >= 0 ? colors.warning : colors.primary) : colors.border, gap: 10 }}>
      <Text style={text.title}>{status}</Text>
      {going ? (
        <Button title="Não vou mais" icon="close-circle" variant="danger" onPress={toggleAttendee} />
      ) : (
        <Button title={full ? 'Entrar na lista de espera' : 'Vou!'} icon="checkmark-circle" onPress={toggleAttendee} />
      )}
    </Card>
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
  const canManage = useCanManage();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'campo' | 'lista'>('campo');
  const teamsRef = useRef<View>(null);
  const groupName = useStore((s) => s.settings.groupName);
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
    if (!teams || !canManage) return;
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
    const message = `⚽ Times - ${formatGameDate(game.date)}\n\n${body}`;
    // No celular manda a imagem do campinho; na web, o texto
    setSelected(null);
    setTimeout(() => shareView(teamsRef, message, 'Enviar times'), 50);
  };

  const addTeam = () => setTeams(game.id, [...(teams ?? []), []]);
  const removeTeam = (i: number) =>
    confirm(`Remover ${teamName(i)}?`, 'Os jogadores dele voltam para o banco.', () =>
      setTeams(game.id, (teams ?? []).filter((_, k) => k !== i)), 'Remover');

  if (!teams?.length && !canManage) {
    return <Empty icon="shirt-outline" title="Times ainda não saíram" text="Quando o organizador montar os times, eles aparecem aqui." />;
  }

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
              <Text style={{ color: colors.text, fontFamily: fonts.bold }}>{displayName(p)}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    ) : null;

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {canManage && (
          <>
            <Button title="Sortear" icon="shuffle" variant="secondary" onPress={draw} style={{ flex: 1, paddingHorizontal: 8 }} />
            <Button title="Escalar" icon="hand-left-outline" variant="secondary" onPress={manual} style={{ flex: 1, paddingHorizontal: 8 }} />
          </>
        )}
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
      {canManage && <Text style={[text.muted, { marginBottom: 10 }]}>{hint}</Text>}

      {bench}

      <View ref={teamsRef} collapsable={false} style={{ backgroundColor: colors.bg }}>
      <Text style={{ color: colors.primary, fontFamily: fonts.display, letterSpacing: 1, marginBottom: 8 }}>
        {groupName.toUpperCase()} · {formatGameDate(game.date)}
      </Text>
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
                <Text style={{ color: colors.onPrimary, fontFamily: fonts.display }}>Colocar aqui</Text>
              </Pressable>
            ) : (
              <>
                <RatingBadge value={teamAverage(t, rating)} />
                {canManage && t.length === 0 && teams.length > 2 && (
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
      </View>

      {canManage && <Button title="Adicionar time" icon="add" variant="ghost" onPress={addTeam} />}
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
      <Avatar name={player.name} photo={player.photo} size={30} color={positionColors[player.position]} />
      <Text style={[text.body, { flex: 1 }]}>{displayName(player)}</Text>
      <PositionTag position={player.position} />
    </Pressable>
  );
}

/* ------------------------------ Placar ------------------------------ */

function Scoreboard({ game, byId, goTeams }: { game: Game; byId: Record<string, Player>; goTeams: () => void }) {
  const addMatch = useStore((s) => s.addMatch);
  const canManage = useCanManage();
  const sc = useScoreControl(game);
  const defaultMinutes = useStore((s) => s.settings.defaultMatchMinutes);
  const minutes = game.matchMinutes ?? defaultMinutes;
  const groupName = useStore((s) => s.settings.groupName);
  const teams = game.teams ?? [];
  const suggested = nextPair(game);
  const [a, setA] = useState(suggested[0]);
  const [b, setB] = useState(suggested[1]);

  if (teams.length < 2) {
    return (
      <>
        <Empty
          icon="timer-outline"
          title={canManage ? 'Sorteie os times primeiro' : 'Nenhuma partida ainda'}
          text="O placar usa os times sorteados para registrar gols e assistências."
        />
        {canManage && <Button title="Ir para Times" icon="shuffle" variant="secondary" onPress={goTeams} />}
      </>
    );
  }

  const start = () => {
    if (a === b) return notify('Escolha dois times diferentes');
    sc.claimIfFree(); // primeiro admin a começar vira o marcador do placar
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
      <ScorekeeperCard game={game} byId={byId} />
      {sc.canScore && (
      <Card>
        <Label>Nova partida</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {teams.map((_, i) => (
            <Chip key={'a' + i} label={teamName(i)} selected={a === i} color={teamColors[i % teamColors.length]} onPress={() => setA(i)} />
          ))}
        </View>
        <Text style={[text.muted, { textAlign: 'center', marginVertical: 6, fontFamily: fonts.display }]}>VS</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {teams.map((_, i) => (
            <Chip key={'b' + i} label={teamName(i)} selected={b === i} color={teamColors[i % teamColors.length]} onPress={() => setB(i)} />
          ))}
        </View>
        <Button title={`Começar (${minutes} min)`} icon="play" onPress={start} />
      </Card>
      )}

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
              <Text style={{ color: colors.text, fontSize: 20, fontFamily: fonts.display, minWidth: 64, textAlign: 'center' }}>
                {ga} x {gb}
              </Text>
              <Text style={[text.title, { flex: 1, color: teamColors[m.teamB % teamColors.length] }]}>{teamName(m.teamB)}</Text>
              {!m.finished && <Tag label="Ao vivo" color={colors.danger} />}
            </View>
          </Card>
        );
      })}

      {game.matches.some((m) => m.finished) && (
        <>
          <SectionTitle
            right={
              <Pressable onPress={() => router.push('/scoring-help')} hitSlop={8}>
                <Ionicons name="help-circle-outline" size={20} color={colors.muted} />
              </Pressable>
            }
          >
            Classificação do dia
          </SectionTitle>
          <Card>
            {sorted.map((r, pos) => (
              <View key={r.i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 }}>
                <Text style={[text.muted, { width: 20 }]}>{pos + 1}º</Text>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: teamColors[r.i % teamColors.length] }} />
                <Text style={[text.body, { flex: 1 }]}>{teamName(r.i)}</Text>
                <Text style={text.muted}>
                  {r.w}V {r.d}E {r.l}D · {r.gf}:{r.ga}
                </Text>
                <Text style={{ color: colors.primary, fontFamily: fonts.display, width: 34, textAlign: 'right' }}>{r.w * 3 + r.d}</Text>
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
                <Text style={{ color: colors.primary, fontFamily: fonts.display }}>{n}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {game.matches.length > 0 && (
        <Button
          title="Enviar súmula do dia"
          icon="document-text-outline"
          variant="secondary"
          style={{ marginTop: 6 }}
          onPress={() => Share.share({ message: summaryText(game, byId, groupName) })}
        />
      )}
    </>
  );
}

/* --------------------------- Pagamentos --------------------------- */

function Payments({ game, attendees }: { game: Game; attendees: Player[] }) {
  const togglePaid = useStore((s) => s.togglePaid);
  const canManage = useCanManage();
  const toggleMonthly = useStore((s) => s.toggleMonthly);
  const month = monthKey(parseLocal(game.date));
  const monthlyPaid = useStore((s) => s.monthly[month]) ?? [];

  // Clube sem mensalista: todo mundo paga o jogo
  const settings = useStore((s) => s.settings);
  const mensalistas = attendees.filter((p) => isMensalista(p, settings));
  const avulsos = attendees.filter((p) => !mensalistas.includes(p));
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
          <Card key={p.id} onPress={canManage ? () => togglePaid(game.id, p.id) : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Check checked={paid} />
              <Text style={[text.title, { flex: 1 }]}>{displayName(p)}</Text>
              <Tag label={paid ? 'Pago' : 'Pendente'} color={paid ? colors.success : colors.warning} />
            </View>
          </Card>
        );
      })}

      {mensalistas.length > 0 && <SectionTitle>Mensalistas · mensalidade do mês</SectionTitle>}
      {mensalistas.map((p) => {
        const paid = monthlyPaid.includes(p.id);
        return (
          <Card key={p.id} onPress={canManage ? () => toggleMonthly(month, p.id) : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Check checked={paid} />
              <Text style={[text.title, { flex: 1 }]}>{displayName(p)}</Text>
              <Tag label={paid ? 'Mês pago' : 'Mês em aberto'} color={paid ? colors.success : colors.danger} />
            </View>
          </Card>
        );
      })}

      {avulsos.length > 0 && (
        <>
          <SectionTitle>Pix do jogo</SectionTitle>
          <PixCard amount={game.pricePerPlayer} message={`Pelada ${formatShortDate(game.date)}`} />
        </>
      )}
    </>
  );
}

/* ---------------------------- Avaliação ---------------------------- */

function RateGame({ game, attendees, byId }: { game: Game; attendees: Player[]; byId: Record<string, Player> }) {
  const groupName = useStore((s) => s.settings.groupName);
  const selRef = useRef<View>(null);
  const hasData = Object.keys(game.ratings).length > 0 || Object.keys(game.votes ?? {}).length > 0 || game.matches.some((m) => m.goals.length);
  const selection = hasData ? roundSelection(game, byId) : [];

  if (!attendees.length) {
    return <Empty icon="star-outline" title="Ninguém para avaliar" text="Confirme quem jogou na aba Lista." />;
  }

  return (
    <>
      {selection.length > 0 && (
        <>
          <View ref={selRef} collapsable={false} style={{ backgroundColor: colors.bg, paddingBottom: 4 }}>
            <Text style={{ color: colors.gold, fontFamily: fonts.displayBlack, fontSize: 18, textAlign: 'center' }}>⭐ Seleção da rodada</Text>
            <Text style={[text.muted, { textAlign: 'center', marginBottom: 10 }]}>
              {groupName} · {formatGameDate(game.date)}
            </Text>
            <Pitch players={selection.map((s) => s.player)} color={colors.primaryDark} rating={Object.fromEntries(selection.map((s) => [s.player.id, s.score]))} />
          </View>
          <Button
            title="Compartilhar seleção"
            icon="share-social"
            variant="secondary"
            style={{ marginBottom: 16 }}
            onPress={() =>
              shareView(
                selRef,
                `⭐ Seleção da rodada · ${formatGameDate(game.date)}\n\n` +
                  selection.map((s) => `${s.player.position} ${displayName(s.player)}${s.goals ? ` ⚽${s.goals}` : ''}${s.assists ? ` 🅰️${s.assists}` : ''}`).join('\n'),
                'Seleção da rodada',
              )
            }
          />
        </>
      )}
      <GameScores game={game} byId={byId} />
    </>
  );
}
