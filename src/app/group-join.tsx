import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, Input, Screen, Segmented, text } from '@/components/ui';
import { useAuth } from '@/auth';
import { clubError, createClub, joinByCode } from '@/clubs';
import { colors, fonts } from '@/theme';
import { notify } from '@/utils/confirm';
import { parseMoney } from '@/utils/format';

type Mode = 'join' | 'create';

export default function GroupJoinScreen() {
  const { refresh, setActiveGroup } = useAuth();
  const [mode, setMode] = useState<Mode>('join');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [fee, setFee] = useState('80');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (code.trim().length < 6) return notify('Digite o código de convite', 'São 6 letras e números.');
    setBusy(true);
    try {
      const r = await joinByCode(code);
      await refresh();
      setActiveGroup(r.groupId);
      // Jogo avulso: abre direto o jogo para confirmar presença
      if (r.kind === 'avulso' && r.gameId) router.replace({ pathname: '/game/[id]', params: { id: r.gameId, group: r.groupId } });
      else router.replace({ pathname: '/group/[id]', params: { id: r.groupId } });
    } catch (e: any) {
      notify('Não deu certo', clubError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!name.trim()) return notify('Dê um nome para o clube');
    setBusy(true);
    try {
      const id = await createClub({ name, monthlyEnabled: monthly, monthlyFee: monthly ? parseMoney(fee) : undefined });
      await refresh();
      setActiveGroup(id);
      router.replace({ pathname: '/group/[id]', params: { id } });
    } catch (e: any) {
      notify('Não deu certo', clubError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Segmented
        options={[
          { key: 'join', label: 'Entrar com código' },
          { key: 'create', label: 'Criar clube' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <View style={{ height: 16 }} />
      {mode === 'join' ? (
        <>
          <Text style={[text.muted, { marginBottom: 12 }]}>
            Serve para clube e para jogo avulso: peça o código de 6 letras para quem organiza.
          </Text>
          <Input
            label="Código de convite"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="EX: A1B2C3"
            autoCapitalize="characters"
            maxLength={6}
            style={{ fontSize: 22, letterSpacing: 4, fontFamily: fonts.display }}
          />
          <Button title={busy ? 'Aguarde...' : 'Entrar'} icon="enter" onPress={join} disabled={busy} />
        </>
      ) : (
        <>
          <Text style={[text.muted, { marginBottom: 12 }]}>
            O clube é a pelada fixa: você vira o dono, convida a galera e marca os jogos lá dentro.
          </Text>
          <Input label="Nome do clube" value={name} onChangeText={setName} placeholder="Ex: Pelada de quinta" />
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={text.title}>Tem mensalista?</Text>
                <Text style={text.muted}>
                  {monthly
                    ? 'Mensalistas pagam por mês e avulsos por jogo. Aparece o controle de mensalidades.'
                    : 'Todo mundo paga por jogo. Dá para ligar depois nos ajustes do clube.'}
                </Text>
              </View>
              <Switch value={monthly} onValueChange={setMonthly} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>
            {monthly && <Input label="Mensalidade (R$)" value={fee} onChangeText={setFee} keyboardType="decimal-pad" />}
          </Card>
          <Button title={busy ? 'Aguarde...' : 'Criar clube'} icon="add-circle" onPress={create} disabled={busy} style={{ marginTop: 8 }} />
        </>
      )}

      <Card onPress={() => router.push('/single-game')} style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="flash" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={text.title}>Só um jogo, sem clube?</Text>
          <Text style={text.muted}>Marque um jogo avulso, convide a galera e, se quiser, publique no Bora.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Card>
    </Screen>
  );
}
