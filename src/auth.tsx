import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { isCloudEnabled, supabase } from './lib/supabase';
import type { Position, Skills } from './types';

export type Role = 'owner' | 'admin' | 'player';

export interface Profile {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  position: Position;
  skills: Skills;
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
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  ready: true,
  session: null,
  profile: null,
  groups: [],
  refresh: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const ROLE_LABEL: Record<Role, string> = { owner: 'Dono', admin: 'Admin', player: 'Jogador' };

/** Traduz os erros mais comuns do Supabase para o usuário. */
export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(message)) return 'Este e-mail já tem conta. Tente entrar.';
  if (/password should be at least/i.test(message)) return 'A senha precisa ter pelo menos 6 caracteres.';
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

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setGroups([]);
      return;
    }
    const [p, g] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).single(),
      supabase.from('group_members').select('role, groups(id, name, invite_code)').eq('user_id', s.user.id),
    ]);
    if (p.data) setProfile(p.data as Profile);
    setGroups(
      (g.data ?? []).flatMap((row: any) =>
        row.groups ? [{ ...row.groups, role: row.role as Role }] : [],
      ),
    );
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

  return (
    <AuthContext.Provider value={{ ready, session, profile, groups, refresh }}>{children}</AuthContext.Provider>
  );
}
