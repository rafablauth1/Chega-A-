/**
 * Textos legais do app. Fonte única: a tela do app (src/app/legal/[doc].tsx) e as páginas web
 * (docs/*.html, geradas por scripts/build-legal.ts) usam este arquivo.
 *
 * ⚠️ Antes de publicar na loja, preencha OWNER e CONTACT_EMAIL e peça a revisão de um advogado.
 */

export const APP_NAME = 'Vaia Aí';
export const OWNER = '[NOME COMPLETO OU EMPRESA RESPONSÁVEL]';
export const CONTACT_EMAIL = '[E-MAIL DE CONTATO]';
export const UPDATED_AT = '27 de setembro de 2026';
/** Onde as páginas ficam publicadas (GitHub Pages do repositório, pasta /docs). */
export const SITE_URL = 'https://rafablauth1.github.io/Chega-A-';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDoc {
  slug: 'privacidade' | 'termos' | 'excluir-conta';
  title: string;
  intro: string;
  sections: LegalSection[];
}

export const PRIVACY: LegalDoc = {
  slug: 'privacidade',
  title: 'Política de Privacidade',
  intro: `Esta política explica quais dados o ${APP_NAME} usa, para quê, com quem eles são compartilhados e como você controla tudo isso. Ela segue a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).`,
  sections: [
    {
      heading: 'Quem cuida dos seus dados',
      paragraphs: [
        `O controlador dos dados é ${OWNER}, responsável pelo ${APP_NAME}. Para qualquer assunto de privacidade, inclusive falar com o encarregado (DPO), escreva para ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: 'Quais dados usamos',
      paragraphs: ['Só pedimos o que o app precisa para organizar a pelada. Os campos marcados como opcionais você preenche se quiser.'],
      items: [
        'Conta: e-mail e senha. A senha é guardada de forma criptografada pelo nosso provedor de login; nós nunca a vemos.',
        'Perfil de atleta: nome, apelido, posição e autoavaliação das habilidades.',
        'Perfil de atleta (opcional): fotos, telefone/WhatsApp, data de nascimento, cidade, bio, pé preferido, altura, peso, segunda posição, número da camisa, time do coração e Instagram.',
        'Região (opcional): bairro, cidade, estado e uma posição aproximada (cerca de 1 km), obtidos pelo GPS só quando você toca em "Usar minha localização". Nunca guardamos o endereço exato e não acompanhamos sua localização em segundo plano.',
        'Disponibilidade (opcional): dias e turnos em que você costuma jogar.',
        'Interações do "Bora jogar?": quem você topou ou passou, seus matches, vagas que publicou ou respondeu, bloqueios e denúncias.',
        'Mensagens do chat com quem deu match com você ou com quem participa das suas vagas, e se foram lidas.',
        'Atividade nos grupos: grupos de que você participa e seu papel neles, presença nos jogos, times, gols, assistências, notas recebidas, craque do jogo, mensalidades e pagamentos marcados pelo organizador.',
        'Dados que o organizador cadastra: jogadores convidados sem conta (nome, apelido, telefone, posição e notas), despesas do grupo e a chave Pix usada para receber.',
        'Dados técnicos: o celular guarda uma cópia dos dados do grupo para o app abrir rápido e funcionar sem internet. Não usamos rastreadores de publicidade nem vendemos dados.',
      ],
    },
    {
      heading: 'Para que usamos',
      items: [
        'Criar sua conta e deixar você entrar no app.',
        'Organizar os jogos: lista de presença, lista de espera, sorteio de times, placar e financeiro do grupo.',
        'Calcular estatísticas, ranking, conquistas e o seu perfil de atleta.',
        'Mostrar aos colegas de grupo quem você é na pelada.',
        'Manter o serviço seguro e corrigir erros.',
      ],
    },
    {
      heading: 'Base legal',
      items: [
        'Execução do serviço que você pediu ao criar a conta (art. 7º, V da LGPD): dados da conta, do perfil básico e da atividade nos grupos.',
        'Consentimento (art. 7º, I): dados opcionais do perfil, como fotos, altura, peso, data de nascimento e região. Você pode apagá-los quando quiser editando o perfil.',
        'Legítimo interesse (art. 7º, IX): segurança e prevenção de abuso.',
      ],
    },
    {
      heading: 'Quem vê seus dados',
      items: [
        'Membros dos grupos de que você participa veem seu perfil de atleta, suas estatísticas e sua atividade naquele grupo.',
        'Membros das comunidades de que você participa (empresa, escola etc.) veem seu perfil de atleta, os times da comunidade e a artilharia geral, com os gols de cada jogador.',
        'Suas fotos ficam num endereço público: quem tiver o link da foto consegue abri-la. Não use fotos que você não quer que circulem.',
        'Se você ligar "Aparecer para jogadores perto", pessoas da sua região que procuram jogo podem ver seu perfil de atleta e o seu bairro (nunca o endereço nem a posição exata). Fica desligado até você escolher, e dá para desligar a qualquer momento.',
        'Seu WhatsApp e Instagram só aparecem para quem deu match com você ou para o dono de uma vaga que você topou, e só se você ligar "Mostrar meu WhatsApp para quem der match".',
        'As conversas do chat ficam visíveis só para as duas pessoas. Nossa equipe não lê conversas; quando você denuncia alguém, as últimas mensagens dessa pessoa vão junto com a denúncia para a análise.',
        'Denúncias são vistas só pela nossa equipe, para analisar e, se preciso, suspender contas. Quem foi denunciado não sabe quem denunciou.',
        'Fora isso, quem não está em nenhum grupo ou comunidade com você não vê seu perfil pelo app.',
        'Provedores que operam o serviço para nós: Supabase (banco de dados, login e armazenamento das fotos) e Expo (distribuição e atualizações do app). Eles tratam os dados só para prestar esse serviço.',
        'Não vendemos, alugamos nem compartilhamos seus dados para publicidade.',
      ],
    },
    {
      heading: 'Transferência internacional',
      paragraphs: [
        'Os servidores dos nossos provedores podem ficar fora do Brasil, como nos Estados Unidos. Essa transferência acontece com as garantias previstas no art. 33 da LGPD, incluindo cláusulas contratuais de proteção de dados dos próprios provedores.',
      ],
    },
    {
      heading: 'Por quanto tempo guardamos',
      paragraphs: [
        'Guardamos seus dados enquanto sua conta existir. Quando você exclui a conta, apagamos o perfil, as fotos, a participação nos grupos, a presença nos jogos, os matches e as mensagens do chat.',
        'Resultados antigos dos jogos do grupo (placares, gols e notas) continuam no histórico da pelada, mas sem nome ligado a eles. Podemos manter registros mínimos quando a lei exigir.',
      ],
    },
    {
      heading: 'Seus direitos',
      paragraphs: ['A LGPD (art. 18) garante que você pode:'],
      items: [
        'Confirmar se tratamos seus dados e acessá-los.',
        'Corrigir dados incompletos ou errados, direto em "Editar perfil".',
        'Pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários.',
        'Pedir a portabilidade dos seus dados.',
        'Revogar o consentimento e apagar os dados opcionais.',
        'Excluir sua conta a qualquer momento, pelo próprio app, em Meu perfil > Excluir minha conta.',
      ],
    },
    {
      heading: 'Segurança',
      paragraphs: [
        'Os dados trafegam criptografados (HTTPS). No banco, regras de acesso garantem que cada pessoa só lê os dados dos grupos de que participa e que só organizadores alteram jogos e financeiro. Nenhum sistema é 100% seguro; se acontecer um incidente relevante, avisaremos os afetados e a ANPD como manda a lei.',
      ],
    },
    {
      heading: 'Crianças e adolescentes',
      paragraphs: [
        'O app não é destinado a menores de 13 anos. Adolescentes entre 13 e 18 anos devem usá-lo com a autorização dos pais ou responsáveis. A busca de jogadores perto, os matches e as vagas abertas são só para maiores de 18 anos.',
      ],
    },
    {
      heading: 'Mudanças nesta política',
      paragraphs: [`Se esta política mudar de forma importante, avisaremos pelo app. Última atualização: ${UPDATED_AT}.`],
    },
  ],
};

export const TERMS: LegalDoc = {
  slug: 'termos',
  title: 'Termos de Uso',
  intro: `Estes termos valem para quem usa o ${APP_NAME}. Ao criar uma conta você concorda com eles e com a Política de Privacidade.`,
  sections: [
    {
      heading: 'O que é o app',
      paragraphs: [
        `O ${APP_NAME} ajuda grupos de amigos a organizar peladas: lista de presença, sorteio de times, placar, estatísticas e controle do caixa. O serviço é oferecido por ${OWNER}.`,
      ],
    },
    {
      heading: 'Sua conta',
      items: [
        'Use dados verdadeiros e mantenha sua senha em segredo. Você responde pelo que for feito com a sua conta.',
        'É preciso ter pelo menos 13 anos. Menores de 18 precisam da autorização dos responsáveis.',
        'Você pode excluir a conta quando quiser, em Meu perfil > Excluir minha conta.',
      ],
    },
    {
      heading: 'Grupos e organizadores',
      items: [
        'Quem cria um grupo é o dono e pode nomear admins. Dono e admins cadastram jogos, sorteiam times, lançam placar, dão notas e controlam o caixa.',
        'O organizador é responsável pelos dados que cadastra de outras pessoas, como convidados sem conta, e deve ter a autorização delas.',
        'Notas e rankings são brincadeira entre amigos e não medem o valor de ninguém.',
      ],
    },
    {
      heading: 'Dinheiro',
      paragraphs: [
        `O ${APP_NAME} não recebe, guarda nem repassa dinheiro. O Pix mostrado no app vai direto para a conta do organizador, e o controle de mensalidades e despesas é só uma anotação. Combinações de pagamento, cobranças e reembolsos são entre os participantes e o organizador.`,
      ],
    },
    {
      heading: 'O que não pode',
      items: [
        'Publicar conteúdo ofensivo, discriminatório, ilegal ou que viole direitos de outras pessoas, inclusive fotos de terceiros sem autorização.',
        'Usar o app para enviar spam, enganar pessoas ou coletar dados de outros usuários.',
        'Tentar acessar dados de grupos de que você não participa ou atrapalhar o funcionamento do serviço.',
      ],
    },
    {
      heading: 'Seu conteúdo',
      paragraphs: [
        'As fotos e textos que você envia continuam sendo seus. Você nos autoriza a guardá-los e exibi-los dentro do app, só para o serviço funcionar, enquanto sua conta existir.',
      ],
    },
    {
      heading: 'Disponibilidade',
      paragraphs: [
        'Trabalhamos para o app funcionar bem, mas ele pode ter falhas, ficar fora do ar ou mudar de funcionalidades. Mantenha seus próprios registros do que for importante, como pagamentos.',
        'Podemos suspender contas que violem estes termos.',
      ],
    },
    {
      heading: 'Jogar com gente nova',
      items: [
        'O "Bora jogar?" e as vagas abertas são só para maiores de 18 anos.',
        'Não verificamos a identidade de ninguém. Combine em locais públicos, como quadras e arenas, e avise alguém de confiança.',
        'Nunca pague antecipado a desconhecidos fora do combinado com o organizador da pelada.',
        'Use Denunciar e Bloquear se alguém for ofensivo, insistente ou suspeito. Contas denunciadas podem ser suspensas.',
      ],
    },
    {
      heading: 'Lesões e responsabilidade em campo',
      paragraphs: [
        `O ${APP_NAME} só organiza o jogo. A prática esportiva, o local, a segurança e eventuais lesões são de responsabilidade dos participantes e do organizador.`,
      ],
    },
    {
      heading: 'Mudanças e contato',
      paragraphs: [
        `Podemos atualizar estes termos e avisaremos pelo app quando a mudança for importante. Dúvidas: ${CONTACT_EMAIL}. Vale a lei brasileira, e o consumidor pode usar o foro do seu domicílio. Última atualização: ${UPDATED_AT}.`,
      ],
    },
  ],
};

export const DELETE_ACCOUNT: LegalDoc = {
  slug: 'excluir-conta',
  title: 'Excluir sua conta',
  intro: `Você pode excluir sua conta do ${APP_NAME} e os dados ligados a ela a qualquer momento.`,
  sections: [
    {
      heading: 'Pelo app (na hora)',
      items: ['Abra o app e entre na sua conta.', 'Toque no ícone de perfil, no topo da tela.', 'Desça até o fim e toque em "Excluir minha conta".', 'Confirme. A exclusão é imediata.'],
    },
    {
      heading: 'Sem acesso ao app',
      paragraphs: [
        `Mande um e-mail para ${CONTACT_EMAIL} com o assunto "Excluir conta", a partir do e-mail cadastrado. Respondemos e concluímos a exclusão em até 15 dias.`,
      ],
    },
    {
      heading: 'O que é apagado',
      items: [
        'Conta de acesso (e-mail e senha).',
        'Perfil de atleta e todas as fotos.',
        'Participação nos grupos e presença nos jogos.',
        'Se você for dono de um grupo com outros membros, o grupo passa para um admin ou para o membro mais antigo. Grupos só com você são apagados.',
      ],
    },
    {
      heading: 'O que fica',
      paragraphs: [
        'Placares, gols e notas de jogos passados continuam no histórico dos grupos, sem o seu nome. Registros exigidos por lei, se houver, são guardados só pelo prazo obrigatório.',
      ],
    },
  ],
};

export const LEGAL_DOCS = { privacidade: PRIVACY, termos: TERMS, 'excluir-conta': DELETE_ACCOUNT } as const;
