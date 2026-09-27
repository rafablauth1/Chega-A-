import { supabase } from './lib/supabase';

/** Comunidades: empresa, escola etc. com vários times (grupos) dentro. Ver supabase/migrations/005. */

export type CommunityKind = 'empresa' | 'escola' | 'faculdade' | 'condominio' | 'bairro' | 'amigos' | 'outro';
export type CommunityRole = 'owner' | 'admin' | 'member';

export const COMMUNITY_KINDS: { key: CommunityKind; label: string; icon: string; teamHint: string }[] = [
  { key: 'empresa', label: 'Empresa', icon: '🏢', teamHint: 'Ex.: Time do Financeiro' },
  { key: 'escola', label: 'Escola', icon: '🏫', teamHint: 'Ex.: 3º ano B' },
  { key: 'faculdade', label: 'Faculdade', icon: '🎓', teamHint: 'Ex.: Engenharia' },
  { key: 'condominio', label: 'Condomínio', icon: '🏘️', teamHint: 'Ex.: Bloco A' },
  { key: 'bairro', label: 'Bairro', icon: '📍', teamHint: 'Ex.: Pelada de terça' },
  { key: 'amigos', label: 'Amigos', icon: '🤝', teamHint: 'Ex.: Os de sempre' },
  { key: 'outro', label: 'Outro', icon: '⚽', teamHint: 'Ex.: Time azul' },
];

export const kindInfo = (k: string) => COMMUNITY_KINDS.find((x) => x.key === k) ?? COMMUNITY_KINDS[6];

export const COMMUNITY_ROLE_LABEL: Record<CommunityRole, string> = { owner: 'Dono', admin: 'Admin', member: 'Membro' };

export interface Community {
  id: string;
  name: string;
  kind: CommunityKind;
  description: string | null;
  invite_code: string;
  role: CommunityRole;
}

export interface CommunityTeam {
  group_id: string;
  name: string;
  members: number;
  games: number;
  goals: number;
  is_member: boolean;
}

export interface CommunityScorer {
  player_id: string;
  name: string;
  photo: string | null;
  team: string;
  goals: number;
}

export interface CommunityMember {
  user_id: string;
  role: CommunityRole;
  name: string;
  nickname: string | null;
  photo: string | null;
  position: string;
}

export async function listMyCommunities(userId: string): Promise<Community[]> {
  const { data, error } = await supabase
    .from('community_members')
    .select('role, communities(id, name, kind, description, invite_code)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? [])
    .flatMap((row: any) => (row.communities ? [{ ...row.communities, role: row.role as CommunityRole }] : []))
    .sort((a: Community, b: Community) => a.name.localeCompare(b.name));
}

export async function getCommunity(id: string, userId: string): Promise<Community | null> {
  const [c, m] = await Promise.all([
    supabase.from('communities').select('id, name, kind, description, invite_code').eq('id', id).maybeSingle(),
    supabase.from('community_members').select('role').eq('community_id', id).eq('user_id', userId).maybeSingle(),
  ]);
  if (c.error) throw c.error;
  if (!c.data || !m.data) return null;
  return { ...(c.data as any), role: m.data.role as CommunityRole };
}

export async function createCommunity(input: { name: string; kind: CommunityKind; description?: string }) {
  const { data, error } = await supabase
    .from('communities')
    .insert({ name: input.name.trim(), kind: input.kind, description: input.description?.trim() || null })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateCommunity(id: string, patch: { name?: string; description?: string | null; kind?: CommunityKind }) {
  const { error } = await supabase.from('communities').update(patch).eq('id', id);
  if (error) throw error;
}

export async function joinCommunity(code: string) {
  const { data, error } = await supabase.rpc('join_community', { code: code.trim() });
  if (error) throw error;
  return data as string;
}

export async function leaveCommunity(id: string, userId: string) {
  const { error } = await supabase.from('community_members').delete().eq('community_id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function communityTeams(id: string): Promise<CommunityTeam[]> {
  const { data, error } = await supabase.rpc('community_overview', { cid: id });
  if (error) throw error;
  return (data ?? []) as CommunityTeam[];
}

export async function communityScorers(id: string, limit = 10): Promise<CommunityScorer[]> {
  const { data, error } = await supabase.rpc('community_scorers', { cid: id, lim: limit });
  if (error) throw error;
  return (data ?? []) as CommunityScorer[];
}

export async function communityMembers(id: string): Promise<CommunityMember[]> {
  // community_members aponta para auth.users (não para profiles), então os perfis vêm numa segunda consulta
  const { data: rows, error } = await supabase.from('community_members').select('user_id, role').eq('community_id', id);
  if (error) throw error;
  const ids = (rows ?? []).map((r: any) => r.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from('profiles').select('id, name, nickname, photos, position').in('id', ids)
    : { data: [] as any[] };
  const byId = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  return (rows ?? [])
    .map((row: any) => {
      const p = byId[row.user_id];
      return {
        user_id: row.user_id,
        role: row.role as CommunityRole,
        name: p?.name ?? 'Jogador',
        nickname: p?.nickname ?? null,
        photo: p?.photos?.[0] ?? null,
        position: p?.position ?? 'MEI',
      };
    })
    .sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name));
}

/** Cria um time (grupo) dentro da comunidade; quem cria vira dono do time. */
export async function createTeam(communityId: string, name: string) {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: name.trim(), community_id: communityId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function joinTeam(groupId: string) {
  const { error } = await supabase.rpc('join_community_group', { gid: groupId });
  if (error) throw error;
}

/** Mensagens de erro em português para as ações de comunidade. */
export function communityError(message: string) {
  if (/rate limit/i.test(message)) return 'Muitas ações seguidas. Espere um pouco e tente de novo.';
  if (/invalid code/i.test(message)) return 'Código de comunidade não encontrado.';
  if (/not a community member/i.test(message)) return 'Você precisa entrar na comunidade primeiro.';
  if (/relation .*communit.* does not exist|function .*communit.* does not exist|Could not find the function/i.test(message))
    return 'O servidor ainda não tem comunidades. Rode a migração 005 no Supabase.';
  if (/network|fetch/i.test(message)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return message;
}
