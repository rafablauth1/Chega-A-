import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { birthToIso, PasswordChecklist, PasswordField } from '@/components/PasswordField';
import { Button, Card, Input, Screen, text } from '@/components/ui';
import { useAuth } from '@/auth';
import { completeReset, passwordErrorMessage, requestResetCode, serverSecuritySettings } from '@/accountSecurity';
import { SECURITY } from '@/config/security';
import { colors, fonts } from '@/theme';
import { notify } from '@/utils/confirm';
import { maskDate } from '@/utils/format';
import { validateNewPassword } from '@/utils/password';

/**
 * Esqueci minha senha, em 2 passos:
 *  1. e-mail (+ data de nascimento) → o Supabase manda um código por e-mail
 *  2. código + senha nova → o servidor confere a data de nascimento e só então troca a senha
 * A data NÃO é conferida no passo 1, de propósito: assim ninguém usa esta tela para descobrir
 * a data de nascimento de um e-mail sem ter acesso à caixa de entrada.
 */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { setHoldSession } = useAuth();
  const [step, setStep] = useState<'request' | 'code'>('request');
  const [askBirth, setAskBirth] = useState<boolean>(SECURITY.reset.askBirthDate);
  const [email, setEmail] = useState(params.email ?? '');
  const [birth, setBirth] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    serverSecuritySettings()
      .then((s) => setAskBirth(s.reset_requires_birthdate))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const mail = email.trim().toLowerCase();

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return notify('E-mail inválido', 'Confira o e-mail da sua conta.');
    if (askBirth && !birthToIso(birth)) return notify('Data de nascimento', 'Use o formato dd/mm/aaaa, a mesma do cadastro.');
    setBusy(true);
    try {
      await requestResetCode(mail);
      setStep('code');
      setCooldown(60);
    } catch (e: any) {
      notify('Espere um pouco', passwordErrorMessage(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    const digits = code.replace(/\D/g, '');
    if (digits.length < SECURITY.reset.codeLength)
      return notify('Código', `Digite os ${SECURITY.reset.codeLength} números que chegaram no e-mail.`);
    if (password !== confirmPw) return notify('Senhas diferentes', 'A confirmação não bate com a senha nova.');
    setBusy(true);
    const problem = await validateNewPassword(password, { email: mail });
    if (problem) {
      setBusy(false);
      return notify('Senha fraca', problem);
    }
    // Segura a sessão aberta pelo código: só entra no app depois da senha nova salva
    setHoldSession(true);
    const { result, message } = await completeReset({
      email: mail,
      code: digits,
      birth: askBirth ? birthToIso(birth) : null,
      password,
    });
    setBusy(false);
    setHoldSession(false);
    if (result === 'ok')
      return notify('Senha alterada ✅', 'Você já está dentro. Os outros aparelhos conectados na sua conta foram desconectados.');
    if (result === 'bad_code') return notify('Código inválido', 'Código errado ou vencido. Confira o e-mail ou peça um novo.');
    if (result === 'wrong_birth')
      return notify('Dados não conferem', 'A data de nascimento não bate com a do cadastro. Confira e peça um código novo.');
    if (result === 'locked') return notify('Bloqueado por hoje', 'Muitas tentativas erradas. Por segurança, tente de novo amanhã.');
    notify('Não deu certo', passwordErrorMessage(message));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', marginVertical: 16, gap: 8 }}>
          <Ionicons name="key" size={40} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 24, fontFamily: fonts.display, textAlign: 'center' }}>
            {step === 'request' ? 'Vamos criar uma senha nova' : 'Confira seu e-mail'}
          </Text>
          <Text style={[text.muted, { textAlign: 'center' }]}>
            {step === 'request'
              ? askBirth
                ? 'Informe o e-mail e a data de nascimento do seu cadastro. Vamos mandar um código para o e-mail.'
                : 'Informe o e-mail da sua conta. Vamos mandar um código para ele.'
              : `Se ${mail} tiver conta, chegou um código de ${SECURITY.reset.codeLength} números. Olhe também no spam.`}
          </Text>
        </View>

        {step === 'request' ? (
          <>
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            {askBirth && (
              <Input
                label="Data de nascimento"
                value={birth}
                onChangeText={(v) => setBirth(maskDate(v))}
                placeholder="dd/mm/aaaa"
                keyboardType="number-pad"
                maxLength={10}
              />
            )}
            <Button title={busy ? 'Enviando...' : 'Enviar código'} icon="mail" onPress={sendCode} disabled={busy} />
          </>
        ) : (
          <>
            <Input
              label="Código do e-mail"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))}
              placeholder={'0'.repeat(SECURITY.reset.codeLength)}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center', fontFamily: fonts.bold }}
            />
            <PasswordField
              label="Senha nova"
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <PasswordChecklist password={password} email={mail} />
            <PasswordField
              label="Repita a senha nova"
              value={confirmPw}
              onChangeText={setConfirmPw}
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={finish}
            />
            <Button title={busy ? 'Conferindo...' : 'Salvar senha nova'} icon="shield-checkmark" onPress={finish} disabled={busy} />
            <Button
              title={cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
              variant="ghost"
              disabled={cooldown > 0 || busy}
              onPress={sendCode}
              style={{ marginTop: 8 }}
            />
            <Button title="Trocar e-mail" variant="ghost" onPress={() => setStep('request')} />
          </>
        )}

        <Card style={{ marginTop: 24, flexDirection: 'row', gap: 10 }}>
          <Ionicons name="lock-closed" size={18} color={colors.muted} />
          <Text style={[text.muted, { flex: 1 }]}>
            Nunca pedimos sua senha por mensagem. O código vale por pouco tempo e só funciona uma vez.
          </Text>
        </Card>
        <Button title="Voltar para o login" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
