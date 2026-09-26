import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Input, Screen, Segmented, text } from '@/components/ui';
import { authErrorMessage, useAuth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { notify } from '@/utils/confirm';

type Mode = 'join' | 'create';

export default function GroupJoinScreen() {
  const { refresh, setActiveGroup } = useAuth();
  const [mode, setMode] = useState<Mode>('join');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    let groupId: string | null = null;
    let error: { message: string } | null = null;
    if (mode === 'join') {
      if (!code.trim()) {
        setBusy(false);
        return notify('Digite o código de convite');
      }
      const res = await supabase.rpc('join_group', { code: code.trim() });
      groupId = res.data;
      error = res.error;
    } else {
      if (!name.trim()) {
        setBusy(false);
        return notify('Dê um nome para o grupo');
      }
      const res = await supabase.from('groups').insert({ name: name.trim() }).select('id').single();
      groupId = res.data?.id ?? null;
      error = res.error;
    }
    setBusy(false);
    if (error || !groupId) return notify('Não deu certo', authErrorMessage(error?.message ?? ''));
    await refresh();
    setActiveGroup(groupId);
    router.replace({ pathname: '/group/[id]', params: { id: groupId } });
  };

  return (
    <Screen>
      <Segmented
        options={[
          { key: 'join', label: 'Entrar com código' },
          { key: 'create', label: 'Criar grupo' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <View style={{ height: 16 }} />
      {mode === 'join' ? (
        <>
          <Text style={[text.muted, { marginBottom: 12 }]}>Peça o código de 6 letras para quem organiza a pelada.</Text>
          <Input
            label="Código de convite"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="EX: A1B2C3"
            autoCapitalize="characters"
            maxLength={6}
            style={{ fontSize: 22, letterSpacing: 4, fontWeight: '800' }}
          />
        </>
      ) : (
        <>
          <Text style={[text.muted, { marginBottom: 12 }]}>Você vira o dono e pode convidar a galera com um código.</Text>
          <Input label="Nome do grupo" value={name} onChangeText={setName} placeholder="Ex: Pelada de quinta" />
        </>
      )}
      <Button
        title={busy ? 'Aguarde...' : mode === 'join' ? 'Entrar no grupo' : 'Criar grupo'}
        icon={mode === 'join' ? 'enter' : 'add-circle'}
        onPress={submit}
        disabled={busy}
      />
    </Screen>
  );
}
