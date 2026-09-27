import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '@/auth';
import { Button, Chip, Input, Label, Screen, text } from '@/components/ui';
import { createCall, discoveryError } from '@/discovery';
import { useStore } from '@/store';
import { positionColors } from '@/theme';
import { POSITIONS, type Position } from '@/types';
import { notify } from '@/utils/confirm';
import { buildIso, maskDate, maskTime, parseMoney, splitIso, toLocalIso } from '@/utils/format';
import { confirmedIds } from '@/utils/stats';

/** Sugere a data do próximo jogo do grupo aberto (se houver), senão amanhã às 20h. */
function suggestion(games: ReturnType<typeof useStore.getState>['games']) {
  const now = toLocalIso(new Date());
  const next = [...games].filter((g) => g.date >= now).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) return next;
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(20, 0, 0, 0);
  return { date: toLocalIso(d), location: '', pricePerPlayer: 0, maxPlayers: 0, attendees: [] as string[] } as any;
}

export default function CallNewScreen() {
  const { profile, activeGroup } = useAuth();
  const games = useStore((s) => s.games);
  const base = suggestion(games);
  const missing = base.maxPlayers ? Math.max(1, base.maxPlayers - confirmedIds(base).length) : 2;

  const initial = splitIso(base.date);
  const [title, setTitle] = useState(activeGroup ? `Falta gente na ${activeGroup.name}` : 'Falta gente pro fute');
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [location, setLocation] = useState(base.location ?? '');
  const [positions, setPositions] = useState<Position[]>([]);
  const [slots, setSlots] = useState(Math.min(missing, 10));
  const [price, setPrice] = useState(base.pricePerPlayer ? String(base.pricePerPlayer).replace('.', ',') : '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (!profile) return <Screen>{null}</Screen>;

  const hasRegion = profile.lat_approx != null && profile.lng_approx != null;

  const toggle = (p: Position) => setPositions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const publish = async () => {
    const iso = buildIso(date, time);
    if (!iso) return notify('Data ou horário inválido', 'Use dd/mm/aaaa e hh:mm.');
    if (iso < toLocalIso(new Date())) return notify('Essa data já passou');
    if (title.trim().length < 3) return notify('Dê um título para a vaga');
    if (!location.trim()) return notify('Informe o local do jogo');
    if (!hasRegion) return notify('Falta sua região', 'Use sua localização em Editar perfil para a vaga aparecer para quem está perto.');
    try {
      setBusy(true);
      await createCall({
        title,
        date: iso,
        location,
        positions,
        slots,
        price: parseMoney(price),
        notes,
        groupId: activeGroup?.id ?? null,
        region: {
          neighborhood: profile.neighborhood ?? null,
          city: profile.city ?? null,
          lat: Number(profile.lat_approx),
          lng: Number(profile.lng_approx),
        },
      });
      notify('Vaga publicada!', 'Quem está perto vai ver em "Falta gente". Você acompanha os interessados por lá.');
      router.back();
    } catch (e: any) {
      notify('Não deu certo', discoveryError(e.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Input label="Título" value={title} onChangeText={setTitle} maxLength={80} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 3 }}>
          <Input label="Data" value={date} onChangeText={(v) => setDate(maskDate(v))} keyboardType="number-pad" placeholder="dd/mm/aaaa" />
        </View>
        <View style={{ flex: 2 }}>
          <Input label="Horário" value={time} onChangeText={(v) => setTime(maskTime(v))} keyboardType="number-pad" placeholder="20:00" />
        </View>
      </View>
      <Input label="Local" value={location} onChangeText={setLocation} placeholder="Ex.: Arena Society - Quadra 2" maxLength={120} />

      <Label>Quantas vagas?</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
          <Chip key={n} label={String(n)} selected={slots === n} onPress={() => setSlots(n)} />
        ))}
      </View>

      <Label>Posições que faltam (opcional)</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {POSITIONS.map((p) => (
          <Chip key={p.key} label={p.label} selected={positions.includes(p.key)} color={positionColors[p.key]} onPress={() => toggle(p.key)} />
        ))}
      </View>

      <Input label="Valor por pessoa (R$, deixe vazio se for de graça)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0,00" />
      <Input label="Observações" value={notes} onChangeText={setNotes} placeholder="Ex.: nível tranquilo, levar colete escuro" multiline maxLength={300} />

      <Text style={[text.muted, { marginBottom: 14 }]}>
        A vaga aparece para quem está a até 30 km {profile.neighborhood ? `de ${profile.neighborhood}` : 'de você'}. O endereço só você passa, depois.
      </Text>
      <Button title={busy ? 'Publicando...' : 'Publicar vaga'} icon="megaphone" onPress={publish} disabled={busy} />
    </Screen>
  );
}
