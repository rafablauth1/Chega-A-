import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { Avatar, Button, Card, Screen, SectionTitle, Tag, text, type IconName } from '@/components/ui';
import { authErrorMessage, ROLE_LABEL, useAuth, type Profile, type Role } from '@/auth';
import { supabase } from '@/lib/supabase';
import { colors, positionColors } from '@/theme';
import { confirm, notify } from '@/utils/confirm';

interface Member {
  user_id: string;
  role: Role;
  type: 'mensalista' | 'avulso';
  profile?: Profile;
}

interface Group {
  id: string;
  name: string;
  invite_code: string;
}

const ROLE_ORDER: Record<Role, number> = { owner: 0, admin: 1, player: 2 };

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, refresh, activeGroup, setActiveGroup } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [g, m] = await Promise.all([
      supabase.from('groups').select('id, name, invite_code').eq('id', id).single(),
      supabase.from('group_members').select('user_id, role, type').eq('group_id', id),
    ]);
    const rows = (m.data ?? []) as Member[];
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', rows.map((r) => r.user_id));
    setGroup(g.data);
    setMembers(
      rows
        .map((r) => ({ ...r, profile: profiles?.find((p) => p.id === r.user_id) as Profile | undefined }))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || (a.profile?.name ?? '').localeCompare(b.profile?.name ?? '')),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Screen>{null}</Screen>;
  if (!group) {
    return (
      <Screen>
        <Text style={text.body}>Grupo não encontrado.</Text>
      </Screen>
    );
  }

  const myRole = members.find((m) => m.user_id === session?.user.id)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  const run = async (op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op;
    if (error) notify('Não deu certo', authErrorMessage(error.message));
    await load();
  };

  const updateMember = (userId: string, patch: Partial<Pick<Member, 'role' | 'type'>>) =>
    run(supabase.from('group_members').update(patch).eq('group_id', id).eq('user_id', userId));

  const removeMember = (m: Member) =>
    confirm('Remover do grupo', `Tirar ${m.profile?.name ?? 'este jogador'} do grupo?`, () =>
      run(supabase.from('group_members').delete().eq('group_id', id).eq('user_id', m.user_id)),
    'Remover');

  const leave = () =>
    confirm('Sair do grupo', `Você sai de "${group.name}". Para voltar, vai precisar do código de convite.`, async () => {
      await supabase.from('group_members').delete().eq('group_id', id).eq('user_id', session!.user.id);
      await refresh();
      router.back();
    }, 'Sair');

  const deleteGroup = () =>
    confirm('Apagar grupo', `Apagar "${group.name}" para todos os membros? Não dá para desfazer.`, async () => {
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) return notify('Não deu certo', authErrorMessage(error.message));
      await refresh();
      router.back();
    }, 'Apagar');

  const invite = () =>
    Share.share({
      message: `Bora pro ${group.name}! ⚽\nBaixe o app Vaia Aí, crie sua conta e entre com o código: ${group.invite_code}`,
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: group.name }} />

      {activeGroup?.id !== group.id && (
        <Button
          title="Abrir jogos deste grupo"
          icon="football"
          style={{ marginBottom: 12 }}
          onPress={() => {
            setActiveGroup(group.id);
            router.dismissTo('/');
          }}
        />
      )}

      <Card style={{ alignItems: 'center' }}>
        <Text style={text.muted}>Código de convite</Text>
        <Pressable
          onPress={async () => {
            await Clipboard.setStringAsync(group.invite_code);
            notify('Código copiado!');
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 34, fontWeight: '900', letterSpacing: 6, marginVertical: 6 }}>
            {group.invite_code}
          </Text>
        </Pressable>
        <Button title="Convidar pelo WhatsApp" icon="share-social" onPress={invite} style={{ alignSelf: 'stretch' }} />
      </Card>

      <SectionTitle right={<Text style={text.muted}>{members.length}</Text>}>Membros</SectionTitle>
      {members.map((m) => {
        const name = m.profile?.nickname || m.profile?.name || 'Jogador';
        const isMe = m.user_id === session?.user.id;
        const editable = canManage && m.role !== 'owner' && !isMe;
        return (
          <Card key={m.user_id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: m.user_id } })}>
                <Avatar name={name} photo={m.profile?.photos?.[0]} color={positionColors[m.profile?.position ?? 'MEI']} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={text.title}>
                  {name}
                  {isMe ? ' (você)' : ''}
                </Text>
                <Text style={text.muted}>
                  {m.profile?.position ?? ''} · {m.type === 'mensalista' ? 'Mensalista' : 'Avulso'}
                </Text>
              </View>
              <Tag label={ROLE_LABEL[m.role]} color={m.role === 'player' ? colors.muted : colors.gold} />
            </View>
            {editable && (
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                <Action
                  icon={m.role === 'admin' ? 'shield-outline' : 'shield-checkmark'}
                  label={m.role === 'admin' ? 'Tirar admin' : 'Tornar admin'}
                  onPress={() => updateMember(m.user_id, { role: m.role === 'admin' ? 'player' : 'admin' })}
                />
                <Action
                  icon="swap-horizontal"
                  label={m.type === 'mensalista' ? 'Virar avulso' : 'Virar mensalista'}
                  onPress={() => updateMember(m.user_id, { type: m.type === 'mensalista' ? 'avulso' : 'mensalista' })}
                />
                <Action icon="person-remove" label="Remover" color={colors.danger} onPress={() => removeMember(m)} />
              </View>
            )}
          </Card>
        );
      })}

      {myRole === 'owner' ? (
        <Button title="Apagar grupo" icon="trash" variant="danger" onPress={deleteGroup} style={{ marginTop: 24 }} />
      ) : (
        <Button title="Sair do grupo" icon="exit" variant="danger" onPress={leave} style={{ marginTop: 24 }} />
      )}
    </Screen>
  );
}

function Action({ icon, label, onPress, color = colors.primary }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
