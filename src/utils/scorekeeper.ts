import { useAuth, useCanManage } from '../auth';
import { hasScorekeeper } from '../cloud';
import { isCloudEnabled } from '../lib/supabase';
import { useStore } from '../store';
import type { Game } from '../types';

/**
 * Marcador do placar (migração 021): um admin por jogo marca gols, cronômetro e fim das partidas.
 * Sem conta (modo local) ou com servidor antigo, vale como antes: qualquer admin marca.
 */
export function useScoreControl(game?: Game) {
  const canManage = useCanManage();
  const { session, activeGroup } = useAuth();
  const setScorekeeper = useStore((s) => s.setScorekeeper);
  const me = session?.user.id ?? '';

  const enabled = isCloudEnabled && hasScorekeeper() && !!game;
  const keeper = enabled ? (game!.scorekeeper ?? null) : null;
  const isOwner = activeGroup?.role === 'owner';
  const isKeeper = !!me && keeper === me;

  return {
    enabled,
    keeper,
    isKeeper,
    /** Pode marcar gol, mexer no cronômetro, começar/encerrar partida */
    canScore: enabled ? canManage && (keeper === null || isKeeper) : canManage,
    /** Pode passar a vez (o marcador) ou assumir (o dono, ou qualquer admin se ninguém marca) */
    canTransfer: enabled && canManage && (isKeeper || isOwner || keeper === null),
    /** Primeiro admin a começar uma partida assume o placar */
    claimIfFree: () => {
      if (enabled && game && keeper === null && me && canManage) setScorekeeper(game.id, me);
    },
    passTo: (userId: string) => game && setScorekeeper(game.id, userId),
  };
}
