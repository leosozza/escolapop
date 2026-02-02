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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isToday, isWithinInterval, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { COURSE_WEEKS } from '@/lib/course-schedule-config';

interface Class {
  id: string;
  name: string;
  course_id: string;
  room: string | null;
  start_date: string;
  end_date: string | null;
  schedule: Record<string, string> | null;
  is_active: boolean;
  course?: { name: string; duration_hours: number | null };
  student_count?: number;
}

interface ClassCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: Class[];
}

type ViewMode = 'month' | 'week' | 'timeline';

const ROOM_COLORS: Record<string, string> = {
  'Sala 1': 'bg-blue-500',
  'Sala 2': 'bg-green-500',
  'Sala 5': 'bg-purple-500',
  'Sala 6': 'bg-orange-500',
};

export function ClassCalendarDialog({ open, onOpenChange, classes }: ClassCalendarDialogProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');

  const uniqueRooms = useMemo(() => {
    const rooms = classes.map(c => c.room).filter((r): r is string => !!r);
    return [...new Set(rooms)].sort();
  }, [classes]);

  const filteredClasses = useMemo(() => {
    if (selectedRoom === 'all') return classes;
    return classes.filter(c => c.room === selectedRoom);
  }, [classes, selectedRoom]);

  // Group classes by room - moved from renderTimelineView to component level
  const classesByRoom = useMemo(() => {
    const grouped: Record<string, Class[]> = {};
    uniqueRooms.forEach(room => {
      grouped[room] = filteredClasses.filter(c => c.room === room);
    });
    // Add classes without room
    const noRoom = filteredClasses.filter(c => !c.room);
    if (noRoom.length > 0) {
      grouped['Sem Sala'] = noRoom;
    }
    return grouped;
  }, [filteredClasses, uniqueRooms]);

  const getClassEndDate = (classItem: Class) => {
    if (classItem.end_date) return new Date(classItem.end_date);
    const startDate = new Date(classItem.start_date);
    return addDays(startDate, COURSE_WEEKS * 7);
  };

  const getCurrentLesson = (classItem: Class) => {
    const startDate = new Date(classItem.start_date);
    const now = new Date();
    const daysSinceStart = differenceInDays(now, startDate);
    if (daysSinceStart < 0) return 0;
    const weeksPassed = Math.floor(daysSinceStart / 7) + 1;
    return Math.min(weeksPassed, COURSE_WEEKS);
  };

  // Timeline View (Gantt-style)
  const renderTimelineView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
    const days = Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));

    return (
      <div className="space-y-4">
        {/* Days header */}
        <div className="flex">
          <div className="w-48 flex-shrink-0 p-2 font-medium border-r">
            Sala / Turma
          </div>
          <div className="flex-1 overflow-x-auto">
            <div className="flex min-w-max">
              {days.map((day, idx) => (
                <div
                  key={idx}
                  className={`w-8 flex-shrink-0 text-center text-xs p-1 border-r ${
                    isToday(day) ? 'bg-primary text-primary-foreground font-bold' : ''
                  } ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-muted/50' : ''}`}
                >
                  <div>{format(day, 'd')}</div>
                  <div className="text-[10px] opacity-70">
                    {format(day, 'EEE', { locale: ptBR }).slice(0, 3)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rows by room */}
        <ScrollArea className="h-[400px]">
          {Object.entries(classesByRoom).map(([room, roomClasses]) => (
            <div key={room} className="border-b">
              {/* Room header */}
              <div className="flex items-center gap-2 p-2 bg-muted/30">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">{room}</span>
                <Badge variant="secondary" className="text-xs">
                  {roomClasses.length} turmas
                </Badge>
              </div>
              
              {/* Classes in this room */}
              {roomClasses.map((classItem) => {
                const classStart = startOfDay(new Date(classItem.start_date));
                const classEnd = startOfDay(getClassEndDate(classItem));
                const currentLesson = getCurrentLesson(classItem);
                
                return (
                  <div key={classItem.id} className="flex border-t">
                    <div className="w-48 flex-shrink-0 p-2 border-r">
                      <div className="text-sm font-medium truncate">{classItem.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {classItem.course?.name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Users className="h-3 w-3" />
                        {classItem.student_count || 0} alunos • Aula {currentLesson}/{COURSE_WEEKS}
                      </div>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                      <div className="flex min-w-max relative h-14">
                        {days.map((day, idx) => {
                          const dayStart = startOfDay(day);
                          const isInRange = isWithinInterval(dayStart, {
                            start: classStart,
                            end: classEnd,
                          });
                          const isClassStart = dayStart.getTime() === classStart.getTime();
                          const isClassEnd = dayStart.getTime() === classEnd.getTime();
                          
                          // Calculate which lesson this day falls into
                          const daysSinceClassStart = differenceInDays(dayStart, classStart);
                          const lessonNumber = Math.floor(daysSinceClassStart / 7) + 1;
                          const isLessonDay = daysSinceClassStart >= 0 && daysSinceClassStart % 7 === 0 && lessonNumber <= COURSE_WEEKS;
                          
                          return (
                            <div
                              key={idx}
                              className={`w-8 flex-shrink-0 border-r flex items-center justify-center relative ${
                                day.getDay() === 0 || day.getDay() === 6 ? 'bg-muted/30' : ''
                              }`}
                            >
                              {isInRange && (
                                <div
                                  className={`absolute inset-y-2 inset-x-0 ${
                                    ROOM_COLORS[classItem.room || ''] || 'bg-primary'
                                  } ${isClassStart ? 'rounded-l-md ml-1' : ''} ${
                                    isClassEnd ? 'rounded-r-md mr-1' : ''
                                  } opacity-30`}
                                />
                              )}
                              {isLessonDay && isInRange && (
                                <div
                                  className={`absolute inset-y-1 w-6 rounded ${
                                    ROOM_COLORS[classItem.room || ''] || 'bg-primary'
                                  } flex items-center justify-center text-white text-[10px] font-bold z-10`}
                                  title={`Aula ${lessonNumber}`}
                                >
                                  {lessonNumber}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </ScrollArea>
      </div>
    );
  };

  // Month View (Calendar grid)
  const renderMonthView = () => {
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

    const getClassesForDay = (date: Date) => {
      return filteredClasses.filter(c => {
        const startDate = startOfDay(new Date(c.start_date));
        const endDate = startOfDay(getClassEndDate(c));
        return isWithinInterval(startOfDay(date), { start: startDate, end: endDate });
      });
    };

    return (
      <div className="space-y-2">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName) => (
            <div key={dayName} className="text-center text-sm font-medium text-muted-foreground p-2">
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const dayClasses = getClassesForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div
                key={idx}
                className={`min-h-24 p-1 border rounded-md ${
                  !isCurrentMonth ? 'bg-muted/30 opacity-50' : ''
                } ${isToday(day) ? 'border-primary border-2' : 'border-border'}`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday(day) ? 'text-primary' : ''}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 overflow-hidden max-h-16">
                  {dayClasses.slice(0, 3).map((classItem) => (
                    <div
                      key={classItem.id}
                      className={`text-[10px] px-1 py-0.5 rounded truncate text-white ${
                        ROOM_COLORS[classItem.room || ''] || 'bg-primary'
                      }`}
                      title={`${classItem.name} - ${classItem.room || 'Sem sala'}`}
                    >
                      {classItem.name}
                    </div>
                  ))}
                  {dayClasses.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{dayClasses.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Week View
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const getClassesForDay = (date: Date) => {
      return filteredClasses.filter(c => {
        const startDate = startOfDay(new Date(c.start_date));
        const endDate = startOfDay(getClassEndDate(c));
        return isWithinInterval(startOfDay(date), { start: startDate, end: endDate });
      });
    };

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, idx) => {
            const dayClasses = getClassesForDay(day);
            
            return (
              <div
                key={idx}
                className={`border rounded-lg p-2 ${
                  isToday(day) ? 'border-primary border-2' : 'border-border'
                }`}
              >
                <div className="text-center mb-2">
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'EEE', { locale: ptBR })}
                  </div>
                  <div className={`text-lg font-bold ${isToday(day) ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                <ScrollArea className="h-64">
                  <div className="space-y-1">
                    {dayClasses.map((classItem) => {
                      const currentLesson = getCurrentLesson(classItem);
                      const schedule = classItem.schedule as Record<string, string> | null;
                      const dayKey = format(day, 'EEEE', { locale: ptBR }).toLowerCase();
                      const dayKeyEn = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day.getDay()];
                      const classTime = schedule?.[dayKeyEn] || '';
                      
                      return (
                        <div
                          key={classItem.id}
                          className={`p-2 rounded text-white text-xs ${
                            ROOM_COLORS[classItem.room || ''] || 'bg-primary'
                          }`}
                        >
                          <div className="font-medium truncate">{classItem.name}</div>
                          <div className="opacity-80 truncate">{classItem.room}</div>
                          {classTime && <div className="opacity-80">{classTime}</div>}
                          <div className="opacity-80">Aula {currentLesson}/{COURSE_WEEKS}</div>
                        </div>
                      );
                    })}
                    {dayClasses.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        Sem turmas
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendário de Turmas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold ml-2">
                {format(currentDate, viewMode === 'week' ? "'Semana de' dd MMM yyyy" : 'MMMM yyyy', { locale: ptBR })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger className="w-36">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sala" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueRooms.map((room) => (
                    <SelectItem key={room} value={room}>
                      {room}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timeline">Timeline</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <span className="text-muted-foreground">Legenda:</span>
            {Object.entries(ROOM_COLORS).map(([room, color]) => (
              <div key={room} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${color}`} />
                <span>{room}</span>
              </div>
            ))}
          </div>

          {/* Calendar View */}
          <div className="border rounded-lg p-4 overflow-auto">
            {viewMode === 'timeline' && renderTimelineView()}
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
