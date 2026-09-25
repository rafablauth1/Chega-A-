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
