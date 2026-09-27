import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Button, Input, Screen, Segmented, text } from '@/components/ui';
import { authErrorMessage } from '@/auth';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';
import { notify } from '@/utils/confirm';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail || !password) return notify('Preencha e-mail e senha');
    if (mode === 'signup' && !name.trim()) return notify('Informe seu nome');
    setBusy(true);
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: mail, password })
        : await supabase.auth.signUp({ email: mail, password, options: { data: { name: name.trim() } } });
    setBusy(false);
    if (error) return notify('Não deu certo', authErrorMessage(error.message));
    if (mode === 'signup' && !data.session) {
      notify('Conta criada!', 'Enviamos um link de confirmação para o seu e-mail. Depois é só entrar.');
      setMode('signin');
    }
    // Com sessão, o layout raiz troca para o app sozinho
  };

  const resetPassword = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail) return notify('Digite seu e-mail no campo acima');
    const { error } = await supabase.auth.resetPasswordForEmail(mail);
    if (error) return notify('Não deu certo', authErrorMessage(error.message));
    notify('Pronto', 'Se o e-mail tiver conta, você vai receber um link para criar uma nova senha.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 48, marginBottom: 32 }}>
          <Text style={{ fontSize: 56 }}>⚽</Text>
          <Text style={{ color: colors.text, fontSize: 30, fontFamily: fonts.displayBlack, marginTop: 8 }}>Vaia Aí</Text>
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
        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : 'Sua senha'}
          secureTextEntry
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          onSubmitEditing={submit}
        />

        <Button
          title={busy ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          icon={mode === 'signin' ? 'log-in' : 'person-add'}
          onPress={submit}
          disabled={busy}
        />
        {mode === 'signin' && (
          <Button title="Esqueci minha senha" variant="ghost" onPress={resetPassword} style={{ marginTop: 8 }} />
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
