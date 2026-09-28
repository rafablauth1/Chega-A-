import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Chip, Input, Label, Screen, text } from '@/components/ui';
import { useStore } from '@/store';
import { confirm, notify } from '@/utils/confirm';
import { buildIso, courtMinutes, DEFAULT_COURT_MINUTES, gameEndTime, maskDate, maskTime, money, parseMoney, splitIso } from '@/utils/format';

/** Próximo dia da semana igual ao do último jogo, ou amanhã. */
const suggestDate = (lastIso?: string) => {
  const d = new Date();
  if (lastIso) {
    const [datePart, time] = lastIso.split('T');
    const last = new Date(`${datePart}T00:00`);
    const diff = (last.getDay() - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(20, 0, 0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const MATCH_OPTIONS = [10, 15, 20, 25, 30, 60];
const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export default function GameFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useStore((s) => s.games.find((g) => g.id === id));
  const settings = useStore((s) => s.settings);
  const lastGame = useStore((s) => [...s.games].sort((a, b) => b.date.localeCompare(a.date))[0]);
  const { addGame, updateGame, removeGame } = useStore.getState();

  const startIso = existing?.date ?? suggestDate(lastGame?.date);
  const initial = splitIso(startIso);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  // Fim da quadra: o salvo, ou o mesmo tamanho de horário do último jogo, ou 60 min
  const [endTime, setEndTime] = useState(
    existing
      ? gameEndTime(existing)
      : gameEndTime({
          date: startIso,
          endTime: lastGame?.endTime
            ? (() => {
                const mins = courtMinutes(lastGame.date.slice(11, 16), lastGame.endTime);
                const d = new Date(`2000-01-01T${initial.time}`);
                d.setMinutes(d.getMinutes() + mins);
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              })()
            : undefined,
        }),
  );
  const [endTouched, setEndTouched] = useState(!!existing?.endTime);
  const [matchMinutes, setMatchMinutes] = useState(existing?.matchMinutes ?? lastGame?.matchMinutes ?? settings.defaultMatchMinutes);
  const [location, setLocation] = useState(existing?.location ?? lastGame?.location ?? settings.defaultLocation);
  const [price, setPrice] = useState(String(existing?.pricePerPlayer ?? settings.defaultPrice).replace('.', ','));
  const [perTeam, setPerTeam] = useState(existing?.playersPerTeam ?? settings.defaultPlayersPerTeam);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [maxPlayers, setMaxPlayers] = useState(String(existing?.maxPlayers ?? settings.defaultMaxPlayers ?? 0));

  const court = validTime(time) && validTime(endTime) ? courtMinutes(time, endTime) : null;
  const fits = court && matchMinutes > 0 ? Math.floor(court / matchMinutes) : null;

  // Mudou o início e o fim ainda é o automático: o fim acompanha (mantém o tamanho do horário)
  const changeStart = (v: string) => {
    const t = maskTime(v);
    if (!endTouched && validTime(t) && validTime(time) && validTime(endTime)) {
      const len = courtMinutes(time, endTime) || DEFAULT_COURT_MINUTES;
      const d = new Date(`2000-01-01T${t}`);
      d.setMinutes(d.getMinutes() + len);
      setEndTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }
    setTime(t);
  };

  const save = () => {
    const iso = buildIso(date, time);
    if (!iso) return notify('Data ou horário inválido', 'Use o formato dd/mm/aaaa e hh:mm.');
    if (!validTime(endTime)) return notify('Horário de fim inválido', 'Use o formato hh:mm, ex.: 21:00.');
    if (!court || court > 6 * 60) return notify('Horário da quadra', 'Confira o início e o fim: a quadra tem que ter entre 1 minuto e 6 horas.');
    if (matchMinutes < 1 || matchMinutes > court) return notify('Duração da partida', 'Cada partida precisa caber no horário da quadra.');
    const data = {
      date: iso,
      endTime,
      matchMinutes,
      location: location.trim(),
      pricePerPlayer: parseMoney(price),
      playersPerTeam: perTeam,
      maxPlayers: Math.max(0, parseInt(maxPlayers, 10) || 0),
      notes: notes.trim(),
    };
    if (isNew) {
      const newId = addGame(data);
      router.replace(`/game/${newId}`);
    } else {
      updateGame(id, data);
      router.back();
    }
  };

  const remove = () =>
    confirm('Excluir jogo', 'Isso apaga presença, times e pagamentos deste jogo.', () => {
      removeGame(id);
      router.dismissTo('/');
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Marcar jogo' : 'Editar jogo' }} />
      <Input label="Data" value={date} onChangeText={(v) => setDate(maskDate(v))} placeholder="dd/mm/aaaa" keyboardType="number-pad" />

      <Label>Horário da quadra</Label>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input label="Início" value={time} onChangeText={changeStart} placeholder="20:00" keyboardType="number-pad" maxLength={5} />
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
      <Input
        label="Outra duração (min)"
        value={MATCH_OPTIONS.includes(matchMinutes) ? '' : String(matchMinutes)}
        onChangeText={(v) => {
          const n = parseInt(v.replace(/\D/g, ''), 10);
          if (n) setMatchMinutes(n);
        }}
        keyboardType="number-pad"
        placeholder="Ex.: 12"
        maxLength={3}
      />
      <Text style={[text.muted, { fontSize: 12, marginTop: -8, marginBottom: 14 }]}>
        {court
          ? `Quadra de ${court} min${fits ? ` · cabem ${fits} partida${fits > 1 ? 's' : ''} de ${matchMinutes} min` : ''}.`
          : 'Preencha início e fim da quadra.'}
      </Text>

      <Input label="Local" value={location} onChangeText={setLocation} placeholder="Ex.: Arena do Bairro - Quadra 2" />
      <Input label="Valor por avulso (R$)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="20,00" />
      <Text style={[text.muted, { fontSize: 12, marginTop: -8, marginBottom: 14 }]}>
        Mensalistas não pagam por jogo. Avulsos pagam {money(parseMoney(price))}.
      </Text>

      <Label>Jogadores por time (com goleiro)</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[5, 6, 7, 8, 9, 10, 11].map((n) => (
          <Chip key={n} label={String(n)} selected={perTeam === n} onPress={() => setPerTeam(n)} />
        ))}
      </View>

      <Input
        label="Limite de vagas (0 = sem limite)"
        value={maxPlayers}
        onChangeText={(v) => setMaxPlayers(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        placeholder="0"
      />
      <Text style={[text.muted, { fontSize: 12, marginTop: -8, marginBottom: 14 }]}>
        Quem confirmar depois de lotar entra na lista de espera e sobe sozinho se alguém sair.
      </Text>

      <Input label="Observações" value={notes} onChangeText={setNotes} placeholder="Ex.: levar colete" multiline />

      <Button title={isNew ? 'Marcar jogo' : 'Salvar'} icon="checkmark" onPress={save} style={{ marginTop: 8 }} />
      {!isNew && <Button title="Excluir jogo" icon="trash-outline" variant="danger" onPress={remove} style={{ marginTop: 16 }} />}
    </Screen>
  );
}
