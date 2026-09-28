export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (v: number) => brl.format(v || 0);

/** Converte "25,50" ou "25.50" em número. */
export const parseMoney = (s: string) => {
  const n = parseFloat(s.replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "Hoje", "Amanhã", "Quinta" ou "em 12 dias" relativo a agora. */
export const relativeDay = (iso: string) => {
  const d = parseLocal(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff > 1 && diff < 7) return WEEKDAYS_LONG[d.getDay()];
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]}`;
};

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** "YYYY-MM-DDTHH:mm" -> Date local */
export const parseLocal = (iso: string) => {
  const [d, t = '00:00'] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h, min);
};

export const toLocalIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const todayIso = () => toLocalIso(new Date()).slice(0, 10);

export const formatGameDate = (iso: string) => {
  const d = parseLocal(iso);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Duração padrão de um horário de quadra */
export const DEFAULT_COURT_MINUTES = 60;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Hora de fim da quadra (HH:mm): a escolhida ou 60 min depois do início. */
export const gameEndTime = (g: { date: string; endTime?: string }) => {
  if (g.endTime && /^\d{2}:\d{2}$/.test(g.endTime)) return g.endTime;
  const d = parseLocal(g.date);
  d.setMinutes(d.getMinutes() + DEFAULT_COURT_MINUTES);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Minutos de quadra (atravessa a meia-noite: 23:00 às 00:30 = 90). */
export const courtMinutes = (start: string, end: string) => {
  const diff = toMinutes(end) - toMinutes(start);
  return diff > 0 ? diff : diff + 24 * 60;
};

/** "20:00–21:00" */
export const gameTimeRange = (g: { date: string; endTime?: string }) => `${g.date.slice(11, 16)}–${gameEndTime(g)}`;

/** "Seg, 29/09 · 20:00–21:00" */
export const formatGameSlot = (g: { date: string; endTime?: string }) => {
  const d = parseLocal(g.date);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${gameTimeRange(g)}`;
};

export const formatShortDate = (iso: string) => {
  const d = parseLocal(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

/** "YYYY-MM" */
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

/** Máscara dd/mm/aaaa enquanto digita */
export const maskDate = (s: string) => {
  const d = s.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

/** Máscara hh:mm enquanto digita */
export const maskTime = (s: string) => {
  const d = s.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
};

/** "dd/mm/aaaa" + "hh:mm" -> "YYYY-MM-DDTHH:mm" ou null se inválido */
export const buildIso = (date: string, time: string) => {
  const dm = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const tm = time.match(/^(\d{2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const [, dd, mm, yyyy] = dm.map(Number);
  const [, hh, mi] = tm.map(Number);
  const d = new Date(yyyy, mm - 1, dd, hh, mi);
  if (d.getDate() !== dd || d.getMonth() !== mm - 1 || hh > 23 || mi > 59) return null;
  return toLocalIso(d);
};

export const splitIso = (iso: string) => {
  const d = parseLocal(iso);
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
