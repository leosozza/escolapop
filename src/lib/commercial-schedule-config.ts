// Commercial scheduling configuration

export const COMMERCIAL_HOURS = [
  '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00'
] as const;

export type CommercialHour = typeof COMMERCIAL_HOURS[number];

export const DEFAULT_MAX_PER_HOUR = 15;

// Portuguese weekday names
const WEEKDAY_NAMES_PT: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

export function getWeekdayName(date: Date): string {
  return WEEKDAY_NAMES_PT[date.getDay()];
}

export function formatServiceDay(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const weekday = getWeekdayName(date);
  return `${day}/${month} - ${weekday}`;
}
