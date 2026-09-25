# Vaia Aí ⚽

App para organizar a pelada com os amigos (Android e iOS): jogadores com avaliação, lista de presença com
lista de espera, sorteio de times equilibrado ou escalação manual no campinho, placar ao vivo com
artilharia e controle financeiro (mensalidades, avulsos e despesas).

Feito com [Expo](https://expo.dev) (React Native + TypeScript) e Expo Router. Os dados ficam salvos no
próprio celular (AsyncStorage) por enquanto.

Veja o [ROADMAP.md](ROADMAP.md) para o que vem a seguir.

## Rodando

```bash
npm install
npx expo start          # abre o menu: "a" Android, "i" iOS, "w" navegador
```

- **No celular**: instale o app **Expo Go** e leia o QR code que aparece no terminal (celular e PC na mesma rede).
- **No navegador**: `npx expo start --web` e abra http://localhost:8081. Em modo dev, `http://localhost:8081/?demo=1`
  carrega um grupo de exemplo com 20 jogadores.

Checagem de tipos: `npm run typecheck`.

## Estrutura

```
src/
  app/                 telas (Expo Router: cada arquivo é uma rota)
    (tabs)/            Jogos, Jogadores, Caixa
    game/[id].tsx      jogo: lista, times, placar, pagamentos, notas
    match/...          partida ao vivo (cronômetro e gols)
    player/[id].tsx    cadastro/avaliação do jogador
  components/          UI reutilizável e o campinho (Pitch)
  utils/               sorteio, notas, estatísticas, datas, dados de exemplo
  store.ts             estado global persistido (zustand)
```
