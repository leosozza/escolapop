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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ROOMS, WEEKDAYS, COURSE_DURATIONS, COURSE_WEEKS, AGE_RANGES, getAvailableHours, formatTimeRange,
} from '@/lib/course-schedule-config';

const classSchema = z.object({
  name: z.string().min(1, 'Nome da turma é obrigatório'),
  course_id: z.string().min(1, 'Selecione um curso'),
  room: z.string().min(1, 'Selecione uma sala'),
  start_date: z.date({ required_error: 'Data de início é obrigatória' }),
  teacher_id: z.string().optional(),
  schedule_day: z.string().min(1, 'Selecione o dia da semana'),
  schedule_time: z.string().min(1, 'Selecione o horário'),
  age_range: z.string().min(1, 'Selecione a faixa etária'),
});

type ClassFormValues = z.infer<typeof classSchema>;

interface EditClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  classData: {
    id: string;
    name: string;
    course_id: string;
    room: string | null;
    start_date: string;
    teacher_id: string | null;
    schedule: Record<string, string> | null;
    age_range?: string | null;
  };
}

export function EditClassDialog({ open, onOpenChange, onSuccess, classData }: EditClassDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: '',
      course_id: '',
      room: '',
      schedule_day: '',
      schedule_time: '',
      age_range: 'todas',
    },
  });

  // Reset form when classData or open changes
  useEffect(() => {
    if (open && classData) {
      const scheduleDay = classData.schedule ? Object.keys(classData.schedule)[0] || '' : '';
      const scheduleTimeRaw = classData.schedule ? Object.values(classData.schedule)[0] || '' : '';
      const scheduleTime = scheduleTimeRaw.split(' - ')[0] || '';
      const roomId = ROOMS.find(r => r.name === classData.room)?.id || classData.room || '';

      form.reset({
        name: classData.name,
        course_id: classData.course_id,
        room: roomId,
        start_date: new Date(classData.start_date),
        teacher_id: classData.teacher_id || undefined,
        schedule_day: scheduleDay,
        schedule_time: scheduleTime,
        age_range: classData.age_range || 'todas',
      });
    }
  }, [open, classData, form]);

  const selectedCourseId = form.watch('course_id');
  const selectedTime = form.watch('schedule_time');
  const startDate = form.watch('start_date');

  const { data: courses } = useQuery({
    queryKey: ['courses-for-class-edit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('id, name, duration_hours').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: teachers } = useQuery({
    queryKey: ['academic-team-for-class-edit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, full_name, sector')
        .in('sector', ['professor_teatro', 'professor_passarela', 'professor_influencia', 'gerente', 'recepcao'])
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const selectedCourse = courses?.find(c => c.id === selectedCourseId);
  const courseDuration = selectedCourse?.duration_hours || COURSE_DURATIONS[selectedCourse?.name || ''] || 1;
  const availableHours = getAvailableHours(courseDuration);
  const roomCapacity = ROOMS.find(r => r.id === form.watch('room'))?.capacity || 30;
  const endDate = startDate ? addWeeks(startDate, COURSE_WEEKS - 1) : null;

  useEffect(() => {
    if (selectedTime && !availableHours.includes(selectedTime)) {
      form.setValue('schedule_time', '');
    }
  }, [selectedCourseId, selectedTime, availableHours, form]);

  const checkConflict = async (roomName: string, day: string, time: string, newStart: Date, newEnd: Date | null) => {
    const { data: existing } = await supabase
      .from('classes')
      .select('id, name, schedule, start_date, end_date')
      .eq('room', roomName)
      .eq('is_active', true)
      .neq('id', classData.id);

    if (!existing) return null;
    const timeRange = formatTimeRange(time, courseDuration);
    for (const cls of existing) {
      const sch = cls.schedule as Record<string, string> | null;
      if (!sch || !sch[day]) continue;
      if (sch[day] !== timeRange) continue;
      const eStart = new Date(cls.start_date);
      const eEnd = cls.end_date ? new Date(cls.end_date) : addWeeks(eStart, COURSE_WEEKS - 1);
      const nEnd = newEnd || addWeeks(newStart, COURSE_WEEKS - 1);
      if (eStart <= nEnd && eEnd >= newStart) return cls.name;
    }
    return null;
  };

  const onSubmit = async (values: ClassFormValues) => {
    setIsSubmitting(true);
    try {
      const schedule: Record<string, string> = {};
      if (values.schedule_day && values.schedule_time) {
        schedule[values.schedule_day] = formatTimeRange(values.schedule_time, courseDuration);
      }

      const roomName = ROOMS.find(r => r.id === values.room)?.name || values.room;
      const conflict = await checkConflict(roomName, values.schedule_day, values.schedule_time, values.start_date, endDate);
      if (conflict) {
        toast.error(`Conflito: a turma "${conflict}" já ocupa essa sala, dia e horário no mesmo período`);
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('classes')
        .update({
          name: values.name,
          course_id: values.course_id,
          room: roomName,
          start_date: format(values.start_date, 'yyyy-MM-dd'),
          end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
          teacher_id: values.teacher_id || null,
          max_students: roomCapacity,
          schedule: Object.keys(schedule).length > 0 ? schedule : null,
          age_range: values.age_range,
        } as any)
        .eq('id', classData.id);

      if (error) throw error;

      toast.success('Turma atualizada!');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating class:', error);
      toast.error('Erro ao atualizar turma');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Turma</DialogTitle>
          <DialogDescription>Atualize as informações da turma</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da Turma *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="course_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Curso *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger></FormControl>
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
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="room" render={({ field }) => (
              <FormItem>
                <FormLabel>Sala *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione a sala" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {ROOMS.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name} (capacidade: {room.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="schedule_day" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia da Semana *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day.id} value={day.id}>{day.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="schedule_time" render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCourseId}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Horário" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {availableHours.map((hour) => (
                        <SelectItem key={hour} value={hour}>{formatTimeRange(hour, courseDuration)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="age_range" render={({ field }) => (
              <FormItem>
                <FormLabel>Faixa Etária *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Faixa etária" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {AGE_RANGES.map((range) => (
                      <SelectItem key={range.id} value={range.id}>{range.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="start_date" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Primeira Aula *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                        {field.value ? format(field.value, 'dd/MM/yyyy') : <span>Selecione</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="teacher_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Responsável da Turma</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {teachers?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({t.sector.replace('professor_', 'Prof. ').replace('gerente', 'Gerente').replace('recepcao', 'Recepção')})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
