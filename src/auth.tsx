import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { openGroup } from './cloud';
import { fetchMyProfile } from './people';
import { isCloudEnabled, supabase } from './lib/supabase';
import type { Foot, Position, Skills } from './types';

export type Role = 'owner' | 'admin' | 'player';

export interface Profile {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  position: Position;
  skills: Skills;
  /** URLs públicas; a primeira é a principal */
  photos: string[];
  birth_date: string | null;
  city: string | null;
  /** Região (migração 006); ausentes em bancos antigos */
  neighborhood?: string | null;
  state?: string | null;
  lat_approx?: number | null;
  lng_approx?: number | null;
  discoverable?: boolean;
  /** Migração 007 */
  share_contact?: boolean;
  availability?: string[];
  bio: string | null;
  foot: Foot | null;
  height_cm: number | null;
  weight_kg: number | null;
  second_position: Position | null;
  shirt_number: number | null;
  favorite_team: string | null;
  instagram: string | null;
}

/** Idade a partir da data de nascimento (YYYY-MM-DD). */
export function ageOf(birth: string | null | undefined) {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 && age < 120 ? age : null;
}

export interface GroupSummary {
  id: string;
  name: string;
  invite_code: string;
  role: Role;
}

interface AuthState {
  /** false enquanto lê a sessão salva */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  groups: GroupSummary[];
  /** Grupo cujos jogos, jogadores e caixa aparecem nas abas */
  activeGroup: GroupSummary | null;
  setActiveGroup: (id: string) => void;
  refresh: () => Promise<void>;
  /** true durante "Esqueci minha senha": a sessão aberta pelo código não entra no app até a senha nova ser salva */
  holdSession: boolean;
  setHoldSession: (v: boolean) => void;
}

const AuthContext = createContext<AuthState>({
  ready: true,
  session: null,
  profile: null,
  groups: [],
  activeGroup: null,
  setActiveGroup: () => {},
  refresh: async () => {},
  holdSession: false,
  setHoldSession: () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Pode organizar (criar jogo, sortear, placar, caixa)? No modo local, sempre. */
export function useCanManage() {
  const { activeGroup } = useAuth();
  return !isCloudEnabled || activeGroup?.role === 'owner' || activeGroup?.role === 'admin';
}

const ACTIVE_KEY = 'vaia-ai-active-group';

export const ROLE_LABEL: Record<Role, string> = { owner: 'Dono', admin: 'Admin', player: 'Jogador' };

/** Traduz os erros mais comuns do Supabase para o usuário. */
export function authErrorMessage(message: string): string {
  if (/rate limit/i.test(message)) return 'Muitas ações seguidas. Espere um pouco e tente de novo.';
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(message)) return 'Este e-mail já tem conta. Tente entrar.';
  if (/password should be at least|weak password/i.test(message)) return 'Senha fraca: use pelo menos 8 caracteres, com letras e números.';
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/invalid code/i.test(message)) return 'Código de convite não encontrado.';
  if (/network|fetch/i.test(message)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isCloudEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [holdSession, setHoldSession] = useState(false);

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setGroups([]);
      setActiveId(null);
      return;
    }
    const [p, g] = await Promise.all([
      fetchMyProfile(s.user.id).then((data) => ({ data })).catch(() => ({ data: null })),
      supabase.from('group_members').select('role, groups(id, name, invite_code)').eq('user_id', s.user.id),
    ]);
    if (p.data) setProfile(p.data as Profile);
    const saved = await AsyncStorage.getItem(ACTIVE_KEY).catch(() => null);
    // Sem resposta (ex.: sem internet): fica no último grupo usado, com o cache do celular
    if (g.error) {
      setActiveId((cur) => cur ?? saved);
      return;
    }
    const list: GroupSummary[] = (g.data ?? []).flatMap((row: any) =>
      row.groups ? [{ ...row.groups, role: row.role as Role }] : [],
    );
    list.sort((a, b) => a.name.localeCompare(b.name));
    setGroups(list);
    setActiveId((cur) => {
      const want = cur ?? saved;
      return list.some((x) => x.id === want) ? want : (list[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!isCloudEnabled) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // fora do callback: chamar o Supabase aqui dentro pode travar o client
      setTimeout(() => load(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(() => load(session), [load, session]);

  const activeGroup = groups.find((g) => g.id === activeId) ?? null;

  // Liga o store ao grupo ativo (ou limpa ao sair da conta)
  useEffect(() => {
    if (!isCloudEnabled || !ready) return;
    openGroup(activeId);
    if (activeId) AsyncStorage.setItem(ACTIVE_KEY, activeId).catch(() => {});
  }, [activeId, ready]);

  return (
    <AuthContext.Provider value={{ ready, session, profile, groups, activeGroup, setActiveGroup: setActiveId, refresh, holdSession, setHoldSession }}>
      {children}
    </AuthContext.Provider>
  );
}
