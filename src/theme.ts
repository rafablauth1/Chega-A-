/**
 * Identidade "pelada de noite, sob os refletores":
 * gramado profundo, linhas de cal, laranja de colete para ação e dourado só para notas.
 */
export const colors = {
  bg: '#0F2419', // gramado à noite
  card: '#16301F', // superfície elevada
  cardAlt: '#1D3B28', // superfície pressionada / destaque leve
  border: '#27492F', // linha discreta
  chalk: '#F2F5EE', // cal das marcações
  text: '#F2F5EE',
  muted: '#9DB5A4',
  primary: '#FF7A1A', // colete laranja: ações
  primaryDark: '#C85A0C',
  onPrimary: '#2A1304',
  success: '#5BD08A', // pago / confirmado
  warning: '#F7B538',
  danger: '#FF5A4E',
  gold: '#F4C542', // notas e estrelas
};

export const fonts = {
  body: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
  display: 'BigShouldersDisplay_800ExtraBold',
  displayBlack: 'BigShouldersDisplay_900Black',
};

export const positionColors: Record<string, string> = {
  GOL: '#F7B538',
  ZAG: '#5AA9FF',
  MEI: '#5BD08A',
  ATA: '#FF5A4E',
};

/** Cores dos coletes de cada time. */
export const teamColors = ['#FF7A1A', '#5AA9FF', '#F4E04D', '#C084FC', '#F2F5EE', '#2DD4BF'];

export const spacing = (n: number) => n * 4;
