import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/auth';
import {
  COMMUNITY_KINDS,
  COMMUNITY_ROLE_LABEL,
  communityError,
  createCommunity,
  joinCommunity,
  kindInfo,
  listMyCommunities,
  type Community,
  type CommunityKind,
} from '@/community';
import { Button, Chip, Empty, Group, Input, Row, Screen, SectionTitle, Segmented, Tag, text } from '@/components/ui';
import { colors, fonts } from '@/theme';
import { notify } from '@/utils/confirm';

type Mode = 'join' | 'create';

export default function CommunitiesScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [list, setList] = useState<Community[] | null>(null);
  const [mode, setMode] = useState<Mode>('join');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CommunityKind>('empresa');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    listMyCommunities(userId)
      .then(setList)
      .catch((e) => {
        setList([]);
        notify('Não deu para carregar', communityError(e.message));
      });
  }, [userId]);

  useFocusEffect(load);

  const submit = async () => {
    try {
      setBusy(true);
      let id: string;
      if (mode === 'join') {
        if (code.trim().length < 6) return notify('Digite o código de 6 letras');
        id = await joinCommunity(code);
      } else {
        if (name.trim().length < 2) return notify('Dê um nome para a comunidade');
        id = await createCommunity({ name, kind, description });
      }
      setCode('');
      setName('');
      setDescription('');
      router.push({ pathname: '/community/[id]', params: { id } });
    } catch (e: any) {
      notify('Não deu certo', communityError(e.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={[text.body, { color: colors.muted, lineHeight: 22, marginBottom: 8 }]}>
        Uma comunidade junta vários times: a empresa com o time de cada setor, a escola com o time de cada turma. Tem
        ranking entre os times e artilharia geral.
      </Text>

      {list && list.length > 0 && (
        <>
          <SectionTitle>Minhas comunidades</SectionTitle>
          <Group>
            {list.map((c) => (
              <Row key={c.id} onPress={() => router.push({ pathname: '/community/[id]', params: { id: c.id } })}>
                <Text style={{ fontSize: 26 }}>{kindInfo(c.kind).icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={text.title} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={text.muted}>{kindInfo(c.kind).label}</Text>
                </View>
                {c.role !== 'member' && <Tag label={COMMUNITY_ROLE_LABEL[c.role]} color={colors.gold} />}
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Row>
            ))}
          </Group>
        </>
      )}

      {list && list.length === 0 && (
        <Empty icon="business-outline" title="Nenhuma comunidade ainda" text="Crie a da sua empresa ou escola, ou entre com o código que te mandaram." />
      )}

      <SectionTitle>{mode === 'join' ? 'Entrar numa comunidade' : 'Criar comunidade'}</SectionTitle>
      <Segmented
        options={[
          { key: 'join', label: 'Tenho um código' },
          { key: 'create', label: 'Criar nova' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'join' ? (
        <Input
          label="Código da comunidade"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder="EX: A1B2C3"
          autoCapitalize="characters"
          maxLength={6}
          style={{ fontSize: 24, letterSpacing: 4, fontFamily: fonts.display }}
        />
      ) : (
        <>
          <Input label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Futebol da Empresa X" maxLength={60} />
          <Text style={[text.muted, { marginBottom: 8, fontSize: 14 }]}>Que tipo de comunidade?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 16, flexGrow: 0 }}>
            {COMMUNITY_KINDS.map((k) => (
              <Chip key={k.key} label={`${k.icon} ${k.label}`} selected={kind === k.key} onPress={() => setKind(k.key)} />
            ))}
          </ScrollView>
          <Input
            label="Descrição (opcional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Ex.: Pelada entre os setores, toda sexta depois do expediente"
            multiline
            maxLength={280}
          />
        </>
      )}

      <Button
        title={busy ? 'Aguarde...' : mode === 'join' ? 'Entrar na comunidade' : 'Criar comunidade'}
        icon={mode === 'join' ? 'enter-outline' : 'add-circle-outline'}
        onPress={submit}
        disabled={busy}
      />
    </Screen>
  );
}
