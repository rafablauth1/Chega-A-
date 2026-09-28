import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, Chip, Input, Label, Screen, text } from '@/components/ui';
import { ageOf, useAuth } from '@/auth';
import { clubError, createSingleGame } from '@/clubs';
import { colors } from '@/theme';
import { notify } from '@/utils/confirm';
import { buildIso, courtMinutes, maskDate, maskTime, parseMoney, splitIso, toLocalIso } from '@/utils/format';

const MATCH_OPTIONS = [10, 15, 20, 30, 60];
const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const plusMinutes = (hhmm: string, mins: number) => {
  const d = new Date(`2000-01-01T${hhmm}`);
  d.setMinutes(d.getMinutes() + mins);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Jogo avulso: um jogo sem clube. Convite por código e, se quiser, vaga aberta no Bora. */
export default function SingleGameScreen() {
  const { session, profile, refresh, setActiveGroup } = useAuth();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);
  const initial = splitIso(toLocalIso(tomorrow));

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [endTime, setEndTime] = useState(plusMinutes(initial.time, 60));
  const [endTouched, setEndTouched] = useState(false);
  const [matchMinutes, setMatchMinutes] = useState(20);
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('20');
  const [perTeam, setPerTeam] = useState(6);
  const [maxPlayers, setMaxPlayers] = useState('14');
  const [notes, setNotes] = useState('');
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);

  const adult = (ageOf(profile?.birth_date) ?? 0) >= 18;
  const hasRegion = profile?.lat_approx != null;
  const court = validTime(time) && validTime(endTime) ? courtMinutes(time, endTime) : null;
  const fits = court ? Math.floor(court / matchMinutes) : null;

  const save = async () => {
    const iso = buildIso(date, time);
    if (!iso) return notify('Data ou horário inválido', 'Use o formato dd/mm/aaaa e hh:mm.');
    if (!court || court > 6 * 60) return notify('Horário da quadra', 'Confira o início e o fim da quadra.');
    if (!location.trim()) return notify('Onde vai ser?', 'Coloque o local (a quadra).');
    if (publish && !adult) return notify('Bora é para maiores de 18', 'Coloque sua data de nascimento no perfil para publicar.');
    setBusy(true);
    try {
      const r = await createSingleGame({
        date: iso,
        endTime,
        matchMinutes,
        location: location.trim(),
        price: parseMoney(price),
        playersPerTeam: perTeam,
        maxPlayers: Math.max(0, parseInt(maxPlayers, 10) || 0),
        notes: notes.trim(),
        publish,
        me: session!.user.id,
        region: { neighborhood: profile?.neighborhood, city: profile?.city, lat: profile?.lat_approx, lng: profile?.lng_approx },
      });
      await refresh();
      setActiveGroup(r.groupId);
      router.replace({ pathname: '/game/[id]', params: { id: r.gameId, group: r.groupId } });
      notify(
        'Jogo marcado ⚽',
        r.published
          ? 'Está no Bora para a galera da região. Convide também os amigos pelo botão "Convidar para o jogo".'
          : r.publishError
            ? `O jogo foi criado, mas não entrou no Bora: ${r.publishError}`
            : 'Agora é só tocar em "Convidar para o jogo" e mandar para a galera.',
      );
    } catch (e: any) {
      notify('Não deu certo', clubError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={[text.muted, { marginBottom: 12 }]}>
        Um jogo solto, sem clube. Você organiza (times, placar, pagamento) e quem entra pelo convite vai direto para ele. Se der
        certo, dá para transformar em clube depois.
      </Text>

      <Input label="Data" value={date} onChangeText={(v) => setDate(maskDate(v))} placeholder="dd/mm/aaaa" keyboardType="number-pad" />
      <Label>Horário da quadra</Label>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Início"
            value={time}
            onChangeText={(v) => {
              const t = maskTime(v);
              if (!endTouched && validTime(t) && court) setEndTime(plusMinutes(t, court));
              setTime(t);
            }}
            placeholder="20:00"
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Fim"
            value={endTime}
            onChangeText={(v) => {
              setEndTouched(true);
              setEndTime(maskTime(v));
            }}
            placeholder="21:00"
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
      </View>
      <Label>Duração de cada partida</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {MATCH_OPTIONS.map((n) => (
          <Chip key={n} label={`${n} min`} selected={matchMinutes === n} onPress={() => setMatchMinutes(n)} />
        ))}
      </View>
      <Text style={[text.muted, { fontSize: 12, marginBottom: 14 }]}>
        {court ? `Quadra de ${court} min${fits ? ` · cabem ${fits} partida${fits > 1 ? 's' : ''}` : ''}.` : 'Preencha início e fim.'}
      </Text>

      <Input label="Local" value={location} onChangeText={setLocation} placeholder="Ex.: Arena do Bairro - Quadra 2" />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Input label="Valor por pessoa (R$)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Vagas (0 = sem limite)" value={maxPlayers} onChangeText={(v) => setMaxPlayers(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        </View>
      </View>
      <Label>Jogadores por time</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[5, 6, 7, 8, 11].map((n) => (
          <Chip key={n} label={String(n)} selected={perTeam === n} onPress={() => setPerTeam(n)} />
        ))}
      </View>
      <Input label="Observações" value={notes} onChangeText={setNotes} placeholder="Ex.: levar colete escuro" multiline />

      <Card style={{ gap: 6, borderColor: publish ? colors.primary : colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={text.title}>Publicar no Bora</Text>
            <Text style={text.muted}>Jogadores da região veem a vaga e entram direto no jogo.</Text>
          </View>
          <Switch value={publish} onValueChange={setPublish} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        {publish && !adult && <Text style={{ color: colors.warning }}>Precisa ter 18+ (data de nascimento no perfil).</Text>}
        {publish && !hasRegion && (
          <Text style={{ color: colors.warning }}>Ative sua região no perfil para o jogo aparecer para quem está perto.</Text>
        )}
      </Card>

      <Button title={busy ? 'Marcando...' : 'Marcar jogo avulso'} icon="flash" onPress={save} disabled={busy} style={{ marginTop: 12 }} />
    </Screen>
  );
}
