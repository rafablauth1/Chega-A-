import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, Button, Card, Chip, Empty, Input, Label, Screen, SectionTitle, Stars, Tag, text } from '@/components/ui';
import { authErrorMessage, ROLE_LABEL, useAuth } from '@/auth';
import { isCloudEnabled, supabase } from '@/lib/supabase';
import { colors, positionColors } from '@/theme';
import { POSITIONS, SKILLS, type Position, type Skills } from '@/types';
import { confirm, notify } from '@/utils/confirm';

const DEFAULT_SKILLS: Skills = { tecnica: 3, fisico: 3, passe: 3, finalizacao: 3, defesa: 3 };

export default function MeScreen() {
  const { session, profile, groups, refresh } = useAuth();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState<Position>('MEI');
  const [skills, setSkills] = useState<Skills>(DEFAULT_SKILLS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setNickname(profile.nickname ?? '');
    setPhone(profile.phone ?? '');
    setPosition(profile.position);
    setSkills({ ...DEFAULT_SKILLS, ...profile.skills });
  }, [profile]);

  if (!isCloudEnabled) {
    return (
      <Screen>
        <Empty
          icon="cloud-offline-outline"
          title="Contas ainda não ativadas"
          text="Falta ligar o app ao servidor (Supabase). Enquanto isso, tudo continua salvo só neste celular."
        />
      </Screen>
    );
  }
  if (!session || !profile) return <Screen>{null}</Screen>;

  const save = async () => {
    if (!name.trim()) return notify('Informe seu nome');
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), nickname: nickname.trim() || null, phone: phone.trim() || null, position, skills })
      .eq('id', profile.id);
    setBusy(false);
    if (error) return notify('Não deu certo', authErrorMessage(error.message));
    await refresh();
    notify('Perfil salvo!');
  };

  const signOut = () => confirm('Sair da conta', 'Você vai precisar entrar de novo com e-mail e senha.', () => supabase.auth.signOut(), 'Sair');

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Avatar name={name || '?'} size={80} color={positionColors[position]} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 10 }}>{nickname || name}</Text>
        <Text style={text.muted}>{session.user.email}</Text>
      </View>

      <SectionTitle
        right={<Button title="Novo" icon="add" variant="ghost" onPress={() => router.push('/group-join')} />}
      >
        Meus grupos
      </SectionTitle>
      {groups.length === 0 ? (
        <Card>
          <Text style={text.body}>Você ainda não está em nenhum grupo.</Text>
          <Text style={[text.muted, { marginTop: 4 }]}>Crie a sua pelada ou entre com o código que um amigo te mandou.</Text>
          <Button title="Criar ou entrar num grupo" icon="people" style={{ marginTop: 12 }} onPress={() => router.push('/group-join')} />
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.id} onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="football" size={22} color={colors.primary} />
            <Text style={[text.title, { flex: 1 }]}>{g.name}</Text>
            <Tag label={ROLE_LABEL[g.role]} color={g.role === 'player' ? colors.muted : colors.gold} />
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        ))
      )}

      <SectionTitle>Perfil de atleta</SectionTitle>
      <Input label="Nome" value={name} onChangeText={setName} />
      <Input label="Apelido" value={nickname} onChangeText={setNickname} placeholder="Opcional" />
      <Input label="WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(11) 99999-9999" />

      <Label>Posição</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {POSITIONS.map((p) => (
          <Chip key={p.key} label={p.label} selected={position === p.key} color={positionColors[p.key]} onPress={() => setPosition(p.key)} />
        ))}
      </View>

      <Label>Como você se avalia</Label>
      <Card>
        {SKILLS.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={text.body}>{s.label}</Text>
            <Stars value={skills[s.key]} onChange={(v) => setSkills({ ...skills, [s.key]: v })} />
          </View>
        ))}
      </Card>

      <Button title={busy ? 'Salvando...' : 'Salvar perfil'} icon="checkmark" onPress={save} disabled={busy} />
      <Button title="Sair da conta" icon="log-out" variant="danger" onPress={signOut} style={{ marginTop: 24 }} />
    </Screen>
  );
}
