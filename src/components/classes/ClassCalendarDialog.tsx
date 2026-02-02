import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Users, Clock, GraduationCap } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addDays, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SCHOOL_HOURS, ROOMS, COURSE_WEEKS } from '@/lib/course-schedule-config';

interface Class {
  id: string;
  name: string;
  course_id: string;
  teacher_id: string | null;
  room: string | null;
  start_date: string;
  end_date: string | null;
  schedule: Record<string, string> | null;
  max_students: number;
  is_active: boolean;
  created_at: string;
  course?: { name: string; duration_hours: number | null };
  teacher?: { full_name: string };
  student_count?: number;
}

interface ClassCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: Class[];
  onClassSelect?: (classItem: Class) => void;
}

// Cores por curso (nome do curso -> cor)
const COURSE_COLORS: Record<string, { bg: string; text: string; name: string }> = {
  'Passarela': { bg: 'bg-blue-500', text: 'text-white', name: 'Passarela' },
  'Oficina de Cinema e TV': { bg: 'bg-green-500', text: 'text-white', name: 'Oficina' },
  'Passarela Avançada': { bg: 'bg-purple-500', text: 'text-white', name: 'Avançada' },
  'Influência Digital Start': { bg: 'bg-yellow-500', text: 'text-black', name: 'Influência' },
};

const getCourseColor = (courseName: string | undefined) => {
  if (!courseName) return { bg: 'bg-muted', text: 'text-muted-foreground', name: 'Outro' };
  return COURSE_COLORS[courseName] || { bg: 'bg-muted', text: 'text-muted-foreground', name: 'Outro' };
};

