import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { birthToIso, PasswordChecklist, PasswordField } from '@/components/PasswordField';
import { Button, Input, Screen, Segmented, text } from '@/components/ui';
import { ageOf, authErrorMessage } from '@/auth';
import { clearLoginLock, loginLockRemaining, registerLoginFailure } from '@/accountSecurity';
import { SECURITY } from '@/config/security';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';
import { notify } from '@/utils/confirm';
import { maskDate } from '@/utils/format';
import { validateNewPassword } from '@/utils/password';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birth, setBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState(0);

  // Trava depois de muitas senhas erradas seguidas (config em src/config/security.ts)
  useEffect(() => {
    loginLockRemaining().then(setLock);
  }, []);
  useEffect(() => {
    if (lock <= 0) return;
    const t = setTimeout(() => setLock((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lock]);

  const mail = email.trim().toLowerCase();

  const signIn = async () => {
    if (!mail || !password) return notify('Preencha e-mail e senha');
    const wait = await loginLockRemaining();
    if (wait > 0) return setLock(wait);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setBusy(false);
    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        const locked = await registerLoginFailure();
        if (locked) setLock(locked);
      }
      return notify('Não deu certo', authErrorMessage(error.message));
    }
    await clearLoginLock();
    // Com sessão, o layout raiz troca para o app sozinho
  };

  const signUp = async () => {
    if (!name.trim()) return notify('Informe seu nome');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return notify('E-mail inválido', 'Confira o e-mail.');
    const birthIso = birth ? birthToIso(birth) : null;
    if (SECURITY.signup.requireBirthDate && !birthIso)
      return notify('Data de nascimento', 'Use o formato dd/mm/aaaa. Ela também serve para recuperar sua senha.');
    if (birthIso && (ageOf(birthIso) ?? 0) < SECURITY.signup.minAge)
      return notify('Idade mínima', `O app é para quem tem ${SECURITY.signup.minAge} anos ou mais.`);
    if (password !== confirmPw) return notify('Senhas diferentes', 'A confirmação não bate com a senha.');
    setBusy(true);
    const problem = await validateNewPassword(password, { email: mail, name });
    if (problem) {
      setBusy(false);
      return notify('Senha fraca', problem);
    }
    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { data: { name: name.trim(), birth_date: birthIso } },
    });
    setBusy(false);
    if (error) return notify('Não deu certo', authErrorMessage(error.message));
    if (!data.session) {
      notify('Conta criada!', 'Enviamos um link de confirmação para o seu e-mail. Depois é só entrar.');
      setMode('signin');
      setPassword('');
      setConfirmPw('');
    }
  };

  const submit = mode === 'signin' ? signIn : signUp;
  const locked = mode === 'signin' && lock > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 28 }}>
          <Image
            source={require('../../assets/android-icon-foreground.png')}
            style={{ width: 88, height: 88 }}
            resizeMode="contain"
          />
          <Text style={{ color: colors.text, fontSize: 30, fontFamily: fonts.displayBlack, marginTop: 4 }}>Vaia Aí</Text>
          <Text style={[text.muted, { marginTop: 4 }]}>Sua pelada organizada</Text>
        </View>

        <Segmented
          options={[
            { key: 'signin', label: 'Entrar' },
            { key: 'signup', label: 'Criar conta' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <View style={{ height: 16 }} />

        {mode === 'signup' && (
          <Input label="Seu nome" value={name} onChangeText={setName} placeholder="Como a galera te chama" autoComplete="name" />
        )}
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="voce@email.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        {mode === 'signup' && (
          <Input
            label={SECURITY.signup.requireBirthDate ? 'Data de nascimento' : 'Data de nascimento (opcional)'}
            value={birth}
            onChangeText={(v) => setBirth(maskDate(v))}
            placeholder="dd/mm/aaaa"
            keyboardType="number-pad"
            maxLength={10}
          />
        )}
        <PasswordField
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signup' ? 'Crie uma senha forte' : 'Sua senha'}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signup' ? 'newPassword' : 'password'}
          onSubmitEditing={mode === 'signin' ? submit : undefined}
        />
        {mode === 'signup' && (
          <>
            <PasswordChecklist password={password} email={mail} name={name} />
            <PasswordField
              label="Repita a senha"
              value={confirmPw}
              onChangeText={setConfirmPw}
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={submit}
            />
          </>
        )}

        <Button
          title={
            busy ? 'Aguarde...' : locked ? `Muitas tentativas. Aguarde ${lock}s` : mode === 'signin' ? 'Entrar' : 'Criar conta'
          }
          icon={mode === 'signin' ? 'log-in' : 'person-add'}
          onPress={submit}
          disabled={busy || locked}
        />
        {mode === 'signin' && (
          <Button
            title="Esqueci minha senha"
            variant="ghost"
            onPress={() => router.push({ pathname: '/reset-password', params: { email: mail } })}
            style={{ marginTop: 8 }}
          />
        )}

        <Text style={[text.muted, { textAlign: 'center', marginTop: 24, lineHeight: 20 }]}>
          {mode === 'signup' ? 'Ao criar a conta, você concorda com os ' : 'Ao usar o app, você concorda com os '}
          <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/termos')}>
            Termos de Uso
          </Text>
          {' e a '}
          <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/privacidade')}>
            Política de Privacidade
          </Text>
          .
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
