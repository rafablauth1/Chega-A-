import type { Profile } from './auth';
import { supabase } from './lib/supabase';

/**
 * Leitura de perfis de OUTRAS pessoas: sempre pela função people() do banco (migração 009),
 * que devolve só o que você pode ver (idade em vez da data de nascimento; telefone e Instagram
 * só para o organizador ou para quem conversa com a pessoa e foi autorizado).
 *
 * Enquanto a 009 não estiver no Supabase, cai no select antigo para o app não quebrar.
 */
export type PublicProfile = Profile & { age: number | null };

const missingFn = (msg: string) => /Could not find the function|does not exist|schema cache/i.test(msg);

export async function fetchPeople(ids: string[]): Promise<PublicProfile[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.rpc('people', { ids });
  if (!error) {
    return (data ?? []).map(({ pos, ...p }: any) => ({
      ...p,
      position: pos,
      birth_date: null,
      weight_kg: null,
    })) as PublicProfile[];
  }
  if (!missingFn(error.message)) throw error;
  // Banco ainda sem a 009
  const legacy = await supabase.from('profiles').select('*').in('id', ids);
  if (legacy.error) throw legacy.error;
  return (legacy.data ?? []).map((p: any) => ({ ...p, age: null })) as PublicProfile[];
}

export async function fetchPerson(id: string): Promise<PublicProfile | null> {
  const [p] = await fetchPeople([id]);
  return p ?? null;
}

/** Meu próprio perfil, completo (inclui telefone, nascimento, região). */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('my_profile');
  if (!error) return ((data as Profile[] | null)?.[0] ?? null) as Profile | null;
  if (!missingFn(error.message)) throw error;
  const legacy = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (legacy.error) throw legacy.error;
  return legacy.data as Profile | null;
}

/** Telefones dos convidados do grupo (só dono/admin recebe). */
export async function fetchGuestPhones(groupId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('guest_contacts', { gid: groupId });
  if (!error) return Object.fromEntries((data ?? []).filter((g: any) => g.phone).map((g: any) => [g.id, g.phone]));
  if (!missingFn(error.message)) return {};
  const legacy = await supabase.from('guests').select('id, phone').eq('group_id', groupId);
  return Object.fromEntries((legacy.data ?? []).filter((g: any) => g.phone).map((g: any) => [g.id, g.phone]));
}

/** Baixar meus dados (LGPD): JSON com tudo que o app guarda sobre mim. */
export async function exportMyData(): Promise<unknown> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  return data;
}
