import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { SECURITY } from './config/security';
import { supabase } from './lib/supabase';

/**
 * Senha e sessão: redefinir, trocar, sair de todos os aparelhos.
 * Regras editáveis em src/config/security.ts e na tabela security_settings (migração 010).
 */

export interface ServerSecuritySettings {
  reset_requires_birthdate: boolean;
}

/** Lê as regras do servidor (funciona sem login). Sem a migração 010 ou sem internet, usa o padrão do app. */
export async function serverSecuritySettings(): Promise<ServerSecuritySettings> {
  const { data } = await supabase.from('security_settings').select('reset_requires_birthdate').maybeSingle();
  return { reset_requires_birthdate: data?.reset_requires_birthdate ?? SECURITY.reset.askBirthDate };
}

/** Endereço que o link do e-mail abre: o próprio app (vaiaai://reset-password). Precisa estar em Redirect URLs no Supabase. */
export const resetRedirectUrl = () => Linking.createURL('/reset-password');

/**
 * Passo 1 de "Esqueci minha senha": manda o e-mail (com link para o app e, se o modelo tiver, um código).
 * A resposta é sempre a mesma, exista a conta ou não.
 */
export async function requestResetCode(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: resetRedirectUrl() });
  // Limite de envios é o único erro que vale mostrar; o resto não pode revelar se o e-mail tem conta
  if (error && /rate limit|security purposes/i.test(error.message)) throw error;
}

export type ResetResult = 'ok' | 'bad_code' | 'wrong_birth' | 'locked' | 'error';

/**
 * Passo 2: (código digitado OU link do e-mail) + data de nascimento + senha nova.
 * Ordem: entra com o código/link → servidor confere a data → troca a senha → derruba os outros aparelhos.
 * Se a data não conferir, sai na hora (a sessão aberta pelo código não fica no celular).
 */
export async function completeReset(input: {
  /** Código de 6 números digitado (modelo de e-mail com {{ .Token }}) */
  otp?: { email: string; code: string };
  /** Código que veio no link do e-mail (PKCE; só funciona no celular que pediu) */
  linkCode?: string;
  birth: string | null;
  password: string;
}): Promise<{ result: ResetResult; message?: string }> {
  const { error: otpError } = input.linkCode
    ? await supabase.auth.exchangeCodeForSession(input.linkCode)
    : input.otp
      ? await supabase.auth.verifyOtp({ email: input.otp.email.trim().toLowerCase(), token: input.otp.code.trim(), type: 'recovery' })
      : { error: new Error('missing code') };
  if (otpError) return { result: 'bad_code', message: otpError.message };

  try {
    const { data: verdict, error: vError } = await supabase.rpc('verify_reset_identity', { birth: input.birth });
    // Servidor sem a migração 010: segue só com o código (o comportamento padrão do Supabase)
    if (vError && !/Could not find|does not exist/i.test(vError.message)) throw vError;
    if (verdict === 'wrong' || verdict === 'locked') {
      await supabase.auth.signOut({ scope: 'local' });
      return { result: verdict === 'wrong' ? 'wrong_birth' : 'locked' };
    }

    const { error: upError } = await supabase.auth.updateUser({ password: input.password });
    if (upError) throw upError;

    if (SECURITY.session.signOutOthersOnPasswordChange) await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
    await clearLoginLock();
    return { result: 'ok' };
  } catch (e: any) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return { result: 'error', message: e?.message };
  }
}

/**
 * Troca de senha com a pessoa logada. Pede a senha atual (confirma que é ela mesma, e não alguém
 * com o celular desbloqueado na mão), avisa o servidor e troca.
 */
export async function changePassword(email: string, current: string, next: string) {
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: current });
  if (reauthError) {
    if (/invalid login credentials/i.test(reauthError.message)) throw new Error('current password wrong');
    throw reauthError;
  }
  const { error: tError } = await supabase.rpc('password_change_ticket');
  if (tError && !/Could not find|does not exist/i.test(tError.message)) throw tError;

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw error;
  if (SECURITY.session.signOutOthersOnPasswordChange) await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
}

/** Encerra a sessão em todos os aparelhos, inclusive este. */
export async function signOutEverywhere() {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) await supabase.auth.signOut({ scope: 'local' });
}

// ─── Trava de tentativas de login neste celular ───────────────────────────────
// O Supabase já limita tentativas no servidor; esta trava deixa o chute ainda mais lento e avisa a pessoa.

const LOCK_KEY = 'vaia-ai-login-lock';
interface LockState {
  fails: number;
  rounds: number;
  until: number;
}

async function readLock(): Promise<LockState> {
  try {
    const raw = await AsyncStorage.getItem(LOCK_KEY);
    return raw ? (JSON.parse(raw) as LockState) : { fails: 0, rounds: 0, until: 0 };
  } catch {
    return { fails: 0, rounds: 0, until: 0 };
  }
}

/** Segundos que ainda faltam de espera (0 = pode tentar). */
export async function loginLockRemaining() {
  const s = await readLock();
  return Math.max(0, Math.ceil((s.until - Date.now()) / 1000));
}

/** Registra uma senha errada; devolve os segundos de espera se acabou de travar. */
export async function registerLoginFailure(): Promise<number> {
  const s = await readLock();
  s.fails += 1;
  let wait = 0;
  if (s.fails >= SECURITY.login.maxAttempts) {
    wait = SECURITY.login.lockSeconds * 2 ** Math.min(s.rounds, 6);
    s.rounds += 1;
    s.fails = 0;
    s.until = Date.now() + wait * 1000;
  }
  await AsyncStorage.setItem(LOCK_KEY, JSON.stringify(s)).catch(() => {});
  return wait;
}

export async function clearLoginLock() {
  await AsyncStorage.removeItem(LOCK_KEY).catch(() => {});
}

/** Mensagens de erro de senha/código em português. */
export function passwordErrorMessage(message = ''): string {
  if (/current password wrong/i.test(message)) return 'A senha atual está errada.';
  if (/same.?password|different from the old/i.test(message)) return 'A senha nova precisa ser diferente da atual.';
  if (/identity check|Database error/i.test(message)) return 'O servidor não confirmou sua identidade. Comece a redefinição de novo.';
  if (/reauthenticat/i.test(message)) return 'Por segurança, saia e entre de novo antes de trocar a senha.';
  if (/weak|password should|at least one character/i.test(message))
    return 'O servidor achou a senha fraca. Use maiúscula, minúscula, número e caractere especial.';
  if (/expired|invalid|otp/i.test(message)) return 'Código errado ou vencido. Peça um novo.';
  if (/rate limit|security purposes/i.test(message)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (/network|fetch/i.test(message)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return 'Não deu certo. Tente de novo em instantes.';
}
