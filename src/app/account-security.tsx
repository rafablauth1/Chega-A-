import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { PasswordChecklist, PasswordField } from '@/components/PasswordField';
import { Button, Card, Screen, SectionTitle, text } from '@/components/ui';
import { useAuth } from '@/auth';
import { changePassword, passwordErrorMessage, signOutEverywhere } from '@/accountSecurity';
import { colors } from '@/theme';
import { confirm, notify } from '@/utils/confirm';
import { validateNewPassword } from '@/utils/password';

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AccountSecurityScreen() {
  const { session, profile } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  const email = session?.user.email ?? '';

  const save = async () => {
    if (!current) return notify('Senha atual', 'Digite sua senha atual para confirmar que é você.');
    if (next !== again) return notify('Senhas diferentes', 'A confirmação não bate com a senha nova.');
    if (next === current) return notify('Mesma senha', 'A senha nova precisa ser diferente da atual.');
    setBusy(true);
    try {
      const problem = await validateNewPassword(next, { email, name: profile?.name });
      if (problem) return notify('Senha fraca', problem);
      await changePassword(email, current, next);
      setCurrent('');
      setNext('');
      setAgain('');
      notify('Senha alterada ✅', 'Os outros aparelhos conectados na sua conta foram desconectados.');
    } catch (e: any) {
      notify('Não deu certo', passwordErrorMessage(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const everywhere = () =>
    confirm(
      'Sair de todos os aparelhos',
      'Desconecta sua conta de todos os celulares, inclusive este. Use se perdeu um celular ou acha que alguém entrou na sua conta.',
      () => signOutEverywhere(),
      'Sair de todos',
    );

  return (
    <Screen>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="shield-checkmark" size={22} color={colors.success} />
          <Text style={text.title}>Sua conta</Text>
        </View>
        <Text style={text.muted}>E-mail: {email}</Text>
        <Text style={text.muted}>Último acesso: {when(session?.user.last_sign_in_at)}</Text>
        <Text style={text.muted}>Conta criada em: {when(session?.user.created_at)}</Text>
      </Card>

      <SectionTitle>Trocar senha</SectionTitle>
      <PasswordField label="Senha atual" value={current} onChangeText={setCurrent} autoComplete="current-password" textContentType="password" />
      <PasswordField label="Senha nova" value={next} onChangeText={setNext} autoComplete="new-password" textContentType="newPassword" />
      <PasswordChecklist password={next} email={email} name={profile?.name} />
      <PasswordField
        label="Repita a senha nova"
        value={again}
        onChangeText={setAgain}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={save}
      />
      <Button title={busy ? 'Salvando...' : 'Salvar senha nova'} icon="key" onPress={save} disabled={busy} />

      <SectionTitle>Aparelhos</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Text style={text.muted}>
          Perdeu o celular ou desconfia que alguém entrou na sua conta? Troque a senha acima e depois saia de todos os aparelhos.
        </Text>
        <Button title="Sair de todos os aparelhos" icon="phone-portrait-outline" variant="danger" onPress={everywhere} />
      </Card>

      <SectionTitle>Como protegemos sua conta</SectionTitle>
      <Card style={{ gap: 6 }}>
        {[
          'Sua senha é guardada embaralhada (hash). Nem a equipe do app consegue ver.',
          'O login fica cifrado no cofre do seu celular.',
          'Senhas que já vazaram em outros sites são recusadas.',
          'Para redefinir a senha, pedimos o código do e-mail e a sua data de nascimento.',
          'Nunca pedimos senha ou código por mensagem, WhatsApp ou ligação.',
        ].map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
            <Ionicons name="checkmark" size={16} color={colors.success} style={{ marginTop: 2 }} />
            <Text style={[text.muted, { flex: 1 }]}>{t}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
