// Configuração de durações dos cursos em horas
export const COURSE_DURATIONS: Record<string, number> = {
  'Passarela': 1,
  'Passarela Avançada': 2,
  'Influência Digital Start': 2,
  'Oficina de Cinema e TV': 1,
};

// Horários de funcionamento da escola
export const SCHOOL_HOURS = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
] as const;

// Horários disponíveis por duração do curso
// Cursos de 1 hora podem começar em qualquer horário
// Cursos de 2 horas só podem começar até 15:00
export const getAvailableHours = (durationHours: number): string[] => {
  if (durationHours === 2) {
    // Cursos de 2h podem começar até 15:00 (termina às 17:00)
    return SCHOOL_HOURS.filter(h => parseInt(h.split(':')[0]) <= 15);
  }
  // Cursos de 1h podem começar até 16:00
  return [...SCHOOL_HOURS];
};

// Formatar horário de término baseado na duração
export const getEndTime = (startTime: string, durationHours: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const endHour = hours + durationHours;
  return `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Salas disponíveis com suas capacidades
export const ROOMS = [
  { id: 'sala_1', name: 'Sala 1', capacity: 50 },
  { id: 'sala_2', name: 'Sala 2', capacity: 50 },
  { id: 'sala_5', name: 'Sala 5', capacity: 30 },
  { id: 'sala_6', name: 'Sala 6', capacity: 20 },
] as const;

// Dias da semana
export const WEEKDAYS = [
  { id: 'monday', name: 'Segunda-feira' },
  { id: 'tuesday', name: 'Terça-feira' },
  { id: 'wednesday', name: 'Quarta-feira' },
  { id: 'thursday', name: 'Quinta-feira' },
  { id: 'friday', name: 'Sexta-feira' },
  { id: 'saturday', name: 'Sábado' },
  { id: 'sunday', name: 'Domingo' },
] as const;

// Número de semanas do curso (2 meses = ~8 semanas)
export const COURSE_WEEKS = 8;

// Calcular todas as datas de aula a partir da data inicial
export const calculateClassDates = (startDate: Date, weekday: string): Date[] => {
  const dates: Date[] = [];
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  
  const targetDay = dayMap[weekday];
  const currentDate = new Date(startDate);
  
  // Ajustar para o próximo dia da semana correto se necessário
  while (currentDate.getDay() !== targetDay) {
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Gerar as 8 datas (1 vez por semana durante 2 meses)
  for (let i = 0; i < COURSE_WEEKS; i++) {
    const classDate = new Date(currentDate);
    classDate.setDate(currentDate.getDate() + (i * 7));
    dates.push(classDate);
  }
  
  return dates;
};

// Formatar horário para exibição
export const formatTimeRange = (startTime: string, durationHours: number): string => {
  const endTime = getEndTime(startTime, durationHours);
  return `${startTime} - ${endTime}`;
};
