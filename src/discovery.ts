import { supabase } from './lib/supabase';
import type { Position } from './types';

/** "Bora jogar?", "Falta gente!", bloquear e denunciar. Ver supabase/migrations/007. */

export interface NearbyPlayer {
  id: string;
  name: string;
  nickname: string | null;
  photos: string[];
  position: Position;
  second_position: Position | null;
  foot: string | null;
  shirt_number: number | null;
  bio: string | null;
  neighborhood: string | null;
  city: string | null;
  age: number | null;
  distance_km: number;
  availability: string[];
}

export interface Match {
  id: string;
  name: string;
  nickname: string | null;
  photo: string | null;
  position: Position;
  neighborhood: string | null;
  city: string | null;
  phone: string | null;
  instagram: string | null;
  matched_at: string;
  last_message: string | null;
  last_at: string | null;
  last_from_me: boolean | null;
  unread: number;
}

export interface OpenCall {
  id: string;
  author: string;
  author_name: string;
  author_photo: string | null;
  title: string;
  date: string;
  location: string;
  positions: Position[];
  slots: number;
  price: number;
  notes: string | null;
  neighborhood: string | null;
  city: string | null;
  distance_km: number;
  responses: number;
  i_responded: boolean;
  mine: boolean;
}

export interface Responder {
  id: string;
  name: string;
  nickname: string | null;
  photo: string | null;
  position: Position;
  neighborhood: string | null;
  phone: string | null;
  responded_at: string;
}

export type ReportReason = 'perfil_falso' | 'ofensivo' | 'assedio' | 'golpe' | 'menor_de_idade' | 'outro';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'perfil_falso', label: 'Perfil falso' },
  { key: 'ofensivo', label: 'Conteúdo ofensivo' },
  { key: 'assedio', label: 'Assédio ou ameaça' },
  { key: 'golpe', label: 'Golpe ou cobrança indevida' },
  { key: 'menor_de_idade', label: 'Parece menor de idade' },
  { key: 'outro', label: 'Outro motivo' },
];

// As funções do banco devolvem "pos" (position é palavra reservada lá)
const withPosition = <T extends { pos?: string }>(row: T) => {
  const { pos, ...rest } = row as any;
  return { ...rest, position: pos } as any;
};

export async function playersNearby(radiusKm = 15): Promise<NearbyPlayer[]> {
  const { data, error } = await supabase.rpc('players_nearby', { radius_km: radiusKm, lim: 30 });
  if (error) throw error;
  return (data ?? []).map(withPosition);
}

/** true = deu match */
export async function swipe(target: string, liked: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('swipe', { target, liked_it: liked });
  if (error) throw error;
  return !!data;
}

export async function myMatches(): Promise<Match[]> {
  const { data, error } = await supabase.rpc('my_matches');
  if (error) throw error;
  return (data ?? []).map(withPosition);
}

/** Desfaz o "bora" (o match some para os dois). */
export async function unmatch(target: string, userId: string) {
  const { error } = await supabase.from('swipes').delete().eq('from_user', userId).eq('to_user', target);
  if (error) throw error;
}

export async function block(target: string) {
  const { error } = await supabase.from('blocks').upsert({ blocked: target }, { onConflict: 'blocker,blocked' });
  if (error) throw error;
}

export async function report(input: { user?: string; callId?: string; reason: ReportReason; details?: string }) {
  const { error } = await supabase.from('reports').insert({
    reported_user: input.user ?? null,
    call_id: input.callId ?? null,
    reason: input.reason,
    details: input.details?.trim() || null,
  });
  if (error) throw error;
}

export async function callsNearby(radiusKm = 20): Promise<OpenCall[]> {
  const { data, error } = await supabase.rpc('calls_nearby', { radius_km: radiusKm });
  if (error) throw error;
  return (data ?? []) as OpenCall[];
}

export async function createCall(input: {
  title: string;
  date: string;
  location: string;
  positions: Position[];
  slots: number;
  price: number;
  notes?: string;
  groupId?: string | null;
  region: { neighborhood: string | null; city: string | null; lat: number; lng: number };
}) {
  const { error } = await supabase.from('open_calls').insert({
    title: input.title.trim(),
    date: input.date,
    location: input.location.trim(),
    positions: input.positions,
    slots: input.slots,
    price: input.price,
    notes: input.notes?.trim() || null,
    group_id: input.groupId ?? null,
    neighborhood: input.region.neighborhood,
    city: input.region.city,
    lat_approx: input.region.lat,
    lng_approx: input.region.lng,
  });
  if (error) throw error;
}

export async function closeCall(id: string) {
  const { error } = await supabase.from('open_calls').update({ closed: true }).eq('id', id);
  if (error) throw error;
}

export async function respondToCall(callId: string, going: boolean, userId: string) {
  const { error } = going
    ? await supabase.from('call_responses').upsert({ call_id: callId }, { onConflict: 'call_id,user_id' })
    : await supabase.from('call_responses').delete().eq('call_id', callId).eq('user_id', userId);
  if (error) throw error;
}

export async function callResponders(callId: string): Promise<Responder[]> {
  const { data, error } = await supabase.rpc('call_responders', { cid: callId });
  if (error) throw error;
  return (data ?? []).map(withPosition);
}

/** Link do WhatsApp a partir do telefone salvo no perfil (assume Brasil se vier sem DDI). */
export function whatsappLink(phone: string, text?: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function discoveryError(message: string) {
  if (/rate limit/i.test(message)) return 'Muitas ações seguidas. Espere um pouco e tente de novo.';
  if (/adults only/i.test(message)) return 'Só para maiores de 18 anos. Confira sua data de nascimento no perfil.';
  if (/blocked/i.test(message)) return 'Não é possível interagir com esse jogador.';
  if (/Could not find the function|does not exist|schema cache/i.test(message))
    return 'O servidor ainda não tem essa função. Rode a migração 007 no Supabase.';
  if (/network|fetch/i.test(message)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return message;
}