const WEEKDAY_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export function ClassCalendarDialog({ open, onOpenChange, classes, onClassSelect }: ClassCalendarDialogProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassForSheet, setSelectedClassForSheet] = useState<Class | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Calcular todas as datas de aula para cada turma
  const classScheduleMap = useMemo(() => {
    const map = new Map<string, { class: Class; time: string; room: string }[]>();
    
    classes.forEach((classItem) => {
      if (!classItem.schedule || !classItem.start_date) return;
      
      const startDate = new Date(classItem.start_date);
      const schedule = classItem.schedule as Record<string, string>;
      
      Object.entries(schedule).forEach(([dayKey, time]) => {
        if (!time) return;
        
        const dayIndex = Object.entries(WEEKDAY_MAP).find(([, key]) => key === dayKey)?.[0];
        if (dayIndex === undefined) return;
        
        let currentDay = new Date(startDate);
        while (currentDay.getDay() !== parseInt(dayIndex)) {
          currentDay = addDays(currentDay, 1);
        }
        
        for (let i = 0; i < COURSE_WEEKS; i++) {
          const classDate = addDays(currentDay, i * 7);
          const dateKey = format(classDate, 'yyyy-MM-dd');
          
          if (!map.has(dateKey)) {
            map.set(dateKey, []);
          }
          
          map.get(dateKey)!.push({
            class: classItem,
            time: time,
            room: classItem.room || 'Sem Sala',
          });
        }
      });
    });
    
    return map;
  }, [classes]);

  // Gerar os dias do mês
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  const getClassesForDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return classScheduleMap.get(dateKey) || [];
  };

  // Organizar por hora e sala
  const getDayGrid = (date: Date) => {
    const dayClasses = getClassesForDay(date);
    const grid: Record<string, Record<string, { class: Class; studentCount: number } | null>> = {};
    
    SCHOOL_HOURS.forEach((hour) => {
      grid[hour] = {};
      ROOMS.forEach((room) => {
        grid[hour][room.name] = null;
      });
    });
    
    dayClasses.forEach(({ class: classItem, time, room }) => {
      const hourKey = time.split(':')[0] + ':00';
      if (grid[hourKey] && grid[hourKey][room] !== undefined) {
        grid[hourKey][room] = {
          class: classItem,
          studentCount: classItem.student_count || 0,
        };
      }
    });
    
    return grid;
  };

  const handleClassClick = (classItem: Class) => {
    setSelectedClassForSheet(classItem);
    setIsSheetOpen(true);
  };

  const navigatePrevious = () => setCurrentDate(subMonths(currentDate, 1));
  const navigateNext = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[100vw] w-[100vw] max-h-[100vh] h-[100vh] p-0 rounded-none">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-background">
              <DialogHeader className="p-0">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Calendar className="h-6 w-6" />
                  Calendário de Turmas - {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center gap-4">
                {/* Legenda de cores */}
                <div className="flex items-center gap-3 text-xs">
                  {Object.entries(COURSE_COLORS).map(([course, { bg, name }]) => (
                    <div key={course} className="flex items-center gap-1">
                      <div className={`w-3 h-3 rounded ${bg}`} />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>

                {/* Legenda de salas */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground border-l pl-4">
                  <span className="font-medium">Salas:</span>
                  {ROOMS.map((room, idx) => (
                    <span key={room.id}>{idx + 1}={room.name}</span>
                  ))}
                </div>

                {/* Navegação */}
                <div className="flex items-center gap-2 border-l pl-4">
                  <Button variant="outline" size="sm" onClick={navigatePrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Hoje
                  </Button>
                  <Button variant="outline" size="sm" onClick={navigateNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {/* Weekday headers */}
                <div className="grid grid-cols-[50px_repeat(7,1fr)] gap-1 mb-1 sticky top-0 z-10 bg-background">
                  <div className="text-center text-xs font-semibold text-muted-foreground py-2 bg-muted rounded">
                    Hora
                  </div>
                  {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((dayName) => (
                    <div
                      key={dayName}
                      className="text-center text-sm font-semibold text-muted-foreground py-2 bg-muted rounded"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Calendar weeks */}
                {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIdx) => {
                  const weekDays = calendarDays.slice(weekIdx * 7, (weekIdx + 1) * 7);
                  
                  return (
                    <div key={weekIdx} className="mb-2">
                      {/* Day numbers row */}
                      <div className="grid grid-cols-[50px_repeat(7,1fr)] gap-1 mb-[2px]">
                        <div />
                        {weekDays.map((day, dayIdx) => {
                          const isCurrentMonth = isSameMonth(day, currentDate);
                          const isToday = isSameDay(day, new Date());
                          return (
                            <div
                              key={dayIdx}
                              className={`text-center py-1 text-sm font-bold rounded-t ${
                                !isCurrentMonth ? 'text-muted-foreground/40' : ''
                              } ${isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}
                            >
                              {format(day, 'd')}
                            </div>
                          );
                        })}
                      </div>

                      {/* Hours rows */}
                      {SCHOOL_HOURS.map((hour, hourIdx) => (
                        <div key={hour} className="grid grid-cols-[50px_repeat(7,1fr)] gap-1 mb-[1px]">
                          {/* Hour label */}
                          <div className="text-xs font-medium text-muted-foreground flex items-center justify-center bg-muted/30 rounded-l">
                            {hour.replace(':00', 'H')}
                          </div>

                          {/* Day cells for this hour */}
                          {weekDays.map((day, dayIdx) => {
                            const isCurrentMonth = isSameMonth(day, currentDate);
                            const dayGrid = getDayGrid(day);
                            const hourData = dayGrid[hour];

                            return (
                              <div
                                key={dayIdx}
                                className={`grid grid-cols-4 gap-[2px] p-[2px] min-h-[28px] rounded ${
                                  !isCurrentMonth ? 'opacity-30' : ''
                                } ${hourIdx === SCHOOL_HOURS.length - 1 ? 'rounded-b' : ''} bg-muted/20`}
                              >
                                {ROOMS.map((room) => {
                                  const cellData = hourData?.[room.name];
                                  
                                  if (cellData) {
                                    const color = getCourseColor(cellData.class.course?.name);
                                    return (
                                      <button
                                        key={room.id}
                                        onClick={() => handleClassClick(cellData.class)}
                                        className={`${color.bg} ${color.text} rounded text-[10px] font-bold flex items-center justify-center hover:opacity-80 transition-opacity min-h-[24px]`}
                                        title={`${cellData.class.name}\n${room.name} - ${hour}\n${cellData.studentCount} alunos`}
                                      >
                                        {cellData.studentCount}
                                      </button>
                                    );
                                  }
                                  
                                  return (
                                    <div
                                      key={room.id}
                                      className="bg-muted/40 rounded min-h-[24px]"
                                    />
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sheet de detalhes da turma */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Detalhes da Turma
            </SheetTitle>
          </SheetHeader>
          
          {selectedClassForSheet && (
            <div className="mt-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold">{selectedClassForSheet.name}</h3>
                  <Badge className={getCourseColor(selectedClassForSheet.course?.name).bg}>
                    {selectedClassForSheet.course?.name || 'Curso não definido'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedClassForSheet.room || 'Sem sala definida'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedClassForSheet.student_count || 0} alunos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Início: {format(new Date(selectedClassForSheet.start_date), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedClassForSheet.course?.duration_hours || 1}h por aula</span>
                  </div>
                </div>

                {selectedClassForSheet.schedule && (
                  <div>
                    <h4 className="font-medium mb-2">Horários</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedClassForSheet.schedule as Record<string, string>).map(([day, time]) => {
                        if (!time) return null;
                        const dayNames: Record<string, string> = {
                          monday: 'Seg',
                          tuesday: 'Ter',
                          wednesday: 'Qua',
                          thursday: 'Qui',
                          friday: 'Sex',
                          saturday: 'Sáb',
                          sunday: 'Dom',
                        };
                        return (
                          <Badge key={day} variant="secondary">
                            {dayNames[day]}: {time}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    onClassSelect?.(selectedClassForSheet);
                    setIsSheetOpen(false);
                    onOpenChange(false);
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Ver Alunos
                </Button>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Próximas Aulas</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {(() => {
                    const schedule = selectedClassForSheet.schedule as Record<string, string> | null;
                    if (!schedule) return <p>Sem horários definidos</p>;
                    
                    const now = new Date();
                    const upcomingDates: Date[] = [];
                    
                    Object.entries(schedule).forEach(([dayKey, time]) => {
                      if (!time) return;
                      const dayIndex = Object.entries(WEEKDAY_MAP).find(([, key]) => key === dayKey)?.[0];
                      if (!dayIndex) return;
                      
                      let nextDate = new Date(now);
                      while (nextDate.getDay() !== parseInt(dayIndex)) {
                        nextDate = addDays(nextDate, 1);
                      }
                      upcomingDates.push(nextDate);
                    });
                    
                    return upcomingDates.slice(0, 3).map((date, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
