import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Chip, Input, Label, Screen, text } from '@/components/ui';
import { useStore } from '@/store';
import { confirm, notify } from '@/utils/confirm';
import { buildIso, maskDate, maskTime, money, parseMoney, splitIso } from '@/utils/format';

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

export default function GameFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useStore((s) => s.games.find((g) => g.id === id));
  const settings = useStore((s) => s.settings);
  const lastGame = useStore((s) => [...s.games].sort((a, b) => b.date.localeCompare(a.date))[0]);
  const { addGame, updateGame, removeGame } = useStore.getState();

  const initial = splitIso(existing?.date ?? suggestDate(lastGame?.date));
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [location, setLocation] = useState(existing?.location ?? lastGame?.location ?? settings.defaultLocation);
  const [price, setPrice] = useState(String(existing?.pricePerPlayer ?? settings.defaultPrice).replace('.', ','));
  const [perTeam, setPerTeam] = useState(existing?.playersPerTeam ?? settings.defaultPlayersPerTeam);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [maxPlayers, setMaxPlayers] = useState(String(existing?.maxPlayers ?? settings.defaultMaxPlayers ?? 0));

  const save = () => {
    const iso = buildIso(date, time);
    if (!iso) return notify('Data ou horário inválido', 'Use o formato dd/mm/aaaa e hh:mm.');
    const data = {
      date: iso,
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
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 3 }}>
          <Input
            label="Data"
            value={date}
            onChangeText={(v) => setDate(maskDate(v))}
            placeholder="dd/mm/aaaa"
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 2 }}>
          <Input
            label="Horário"
            value={time}
            onChangeText={(v) => setTime(maskTime(v))}
            placeholder="20:00"
            keyboardType="number-pad"
          />
        </View>
      </View>
      <Input label="Local" value={location} onChangeText={setLocation} placeholder="Ex.: Arena do Bairro - Quadra 2" />
      <Input
        label="Valor por avulso (R$)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="20,00"
      />
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
      {!isNew && (
        <Button title="Excluir jogo" icon="trash-outline" variant="danger" onPress={remove} style={{ marginTop: 16 }} />
      )}
    </Screen>
  );
}
