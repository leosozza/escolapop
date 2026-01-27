import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addWeeks } from 'date-fns';
import { CalendarIcon, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ROOMS,
  WEEKDAYS,
  COURSE_DURATIONS,
  COURSE_WEEKS,
  getAvailableHours,
  formatTimeRange,
} from '@/lib/course-schedule-config';

const classSchema = z.object({
  name: z.string().min(1, 'Nome da turma é obrigatório'),
  course_id: z.string().min(1, 'Selecione um curso'),
  room: z.string().min(1, 'Selecione uma sala'),
  start_date: z.date({ required_error: 'Data de início é obrigatória' }),
  teacher_id: z.string().optional(),
  schedule_day: z.string().min(1, 'Selecione o dia da semana'),
  schedule_time: z.string().min(1, 'Selecione o horário'),
});

type ClassFormValues = z.infer<typeof classSchema>;

interface AddClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddClassDialog({ open, onOpenChange, onSuccess }: AddClassDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: '',
      course_id: '',
      room: '',
      schedule_day: '',
      schedule_time: '',
    },
  });

  const selectedRoom = form.watch('room');
  const selectedCourseId = form.watch('course_id');
  const selectedTime = form.watch('schedule_time');
  const selectedDay = form.watch('schedule_day');
  const startDate = form.watch('start_date');
  
  const roomCapacity = ROOMS.find(r => r.id === selectedRoom)?.capacity || 30;

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ['courses-for-class'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, duration_hours')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch teachers (profiles with professor role)
  const { data: teachers } = useQuery({
    queryKey: ['teachers-for-class'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Get selected course info
  const selectedCourse = courses?.find(c => c.id === selectedCourseId);
  const courseDuration = selectedCourse?.duration_hours || COURSE_DURATIONS[selectedCourse?.name || ''] || 1;
  const availableHours = getAvailableHours(courseDuration);

  // Reset time when course changes and time is not available
  useEffect(() => {
    if (selectedTime && !availableHours.includes(selectedTime)) {
      form.setValue('schedule_time', '');
    }
  }, [selectedCourseId, selectedTime, availableHours, form]);

  // Calculate end date (8 weeks from start)
  const endDate = startDate ? addWeeks(startDate, COURSE_WEEKS) : null;

  const onSubmit = async (values: ClassFormValues) => {
    setIsSubmitting(true);
    try {
      // Build schedule object with time range
      const schedule: Record<string, string> = {};
      if (values.schedule_day && values.schedule_time) {
        schedule[values.schedule_day] = formatTimeRange(values.schedule_time, courseDuration);
      }

      const { error } = await supabase
        .from('classes')
        .insert({
          name: values.name,
          course_id: values.course_id,
          room: ROOMS.find(r => r.id === values.room)?.name || values.room,
          start_date: format(values.start_date, 'yyyy-MM-dd'),
          end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
          teacher_id: values.teacher_id || null,
          max_students: roomCapacity,
          schedule: Object.keys(schedule).length > 0 ? schedule : null,
          is_active: true,
        });

      if (error) throw error;

      toast.success('Turma criada com sucesso!', {
        description: `${COURSE_WEEKS} aulas agendadas semanalmente`,
      });
      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating class:', error);
      toast.error('Erro ao criar turma');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDayName = WEEKDAYS.find(d => d.id === selectedDay)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Turma</DialogTitle>
          <DialogDescription>
            Configure a turma com dia e horário fixo semanal
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Turma *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Passarela Turma A - Manhã" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="course_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Curso *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o curso" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          <div className="flex items-center gap-2">
                            {course.name}
                            <Badge variant="secondary" className="text-xs">
                              {course.duration_hours || COURSE_DURATIONS[course.name] || 1}h
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCourse && (
                    <FormDescription className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Duração: {courseDuration} hora{courseDuration > 1 ? 's' : ''} por aula
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="room"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sala *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a sala" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROOMS.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name} (capacidade: {room.capacity} pessoas)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="schedule_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia da Semana *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o dia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEEKDAYS.map((day) => (
                          <SelectItem key={day.id} value={day.id}>
                            {day.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schedule_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de Início *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!selectedCourseId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o horário" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableHours.map((hour) => (
                          <SelectItem key={hour} value={hour}>
                            {formatTimeRange(hour, courseDuration)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Primeira Aula *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'dd/MM/yyyy')
                          ) : (
                            <span>Selecione a data da primeira aula</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    O aluno frequentará 1x por semana durante 2 meses ({COURSE_WEEKS} aulas)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {startDate && selectedDay && selectedTime && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Resumo do cronograma:</strong>
                  <br />
                  • Primeira aula: {format(startDate, 'dd/MM/yyyy')}
                  <br />
                  • Dia fixo: Toda {selectedDayName}
                  <br />
                  • Horário: {formatTimeRange(selectedTime, courseDuration)}
                  <br />
                  • Última aula: {endDate ? format(endDate, 'dd/MM/yyyy') : '-'}
                  <br />
                  • Total: {COURSE_WEEKS} aulas
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="teacher_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Professor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o professor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teachers?.map((teacher) => (
                        <SelectItem key={teacher.user_id} value={teacher.user_id}>
                          {teacher.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Criar Turma'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
