import * as Crypto from 'expo-crypto';
import { SECURITY } from '@/config/security';

/**
 * Validação de senha. As regras vêm de src/config/security.ts (mude lá, não aqui).
 * O servidor também valida (Supabase Auth); aqui é para dar o motivo em português e na hora.
 */

const P = SECURITY.password;

/** As mais usadas no Brasil e no mundo (listas públicas de vazamentos). Comparação sem acento/maiúscula. */
const COMMON = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344',
  'password', 'password1', 'senha123', 'senha1234', 'senhasenha', 'mudar123', 'trocar123', 'abc12345',
  'abcd1234', 'qwerty123', 'qwertyuiop', 'asdfghjkl', 'iloveyou', 'teamo123', 'brasil123', 'brasil2026',
  'flamengo', 'flamengo1', 'corinthians', 'palmeiras', 'saopaulo', 'vasco123', 'gremio123', 'inter123',
  'cruzeiro', 'botafogo', 'fluminense', 'santos123', 'futebol1', 'futebol123', 'pelada123', 'vaiaai123',
  'vaiaai2026', 'admin123', 'welcome1', 'bemvindo', 'bemvindo1', 'q1w2e3r4', '1q2w3e4r', 'a1b2c3d4',
  // palavras-base: recusadas mesmo com número/símbolo em volta ("Senha123!", "@Brasil2026")
  'senha', 'password', 'admin', 'brasil', 'futebol', 'teamo', 'mudar', 'trocar', 'qwerty', 'vaiaai', 'pelada',
  'gremio', 'inter', 'vasco', 'santos', 'jesus', 'deus', 'amor', 'mudar', 'minhasenha', 'novasenha',
]);

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Tira símbolos e números das pontas: "Flamengo@2026" vira "flamengo" para a lista de comuns */
const core = (s: string) => plain(s).replace(/^[^a-z]+|[^a-z]+$/g, '');

export interface Rule {
  key: string;
  label: string;
  ok: boolean;
}

/** Lista de exigências, para a tela mostrar cada uma com ✓ ou ✗. */
export function passwordRules(pw: string): Rule[] {
  const rules: Rule[] = [{ key: 'len', label: `Pelo menos ${P.minLength} caracteres`, ok: pw.length >= P.minLength }];
  if (P.requireLowercase) rules.push({ key: 'lower', label: 'Uma letra minúscula', ok: /\p{Ll}/u.test(pw) });
  if (P.requireUppercase) rules.push({ key: 'upper', label: 'Uma letra MAIÚSCULA', ok: /\p{Lu}/u.test(pw) });
  if (P.requireNumber) rules.push({ key: 'num', label: 'Um número', ok: /\d/.test(pw) });
  if (P.requireSymbol) rules.push({ key: 'sym', label: 'Um caractere especial (! @ # $ % & * ...)', ok: /[^\p{L}\d\s]/u.test(pw) });
  return rules;
}

export interface PasswordCheck {
  ok: boolean;
  /** Primeiro problema encontrado, pronto para mostrar */
  problem: string | null;
  /** 0 a 4, para a barrinha de força */
  score: number;
}

/** Validação local, instantânea. `context` evita senha com o próprio e-mail ou nome. */
export function checkPassword(pw: string, context: { email?: string; name?: string } = {}): PasswordCheck {
  const problems: string[] = [];
  const missing = passwordRules(pw).filter((r) => !r.ok);
  if (missing.length) problems.push(`Falta: ${missing.map((r) => r.label.toLowerCase()).join(', ')}.`);
  if (pw.length > P.maxLength) problems.push(`Use no máximo ${P.maxLength} caracteres.`);
  if (/^\s|\s$/.test(pw)) problems.push('Não comece nem termine a senha com espaço.');
  const p = plain(pw);
  if (COMMON.has(p) || COMMON.has(core(pw)) || /^(.)\1+$/.test(pw) || /(0123|1234|2345|3456|4567|5678|6789|abcd|qwer)/.test(p) && pw.length < 12)
    problems.push('Essa senha é muito fácil de adivinhar. Escolha outra.');
  if (P.blockPersonalInfo) {
    const user = plain(context.email?.split('@')[0] ?? '').replace(/[^a-z]/g, '');
    const firstName = plain(context.name?.trim().split(/\s+/)[0] ?? '');
    if ((user.length >= 4 && p.includes(user)) || (firstName.length >= 4 && p.includes(firstName)))
      problems.push('Não use seu nome ou e-mail na senha.');
  }

  let score = 0;
  if (pw.length >= P.minLength) score++;
  if (pw.length >= 12) score++;
  if (/\p{Ll}/u.test(pw) && /\p{Lu}/u.test(pw)) score++;
  if (/[^\p{L}\d\s]/u.test(pw) && /\d/.test(pw)) score++;
  if (problems.length) score = Math.min(score, 1);

  return { ok: problems.length === 0, problem: problems[0] ?? null, score };
}

export const STRENGTH = [
  { label: 'Fraca', color: '#FF5A4E' },
  { label: 'Fraca', color: '#FF5A4E' },
  { label: 'Razoável', color: '#F7B538' },
  { label: 'Boa', color: '#5BD08A' },
  { label: 'Forte', color: '#5BD08A' },
];

/**
 * Confere se a senha já apareceu em vazamentos (base "Have I Been Pwned").
 * Privacidade: só os 5 primeiros caracteres do hash SHA-1 saem do celular (k-anonimato);
 * a senha e o hash completo nunca são enviados. Sem internet ou erro: não bloqueia (devolve 0).
 */
export async function timesLeaked(pw: string): Promise<number> {
  try {
    const hash = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, pw)).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return 0;
    const body = await res.text();
    for (const line of body.split('\n')) {
      const [s, count] = line.trim().split(':');
      if (s === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Regra completa antes de criar/trocar senha. Devolve a mensagem de erro, ou null se pode seguir. */
export async function validateNewPassword(pw: string, context: { email?: string; name?: string } = {}) {
  const local = checkPassword(pw, context);
  if (!local.ok) return local.problem;
  if (P.blockLeaked && (await timesLeaked(pw)) > 0)
    return 'Essa senha já apareceu em vazamentos de outros sites e pode ser adivinhada. Escolha outra (ela não foi enviada a ninguém).';
  return null;
}
