import { useStore } from '../store';
import type { Player, Settings } from '../types';

/**
 * "Tem mensalista?" do clube. Desligado: todo mundo é tratado como avulso (paga por jogo) e a parte de
 * mensalidade some das telas. O tipo salvo de cada jogador não muda: religando, volta como estava.
 */
export const monthlyOn = (s: Pick<Settings, 'monthlyEnabled'>) => s.monthlyEnabled !== false;

export const isMensalista = (p: Pick<Player, 'type'> | undefined, s: Pick<Settings, 'monthlyEnabled'>) =>
  !!p && monthlyOn(s) && p.type === 'mensalista';

/** Hook para as telas do clube aberto. */
export const useMonthlyOn = () => useStore((s) => monthlyOn(s.settings));
