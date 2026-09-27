import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Animated, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ageOf, useAuth } from '@/auth';
import { useSwipe } from '@/components/SwipeCard';
import { Avatar, Button, Empty, Group, PositionTag, Row, Screen, SectionTitle, Segmented, Tag, text } from '@/components/ui';
import {
  REPORT_REASONS,
  block,
  callResponders,
  callsNearby,
  closeCall,
  discoveryError,
  myMatches,
  playersNearby,
  report,
  respondToCall,
  swipe,
  unmatch,
  whatsappLink,
  type Match,
  type NearbyPlayer,
  type OpenCall,
  type Responder,
} from '@/discovery';
import { colors, fonts, positionColors } from '@/theme';
import { POSITIONS } from '@/types';
import { choose, confirm, notify } from '@/utils/confirm';
import { describeSlots, overlap } from '@/utils/availability';
import { initials, money, parseLocal, relativeDay } from '@/utils/format';

type Tab = 'jogadores' | 'vagas' | 'matches';

const posLabel = (p: string) => POSITIONS.find((x) => x.key === p)?.label ?? p;
const hhmm = (iso: string) => {
  const d = parseLocal(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Denunciar e (opcionalmente) bloquear: usado nas cartas, matches e vagas. */
function askReport(target: { user?: string; callId?: string; name: string }, after?: () => void) {
  choose(
    `Denunciar ${target.name}`,
    REPORT_REASONS.map((r) => ({
      text: r.label,
      onPress: async () => {
        try {
          await report({ user: target.user, callId: target.callId, reason: r.key });
          if (target.user) await block(target.user);
          notify('Denúncia enviada', 'Obrigado. Vamos analisar, e você não verá mais essa pessoa.');
          after?.();
        } catch (e: any) {
          notify('Não deu certo', discoveryError(e.message));
        }
      },
    })),
  );
}

export default function NearbyScreen() {
  const { profile, session } = useAuth();
  const [tab, setTab] = useState<Tab>('jogadores');

  const age = ageOf(profile?.birth_date);
  const hasRegion = profile?.lat_approx != null;
  const ready = !!profile && hasRegion && !!profile.discoverable && age !== null && age >= 18;

  if (!profile || !session) return <Screen>{null}</Screen>;

  if (!ready) {
    const steps = [
      { done: age !== null, text: 'Colocar sua data de nascimento' },
      { done: age === null || age >= 18, text: 'Ter 18 anos ou mais' },
      { done: hasRegion, text: 'Usar sua localização (só o bairro aparece)' },
      { done: !!profile.discoverable, text: 'Ligar "Aparecer para jogadores perto"' },
    ];
    return (
      <Screen>
        <Text style={styles.big}>Bora jogar?</Text>
        <Text style={[text.body, { color: colors.muted, lineHeight: 22, marginBottom: 16 }]}>
          Ache gente perto de você para completar o time, ou vagas em peladas da região. Se vocês dois toparem, dá match e
          vocês se chamam no WhatsApp.
        </Text>
        <Group>
          {steps.map((s) => (
            <Row key={s.text}>
              <Ionicons name={s.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={s.done ? colors.success : colors.border} />
              <Text style={[text.body, { flex: 1 }, s.done && { color: colors.muted }]}>{s.text}</Text>
            </Row>
          ))}
        </Group>
        {age !== null && age < 18 ? (
          <Text style={[text.muted, { marginTop: 8 }]}>Essa parte do app é só para maiores de 18 anos.</Text>
        ) : (
          <Button title="Completar no meu perfil" icon="person-circle-outline" onPress={() => router.push('/profile-edit')} style={{ marginTop: 8 }} />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Segmented
        options={[
          { key: 'jogadores', label: 'Jogadores' },
          { key: 'vagas', label: 'Falta gente' },
          { key: 'matches', label: 'Matches' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'jogadores' && <Deck onMatches={() => setTab('matches')} mine={profile.availability ?? []} />}
      {tab === 'vagas' && <Calls userId={session.user.id} />}
      {tab === 'matches' && <Matches userId={session.user.id} />}
    </Screen>
  );
}

/* ------------------------------ Cartas ------------------------------ */

function Deck({ onMatches, mine }: { onMatches: () => void; mine: string[] }) {
  const [list, setList] = useState<NearbyPlayer[] | null>(null);
  const [radius, setRadius] = useState(15);
  const [matched, setMatched] = useState<NearbyPlayer | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const load = useCallback(() => {
    playersNearby(radius)
      .then(setList)
      .catch((e) => {
        setList([]);
        notify('Não deu para carregar', discoveryError(e.message));
      });
  }, [radius]);
  useFocusEffect(load);

  // Primeiro quem tem mais horários em comum comigo; depois os mais perto
  const common = (p: NearbyPlayer) => overlap(p.availability, mine).length;
  const visible = (list ?? [])
    .filter((p) => !onlyMine || common(p) > 0)
    .sort((a, b) => common(b) - common(a) || a.distance_km - b.distance_km);
  const current = visible[0];
  const next = visible[1];

  const decide = async (liked: boolean) => {
    if (!current) return;
    setList((l) => (l ? l.filter((x) => x.id !== current.id) : l));
    try {
      const isMatch = await swipe(current.id, liked);
      if (isMatch) setMatched(current);
    } catch (e: any) {
      notify('Não deu certo', discoveryError(e.message));
    }
  };
  const { handlers, cardStyle, likeOpacity, nopeOpacity, swipe: fly } = useSwipe(decide);

  if (matched) {
    return (
      <View style={styles.matchBox}>
        <Text style={{ fontSize: 56 }}>🤝</Text>
        <Text style={styles.big}>Deu match!</Text>
        <Text style={[text.body, { color: colors.muted, textAlign: 'center', marginBottom: 16 }]}>
          Você e {matched.nickname || matched.name} toparam jogar juntos.
        </Text>
        <Button title="Ver meus matches" icon="chatbubbles" onPress={() => { setMatched(null); onMatches(); }} style={{ alignSelf: 'stretch' }} />
        <Button title="Continuar procurando" variant="ghost" onPress={() => setMatched(null)} style={{ alignSelf: 'stretch', marginTop: 8 }} />
      </View>
    );
  }

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {mine.length > 0 && (
          <Pressable
            onPress={() => setOnlyMine(!onlyMine)}
            style={[styles.radius, onlyMine && { borderColor: colors.success, backgroundColor: colors.success + '22' }]}
          >
            <Text style={{ color: onlyMine ? colors.success : colors.muted, fontFamily: fonts.semibold }}>No meu horário</Text>
          </Pressable>
        )}
        {[5, 15, 30, 60].map((r) => (
          <Pressable key={r} onPress={() => setRadius(r)} style={[styles.radius, radius === r && { borderColor: colors.primary, backgroundColor: colors.primary + '22' }]}>
            <Text style={{ color: radius === r ? colors.primary : colors.muted, fontFamily: fonts.semibold }}>até {r} km</Text>
          </Pressable>
        ))}
      </View>

      {list === null ? null : !current ? (
        <>
          <Empty icon="football-outline" title="Ninguém novo por perto" text="Aumente a distância ou volte mais tarde. Quanto mais gente liga o 'Aparecer', mais cartas aparecem." />
          <Button title="Procurar de novo" icon="refresh" variant="secondary" onPress={load} />
        </>
      ) : (
        <>
          <View style={styles.deck}>
            {next && (
              <View style={[styles.card, styles.cardBehind]}>
                <PlayerFace p={next} mine={mine} />
              </View>
            )}
            <Animated.View {...handlers} style={[styles.card, cardStyle]}>
              <PlayerFace p={current} mine={mine} />
              <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]}>
                <Text style={[styles.stampText, { color: colors.success }]}>BORA</Text>
              </Animated.View>
              <Animated.View style={[styles.stamp, styles.stampNope, { opacity: nopeOpacity }]}>
                <Text style={[styles.stampText, { color: colors.danger }]}>PASSO</Text>
              </Animated.View>
              <Pressable
                hitSlop={10}
                style={styles.more}
                onPress={() =>
                  choose(current.nickname || current.name, [
                    { text: 'Denunciar', destructive: true, onPress: () => askReport({ user: current.id, name: current.nickname || current.name }, () => setList((l) => l?.filter((x) => x.id !== current.id) ?? l)) },
                    {
                      text: 'Bloquear',
                      destructive: true,
                      onPress: () => block(current.id).then(() => setList((l) => l?.filter((x) => x.id !== current.id) ?? l)).catch((e) => notify('Não deu certo', discoveryError(e.message))),
                    },
                  ])
                }
              >
                <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
              </Pressable>
            </Animated.View>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={() => fly(false)} style={[styles.action, { borderColor: colors.danger }]}>
              <Ionicons name="close" size={34} color={colors.danger} />
            </Pressable>
            <Pressable onPress={() => fly(true)} style={[styles.action, styles.actionLike]}>
              <Ionicons name="football" size={34} color={colors.onPrimary} />
            </Pressable>
          </View>
          <Text style={[text.muted, { textAlign: 'center', marginTop: 8 }]}>Arraste para o lado ou use os botões</Text>
        </>
      )}
    </>
  );
}

function PlayerFace({ p, mine }: { p: NearbyPlayer; mine: string[] }) {
  const color = positionColors[p.position] ?? colors.primary;
  const shared = overlap(p.availability, mine);
  return (
    <View style={{ flex: 1 }}>
      {p.photos?.[0] ? (
        <Image source={{ uri: p.photos[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color + '33', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color, fontFamily: fonts.displayBlack, fontSize: 120 }}>{initials(p.name)}</Text>
        </View>
      )}
      <View style={styles.faceShade} />
      <View style={styles.faceInfo}>
        <Text style={styles.faceName} numberOfLines={1}>
          {p.nickname || p.name}
          {p.age !== null && <Text style={{ fontFamily: fonts.display }}>, {p.age}</Text>}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <PositionTag position={p.position} />
          <Text style={styles.faceSub}>
            {posLabel(p.position)}
            {p.second_position ? ` / ${posLabel(p.second_position)}` : ''}
            {p.shirt_number !== null ? `  ·  camisa ${p.shirt_number}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="location" size={14} color="#fff" />
          <Text style={styles.faceSub}>
            {[p.neighborhood, p.city].filter(Boolean).join(', ') || 'Perto de você'} · {p.distance_km} km
          </Text>
        </View>
        {shared.length > 0 ? (
          <View style={styles.common}>
            <Ionicons name="time" size={14} color={colors.onPrimary} />
            <Text style={styles.commonText} numberOfLines={2}>
              Em comum: {describeSlots(shared, 3)}
            </Text>
          </View>
        ) : p.availability?.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time-outline" size={14} color="#fff" />
            <Text style={styles.faceSub} numberOfLines={1}>
              Joga {describeSlots(p.availability, 3)}
            </Text>
          </View>
        ) : null}
        {!!p.bio && (
          <Text style={[styles.faceSub, { marginTop: 4 }]} numberOfLines={3}>
            {p.bio}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ------------------------------ Matches ------------------------------ */

function Matches({ userId }: { userId: string }) {
  const [list, setList] = useState<Match[] | null>(null);
  const load = useCallback(() => {
    myMatches()
      .then(setList)
      .catch((e) => {
        setList([]);
        notify('Não deu para carregar', discoveryError(e.message));
      });
  }, []);
  useFocusEffect(load);

  if (list === null) return null;
  if (!list.length) {
    return <Empty icon="heart-outline" title="Nenhum match ainda" text="Quando você e outro jogador toparem jogar juntos, ele aparece aqui." />;
  }

  const menu = (m: Match) =>
    choose(m.nickname || m.name, [
      { text: 'Desfazer match', onPress: () => unmatch(m.id, userId).then(load).catch((e) => notify('Não deu certo', discoveryError(e.message))) },
      { text: 'Bloquear', destructive: true, onPress: () => block(m.id).then(load).catch((e) => notify('Não deu certo', discoveryError(e.message))) },
      { text: 'Denunciar', destructive: true, onPress: () => askReport({ user: m.id, name: m.nickname || m.name }, load) },
    ]);

  return (
    <Group>
      {list.map((m) => (
        <Row key={m.id}>
          <Avatar name={m.name} photo={m.photo} color={positionColors[m.position]} size={46} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={text.title} numberOfLines={1}>
              {m.nickname || m.name}
            </Text>
            <Text style={text.muted} numberOfLines={1}>
              {posLabel(m.position)}
              {m.neighborhood ? ` · ${m.neighborhood}` : ''}
            </Text>
          </View>
          {m.phone ? (
            <Pressable
              hitSlop={8}
              onPress={() => Linking.openURL(whatsappLink(m.phone!, 'E aí! Vi seu perfil no Vaia Aí. Bora jogar um fute?'))}
              style={styles.whats}
            >
              <Ionicons name="logo-whatsapp" size={20} color={colors.onPrimary} />
            </Pressable>
          ) : (
            <Tag label="Sem WhatsApp" color={colors.muted} />
          )}
          <Pressable hitSlop={10} onPress={() => menu(m)}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.muted} />
          </Pressable>
        </Row>
      ))}
    </Group>
  );
}

/* ------------------------------ Falta gente ------------------------------ */

function Calls({ userId }: { userId: string }) {
  const [list, setList] = useState<OpenCall[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [responders, setResponders] = useState<Record<string, Responder[]>>({});

  const load = useCallback(() => {
    callsNearby(30)
      .then(setList)
      .catch((e) => {
        setList([]);
        notify('Não deu para carregar', discoveryError(e.message));
      });
  }, []);
  useFocusEffect(load);

  const toggleGoing = async (c: OpenCall) => {
    try {
      await respondToCall(c.id, !c.i_responded, userId);
      load();
      if (!c.i_responded) notify('Boa!', `${c.author_name} vai ver que você topou. Se você liberou o WhatsApp no perfil, ele pode te chamar.`);
    } catch (e: any) {
      notify('Não deu certo', discoveryError(e.message));
    }
  };

  const showResponders = async (c: OpenCall) => {
    if (open === c.id) return setOpen(null);
    setOpen(c.id);
    try {
      const r = await callResponders(c.id);
      setResponders((m) => ({ ...m, [c.id]: r }));
    } catch (e: any) {
      notify('Não deu certo', discoveryError(e.message));
    }
  };

  const close = (c: OpenCall) =>
    confirm('Encerrar vaga', 'A vaga some da lista de quem está procurando jogo.', () => closeCall(c.id).then(load), 'Encerrar');

  return (
    <>
      <Button title="Publicar vaga" icon="megaphone-outline" onPress={() => router.push('/call-new')} />
      <Text style={[text.muted, { marginTop: 8, marginBottom: 4 }]}>Faltou gente na sua pelada? Publique e quem está perto fica sabendo.</Text>

      {list === null ? null : list.length === 0 ? (
        <Empty icon="megaphone-outline" title="Nenhuma vaga por perto" text="Quando alguém publicar uma vaga num raio de 30 km, ela aparece aqui." />
      ) : (
        <>
          <SectionTitle>Vagas abertas</SectionTitle>
          {list.map((c) => (
            <View key={c.id} style={styles.call}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={styles.callWhen}>
                  <Text style={styles.callTime}>{hhmm(c.date)}</Text>
                  <Text style={[text.muted, { fontSize: 12 }]}>{relativeDay(c.date)}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={text.title}>{c.title}</Text>
                  <Text style={text.muted}>
                    {c.location} · {c.mine ? 'sua vaga' : `${c.distance_km} km`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <Tag label={`${c.slots} ${c.slots === 1 ? 'vaga' : 'vagas'}`} color={colors.primary} />
                    {c.positions.map((p) => (
                      <PositionTag key={p} position={p} />
                    ))}
                    <Tag label={c.price > 0 ? money(c.price) : 'De graça'} color={colors.muted} />
                  </View>
                  {!!c.notes && <Text style={[text.muted, { marginTop: 4 }]}>{c.notes}</Text>}
                </View>
              </View>

              {c.mine ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Button
                      title={`${c.responses} ${c.responses === 1 ? 'interessado' : 'interessados'}`}
                      icon="people"
                      variant="secondary"
                      onPress={() => showResponders(c)}
                      style={{ flex: 1 }}
                    />
                    <Button title="Encerrar" variant="ghost" onPress={() => close(c)} />
                  </View>
                  {open === c.id &&
                    (responders[c.id]?.length ? (
                      <Group style={{ marginTop: 10, backgroundColor: colors.cardAlt }}>
                        {responders[c.id].map((r) => (
                          <Row key={r.id}>
                            <Avatar name={r.name} photo={r.photo} size={36} color={positionColors[r.position]} />
                            <View style={{ flex: 1 }}>
                              <Text style={text.title}>{r.nickname || r.name}</Text>
                              <Text style={text.muted}>
                                {posLabel(r.position)}
                                {r.neighborhood ? ` · ${r.neighborhood}` : ''}
                              </Text>
                            </View>
                            {r.phone ? (
                              <Pressable
                                style={styles.whats}
                                onPress={() => Linking.openURL(whatsappLink(r.phone!, `E aí! Vi que você topou a vaga "${c.title}" no Vaia Aí.`))}
                              >
                                <Ionicons name="logo-whatsapp" size={20} color={colors.onPrimary} />
                              </Pressable>
                            ) : (
                              <Tag label="Sem WhatsApp" color={colors.muted} />
                            )}
                          </Row>
                        ))}
                      </Group>
                    ) : (
                      <Text style={[text.muted, { marginTop: 8 }]}>Ninguém respondeu ainda.</Text>
                    ))}
                </>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <Button
                    title={c.i_responded ? 'Você topou · desistir' : 'Tô dentro'}
                    icon={c.i_responded ? 'checkmark-circle' : 'hand-right'}
                    variant={c.i_responded ? 'secondary' : 'primary'}
                    onPress={() => toggleGoing(c)}
                    style={{ flex: 1 }}
                  />
                  <Pressable hitSlop={10} onPress={() => askReport({ user: c.author, callId: c.id, name: c.author_name }, load)}>
                    <Ionicons name="flag-outline" size={20} color={colors.muted} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  big: { color: colors.chalk, fontFamily: fonts.displayBlack, fontSize: 44, lineHeight: 48, marginBottom: 6 },
  radius: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  deck: { height: 470, marginTop: 4 },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  cardBehind: { transform: [{ scale: 0.95 }, { translateY: 14 }], opacity: 0.6 },
  faceShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: 'rgba(8,20,13,0.72)' },
  faceInfo: { position: 'absolute', left: 18, right: 18, bottom: 18, gap: 6 },
  faceName: { color: '#fff', fontFamily: fonts.displayBlack, fontSize: 38, lineHeight: 42 },
  faceSub: { color: '#fff', fontFamily: fonts.medium, fontSize: 15, opacity: 0.92 },
  stamp: { position: 'absolute', top: 28, borderWidth: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2 },
  stampLike: { left: 22, borderColor: colors.success, transform: [{ rotate: '-14deg' }] },
  stampNope: { right: 22, borderColor: colors.danger, transform: [{ rotate: '14deg' }] },
  stampText: { fontFamily: fonts.displayBlack, fontSize: 40, letterSpacing: 2 },
  more: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: 4 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 36, marginTop: 18 },
  action: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  actionLike: { backgroundColor: colors.primary, borderColor: colors.primary },
  matchBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 12 },
  whats: { backgroundColor: colors.success, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  call: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 12 },
  callWhen: { alignItems: 'center', minWidth: 58 },
  callTime: { color: colors.chalk, fontFamily: fonts.display, fontSize: 28, lineHeight: 30 },
  common: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  commonText: { color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 13, flexShrink: 1 },
});
