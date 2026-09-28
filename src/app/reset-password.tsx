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
 * Esqueci minha senha:
 *  1. "request": e-mail (+ data de nascimento) → o Supabase manda um e-mail
 *  2. "sent": a pessoa toca no LINK do e-mail neste celular (abre o app aqui com ?code=)
 *     ou digita o CÓDIGO, se o modelo do e-mail tiver um
 *  3. "newpass": data de nascimento + senha nova → o servidor confere a data e só então troca
 * A data NÃO é conferida no passo 1, de propósito: assim ninguém usa esta tela para descobrir
 * a data de nascimento de um e-mail sem ter acesso à caixa de entrada.
 */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; code?: string; error_description?: string }>();
  const { setHoldSession } = useAuth();
  const linkCode = typeof params.code === 'string' && params.code ? params.code : undefined;
  const [step, setStep] = useState<'request' | 'sent' | 'newpass'>(linkCode ? 'newpass' : 'request');
  const [askBirth, setAskBirth] = useState<boolean>(SECURITY.reset.askBirthDate);
  const [email, setEmail] = useState(params.email ?? '');
  const [birth, setBirth] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    serverSecuritySettings()
      .then((s) => setAskBirth(s.reset_requires_birthdate))
      .catch(() => {});
  }, []);

  // Link vencido ou já usado: o Supabase volta com o erro no endereço
  useEffect(() => {
    if (params.error_description)
      notify('Link inválido', 'O link venceu ou já foi usado. Peça um novo e abra no mesmo celular em que pediu.');
  }, [params.error_description]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const mail = email.trim().toLowerCase();

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return notify('E-mail inválido', 'Confira o e-mail da sua conta.');
    if (askBirth && !birthToIso(birth)) return notify('Data de nascimento', 'Use o formato dd/mm/aaaa, a mesma do cadastro.');
    setBusy(true);
    try {
      await requestResetCode(mail);
      setStep('sent');
      setCooldown(60);
    } catch (e: any) {
      notify('Espere um pouco', passwordErrorMessage(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const goWithOtp = () => {
    if (otp.replace(/\D/g, '').length < SECURITY.reset.codeLength)
      return notify('Código', `Digite os ${SECURITY.reset.codeLength} números que chegaram no e-mail.`);
    setStep('newpass');
  };

  const finish = async () => {
    if (askBirth && !birthToIso(birth)) return notify('Data de nascimento', 'Use o formato dd/mm/aaaa, a mesma do cadastro.');
    if (password !== confirmPw) return notify('Senhas diferentes', 'A confirmação não bate com a senha nova.');
    setBusy(true);
    const problem = await validateNewPassword(password, { email: mail });
    if (problem) {
      setBusy(false);
      return notify('Senha fraca', problem);
    }
    // Segura a sessão aberta pelo link/código: só entra no app depois da senha nova salva
    setHoldSession(true);
    const { result, message } = await completeReset({
      linkCode,
      otp: linkCode ? undefined : { email: mail, code: otp.replace(/\D/g, '') },
      birth: askBirth ? birthToIso(birth) : null,
      password,
    });
    setBusy(false);
    setHoldSession(false);
    if (result === 'ok')
      return notify('Senha alterada ✅', 'Você já está dentro. Os outros aparelhos conectados na sua conta foram desconectados.');
    const again = () => {
      setStep('request');
      setPassword('');
      setConfirmPw('');
      setOtp('');
      router.setParams({ code: undefined });
    };
    if (result === 'bad_code') {
      again();
      return notify('Link ou código inválido', 'Venceu, já foi usado, ou foi aberto em outro celular. Peça um novo.');
    }
    if (result === 'wrong_birth') {
      again();
      return notify('Dados não conferem', 'A data de nascimento não bate com a do cadastro. Confira e peça um novo e-mail.');
    }
    if (result === 'locked') return notify('Bloqueado por hoje', 'Muitas tentativas erradas. Por segurança, tente de novo amanhã.');
    notify('Não deu certo', passwordErrorMessage(message));
  };

  const title = { request: 'Vamos criar uma senha nova', sent: 'Confira seu e-mail', newpass: 'Crie sua senha nova' }[step];
  const subtitle = {
    request: askBirth
      ? 'Informe o e-mail e a data de nascimento do seu cadastro. Vamos mandar um e-mail para você.'
      : 'Informe o e-mail da sua conta. Vamos mandar um e-mail para você.',
    sent: `Se ${mail} tiver conta, chegou um e-mail. Abra ele NESTE celular e toque no link: o app abre sozinho aqui. Olhe também no spam.`,
    newpass: askBirth ? 'Confirme sua data de nascimento e escolha a senha nova.' : 'Escolha a senha nova.',
  }[step];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', marginVertical: 16, gap: 8 }}>
          <Ionicons name={step === 'sent' ? 'mail-open' : 'key'} size={40} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 24, fontFamily: fonts.display, textAlign: 'center' }}>{title}</Text>
          <Text style={[text.muted, { textAlign: 'center' }]}>{subtitle}</Text>
        </View>

        {step === 'request' && (
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
            <Button title={busy ? 'Enviando...' : 'Enviar e-mail'} icon="mail" onPress={send} disabled={busy} />
          </>
        )}

        {step === 'sent' && (
          <>
            <Card style={{ gap: 8 }}>
              <Text style={text.title}>O e-mail trouxe um código de números?</Text>
              <Input
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 10))}
                placeholder={'0'.repeat(SECURITY.reset.codeLength)}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center', fontFamily: fonts.bold }}
              />
              <Button title="Usar o código" variant="secondary" icon="keypad" onPress={goWithOtp} />
            </Card>
            <Button
              title={cooldown > 0 ? `Reenviar e-mail em ${cooldown}s` : 'Reenviar e-mail'}
              variant="ghost"
              disabled={cooldown > 0 || busy}
              onPress={send}
              style={{ marginTop: 8 }}
            />
            <Button title="Trocar e-mail" variant="ghost" onPress={() => setStep('request')} />
          </>
        )}

        {step === 'newpass' && (
          <>
            {askBirth && (
              <Input
                label="Data de nascimento do cadastro"
                value={birth}
                onChangeText={(v) => setBirth(maskDate(v))}
                placeholder="dd/mm/aaaa"
                keyboardType="number-pad"
                maxLength={10}
              />
            )}
            <PasswordField label="Senha nova" value={password} onChangeText={setPassword} autoComplete="new-password" textContentType="newPassword" />
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
          </>
        )}

        <Card style={{ marginTop: 24, flexDirection: 'row', gap: 10 }}>
          <Ionicons name="lock-closed" size={18} color={colors.muted} />
          <Text style={[text.muted, { flex: 1 }]}>
            O link só funciona uma vez, por pouco tempo e só no celular que pediu. Nunca pedimos senha ou código por mensagem.
          </Text>
        </Card>
        <Button title="Voltar para o login" variant="ghost" onPress={() => router.replace('/login')} style={{ marginTop: 8 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
