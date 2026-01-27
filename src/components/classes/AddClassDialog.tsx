import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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

// Salas disponíveis com suas capacidades
const ROOMS = [
  { id: 'sala_1', name: 'Sala 1', capacity: 50 },
  { id: 'sala_2', name: 'Sala 2', capacity: 50 },
  { id: 'sala_5', name: 'Sala 5', capacity: 30 },
  { id: 'sala_6', name: 'Sala 6', capacity: 20 },
] as const;

// Dias da semana
const WEEKDAYS = [
  { id: 'monday', name: 'Segunda' },
  { id: 'tuesday', name: 'Terça' },
  { id: 'wednesday', name: 'Quarta' },
  { id: 'thursday', name: 'Quinta' },
  { id: 'friday', name: 'Sexta' },
  { id: 'saturday', name: 'Sábado' },
] as const;

const classSchema = z.object({
  name: z.string().min(1, 'Nome da turma é obrigatório'),
  course_id: z.string().min(1, 'Selecione um curso'),
  room: z.string().min(1, 'Selecione uma sala'),
  start_date: z.date({ required_error: 'Data de início é obrigatória' }),
  end_date: z.date().optional(),
  teacher_id: z.string().optional(),
  schedule_day: z.string().optional(),
  schedule_time: z.string().optional(),
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
  const roomCapacity = ROOMS.find(r => r.id === selectedRoom)?.capacity || 30;

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ['courses-for-class'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name')
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

  const onSubmit = async (values: ClassFormValues) => {
    setIsSubmitting(true);
    try {
      // Build schedule object
      const schedule: Record<string, string> = {};
      if (values.schedule_day && values.schedule_time) {
        schedule[values.schedule_day] = values.schedule_time;
      }

      const { error } = await supabase
        .from('classes')
        .insert({
          name: values.name,
          course_id: values.course_id,
          room: ROOMS.find(r => r.id === values.room)?.name || values.room,
          start_date: format(values.start_date, 'yyyy-MM-dd'),
          end_date: values.end_date ? format(values.end_date, 'yyyy-MM-dd') : null,
          teacher_id: values.teacher_id || null,
          max_students: roomCapacity,
          schedule: Object.keys(schedule).length > 0 ? schedule : null,
          is_active: true,
        });

      if (error) throw error;

      toast.success('Turma criada com sucesso!');
      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating class:', error);
      toast.error('Erro ao criar turma');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Nova Turma</DialogTitle>
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
                          {course.name}
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
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início *</FormLabel>
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
                              <span>Selecione</span>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Término</FormLabel>
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
                              <span>Selecione</span>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="schedule_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia da Semana</FormLabel>
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
                    <FormLabel>Horário</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
