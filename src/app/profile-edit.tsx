import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Input, Label, Screen, SectionTitle, Stars, text } from '@/components/ui';
import { authErrorMessage, useAuth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { colors, positionColors } from '@/theme';
import { FEET, POSITIONS, SKILLS, type Foot, type Position, type Skills } from '@/types';
import { choose, notify } from '@/utils/confirm';
import { buildIso, maskDate } from '@/utils/format';
import { deletePhoto, pickPhoto, uploadPhoto } from '@/utils/photos';

const MAX_PHOTOS = 6;
const DEFAULT_SKILLS: Skills = { tecnica: 3, fisico: 3, passe: 3, finalizacao: 3, defesa: 3 };

/** "YYYY-MM-DD" -> "dd/mm/aaaa" */
const toBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
const digits = (s: string, max: number) => s.replace(/\D/g, '').slice(0, max);
const intOrNull = (s: string) => (s.trim() ? parseInt(s, 10) : null);

export default function ProfileEditScreen() {
  const { session, profile, refresh } = useAuth();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birth, setBirth] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [position, setPosition] = useState<Position>('MEI');
  const [second, setSecond] = useState<Position | null>(null);
  const [foot, setFoot] = useState<Foot | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [shirt, setShirt] = useState('');
  const [team, setTeam] = useState('');
  const [skills, setSkills] = useState<Skills>(DEFAULT_SKILLS);
  const [busy, setBusy] = useState(false);

  // Preenche o formulário uma vez com o perfil salvo
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!profile || loaded) return;
    setPhotos(profile.photos ?? []);
    setName(profile.name);
    setNickname(profile.nickname ?? '');
    setBirth(toBr(profile.birth_date));
    setCity(profile.city ?? '');
    setBio(profile.bio ?? '');
    setPhone(profile.phone ?? '');
    setInstagram(profile.instagram ?? '');
    setPosition(profile.position);
    setSecond(profile.second_position);
    setFoot(profile.foot);
    setHeight(profile.height_cm ? String(profile.height_cm) : '');
    setWeight(profile.weight_kg ? String(profile.weight_kg) : '');
    setShirt(profile.shirt_number !== null ? String(profile.shirt_number) : '');
    setTeam(profile.favorite_team ?? '');
    setSkills({ ...DEFAULT_SKILLS, ...profile.skills });
    setLoaded(true);
  }, [profile, loaded]);

  if (!session || !profile) return <Screen>{null}</Screen>;
  const userId = session.user.id;

  /* ---------------- Fotos: salvam na hora, sem precisar do botão Salvar ---------------- */

  const savePhotos = async (next: string[]) => {
    setPhotos(next);
    const { error } = await supabase.from('profiles').update({ photos: next }).eq('id', userId);
    if (error) notify('Não deu certo', authErrorMessage(error.message));
    await refresh();
  };

  const addPhoto = (source: 'camera' | 'library') => async () => {
    try {
      const local = await pickPhoto(source);
      if (!local) return;
      setUploading(true);
      const url = await uploadPhoto(userId, local);
      await savePhotos([...photos, url]);
    } catch (e: any) {
      notify('Não foi possível enviar a foto', authErrorMessage(e?.message ?? ''));
    } finally {
      setUploading(false);
    }
  };

  const askAdd = () => {
    if (Platform.OS === 'web') return addPhoto('library')();
    choose('Adicionar foto', [
      { text: 'Tirar foto', onPress: addPhoto('camera') },
      { text: 'Escolher da galeria', onPress: addPhoto('library') },
    ]);
  };

  const askPhoto = (url: string, i: number) =>
    choose(i === 0 ? 'Foto principal' : 'Foto', [
      ...(i > 0 ? [{ text: 'Usar como principal', onPress: () => savePhotos([url, ...photos.filter((p) => p !== url)]) }] : []),
      {
        text: 'Remover',
        destructive: true,
        onPress: async () => {
          await savePhotos(photos.filter((p) => p !== url));
          deletePhoto(url).catch(() => {});
        },
      },
    ]);

  /* ---------------- Dados ---------------- */

  const save = async () => {
    if (!name.trim()) return notify('Informe seu nome');
    const birthIso = birth ? buildIso(birth, '00:00')?.slice(0, 10) : null;
    if (birth && !birthIso) return notify('Data de nascimento inválida', 'Use o formato dd/mm/aaaa.');
    const h = intOrNull(height);
    const w = intOrNull(weight);
    if (h !== null && (h < 100 || h > 250)) return notify('Altura inválida', 'Informe em centímetros, ex.: 178.');
    if (w !== null && (w < 30 || w > 250)) return notify('Peso inválido', 'Informe em quilos, ex.: 75.');

    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        nickname: nickname.trim() || null,
        birth_date: birthIso,
        city: city.trim() || null,
        bio: bio.trim() || null,
        phone: phone.trim() || null,
        instagram: instagram.trim().replace(/^@/, '') || null,
        position,
        second_position: second,
        foot,
        height_cm: h,
        weight_kg: w,
        shirt_number: intOrNull(shirt),
        favorite_team: team.trim() || null,
        skills,
      })
      .eq('id', userId);
    setBusy(false);
    if (error) return notify('Não deu certo', authErrorMessage(error.message));
    await refresh();
    router.back();
  };

  const slots = Array.from({ length: MAX_PHOTOS }, (_, i) => photos[i] ?? null);

  return (
    <Screen>
      <SectionTitle right={<Text style={text.muted}>{photos.length}/{MAX_PHOTOS}</Text>}>Fotos</SectionTitle>
      <Text style={[text.muted, { marginBottom: 10 }]}>A primeira é a principal: aparece no card, nas listas e no campinho.</Text>
      <View style={styles.grid}>
        {slots.map((url, i) =>
          url ? (
            <Pressable key={url} onPress={() => askPhoto(url, i)} style={styles.slot}>
              <Image source={{ uri: url }} style={styles.img} />
              {i === 0 && (
                <View style={styles.mainBadge}>
                  <Text style={{ color: colors.onPrimary, fontSize: 10, fontWeight: '900' }}>PRINCIPAL</Text>
                </View>
              )}
            </Pressable>
          ) : (
            <Pressable
              key={`vazio-${i}`}
              onPress={i === photos.length && !uploading ? askAdd : undefined}
              style={[styles.slot, styles.empty, i === photos.length && { borderColor: colors.primary }]}
            >
              {uploading && i === photos.length ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                i === photos.length && <Ionicons name="add-circle" size={32} color={colors.primary} />
              )}
            </Pressable>
          ),
        )}
      </View>

      <SectionTitle>Sobre você</SectionTitle>
      <Input label="Nome *" value={name} onChangeText={setName} />
      <Input label="Apelido" value={nickname} onChangeText={setNickname} placeholder="Como te chamam na pelada" />
      <Input
        label="Data de nascimento"
        value={birth}
        onChangeText={(v) => setBirth(maskDate(v))}
        placeholder="dd/mm/aaaa"
        keyboardType="number-pad"
        maxLength={10}
      />
      <Input label="Cidade / bairro" value={city} onChangeText={setCity} placeholder="Ex.: Porto Alegre - Menino Deus" />
      <Input
        label={`Bio (${bio.length}/300)`}
        value={bio}
        onChangeText={(v) => setBio(v.slice(0, 300))}
        placeholder="Ex.: Meia raçudo, chego cedo e levo a bola 😅"
        multiline
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />

      <SectionTitle>Em campo</SectionTitle>
      <Label>Posição principal</Label>
      <View style={styles.chips}>
        {POSITIONS.map((p) => (
          <Chip key={p.key} label={p.label} selected={position === p.key} color={positionColors[p.key]} onPress={() => setPosition(p.key)} />
        ))}
      </View>
      <Label>Também joga de</Label>
      <View style={styles.chips}>
        {POSITIONS.filter((p) => p.key !== position).map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            selected={second === p.key}
            color={positionColors[p.key]}
            onPress={() => setSecond(second === p.key ? null : p.key)}
          />
        ))}
      </View>
      <Label>Pé</Label>
      <View style={styles.chips}>
        {FEET.map((f) => (
          <Chip key={f.key} label={f.label} selected={foot === f.key} onPress={() => setFoot(foot === f.key ? null : f.key)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Altura (cm)" value={height} onChangeText={(v) => setHeight(digits(v, 3))} keyboardType="number-pad" placeholder="178" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Peso (kg)" value={weight} onChangeText={(v) => setWeight(digits(v, 3))} keyboardType="number-pad" placeholder="75" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Camisa" value={shirt} onChangeText={(v) => setShirt(digits(v, 2))} keyboardType="number-pad" placeholder="10" />
        </View>
      </View>
      <Input label="Time do coração" value={team} onChangeText={setTeam} placeholder="Ex.: Inter" />

      <Label>Como você se avalia</Label>
      <Card>
        {SKILLS.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={text.body}>{s.label}</Text>
            <Stars value={skills[s.key]} onChange={(v) => setSkills({ ...skills, [s.key]: v })} />
          </View>
        ))}
      </Card>

      <SectionTitle>Contato</SectionTitle>
      <Text style={[text.muted, { marginBottom: 10 }]}>Só quem está em algum grupo com você consegue ver.</Text>
      <Input label="WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(51) 99999-9999" />
      <Input label="Instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" placeholder="@seuperfil" />

      <Button title={busy ? 'Salvando...' : 'Salvar perfil'} icon="checkmark" onPress={save} disabled={busy} style={{ marginTop: 8 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  slot: { width: '31.8%', aspectRatio: 4 / 5, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card },
  img: { width: '100%', height: '100%' },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  mainBadge: { position: 'absolute', left: 6, bottom: 6, backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
});
