/**
 * ⚽ PONTUAÇÃO ESTILO CARTOLA: mude os números aqui e o app inteiro acompanha
 * (tela do jogo, ranking, card do jogador, atributos e sorteio de times).
 *
 * Como a pontuação de um jogador numa pelada é calculada:
 *
 *   NOTA        = média dos votos da galera (0 a 10), com peso 0,9 para votos de companheiros
 *                 de time e 1,1 para votos de adversários
 *   × RESULTADO = 1,2 se ganhou · 1,0 se empatou · 0,8 se perdeu (média das partidas do dia)
 *   × SCOUT     = 1 + (pontos de scout × 0,1)   → gols, assistências e defesa, conforme a posição
 *   × DESTAQUE  = 1,3 para o craque do time · 0,7 para o bagre do time · 1,0 para os outros
 *
 * O prazo para votar (24 h) fica no servidor: Supabase → Table Editor → app_settings.vote_window_hours.
 */
export const SCORING = {
  votes: {
    /** Peso do voto de quem jogou no mesmo time */
    ownTeamWeight: 0.9,
    /** Peso do voto de quem jogou no time adversário */
    opponentWeight: 1.1,
    /** Mesmo valor de app_settings.vote_window_hours (só para mostrar o tempo restante) */
    windowHours: 24,
  },

  result: { win: 1.2, draw: 1.0, loss: 0.8 },

  highlight: {
    /** Maior pontuação do time */
    craque: 1.3,
    /** Menor pontuação do time */
    bagre: 0.7,
    /** Só elege craque e bagre em times com pelo menos este número de jogadores avaliados */
    minTeamSize: 3,
  },

  scout: {
    /** Pontos por gol (gol contra não conta) */
    goal: 1.0,
    /** Pontos por assistência */
    assist: 0.7,
    /** Pontos de defesa por partida, conforme os gols sofridos: 0 gols, 1 gol, 2 gols, 3 ou mais */
    concededPoints: [1.5, 1.0, 0.5, 0],
    /**
     * Quanto cada posição aproveita de ataque (gols + assistências) e de defesa (gols sofridos).
     * Meia leva metade dos dois. Gol e assistência de zagueiro/goleiro valem 1,1.
     */
    byPosition: {
      ATA: { attack: 1.0, defense: 0 },
      MEI: { attack: 0.5, defense: 0.5 },
      ZAG: { attack: 1.1, defense: 1.0 },
      GOL: { attack: 1.1, defense: 1.0 },
    },
    /** Cada ponto de scout aumenta a nota em 10% */
    factorPerPoint: 0.1,
    /** Teto do multiplicador de scout (evita que um jogo de 6 gols distorça tudo) */
    maxFactor: 1.6,
  },

  attributes: {
    /** Quantos jogos avaliados até os atributos refletirem ao máximo o desempenho */
    gamesForFullWeight: 10,
    /** No máximo, quanto do atributo vem do desempenho (o resto é a avaliação do perfil) */
    maxPerformanceWeight: 0.5,
  },
} as const;
