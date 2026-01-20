import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const enrollmentSchema = z.object({
  student_id: z.string().min(1, 'Selecione um aluno'),
  course_id: z.string().min(1, 'Selecione um curso'),
  lead_id: z.string().optional(),
  notes: z.string().optional(),
});

type EnrollmentFormValues = z.infer<typeof enrollmentSchema>;

interface AddEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddEnrollmentDialog({ open, onOpenChange, onSuccess }: AddEnrollmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollmentSource, setEnrollmentSource] = useState<'existing' | 'lead'>('existing');

  const form = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      student_id: '',
      course_id: '',
      lead_id: '',
      notes: '',
    },
  });

  // Fetch existing users with 'aluno' role
  const { data: students } = useQuery({
    queryKey: ['students-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          full_name,
          phone
        `)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch leads with status 'matriculado' that don't have an enrollment yet
  const { data: matriculatedLeads } = useQuery({
    queryKey: ['matriculated-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone, course_interest_id, courses(name)')
        .eq('status', 'matriculado')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch active courses
  const { data: courses } = useQuery({
    queryKey: ['courses-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, price')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const onSubmit = async (values: EnrollmentFormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('enrollments')
        .insert({
          student_id: values.student_id,
          course_id: values.course_id,
          lead_id: values.lead_id || null,
          notes: values.notes || null,
          status: 'ativo',
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Este aluno já está matriculado neste curso');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Matrícula realizada com sucesso!');
      form.reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating enrollment:', error);
      toast.error('Erro ao criar matrícula');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeadSelect = (leadId: string) => {
    const lead = matriculatedLeads?.find(l => l.id === leadId);
    if (lead) {
      form.setValue('lead_id', leadId);
      if (lead.course_interest_id) {
        form.setValue('course_id', lead.course_interest_id);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Matrícula</DialogTitle>
        </DialogHeader>

        <Tabs value={enrollmentSource} onValueChange={(v) => setEnrollmentSource(v as 'existing' | 'lead')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Aluno Existente</TabsTrigger>
            <TabsTrigger value="lead">A partir de Lead</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <TabsContent value="existing" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="student_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aluno *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um aluno" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {students?.map((student) => (
                            <SelectItem key={student.user_id} value={student.user_id}>
                              {student.full_name} {student.phone && `- ${student.phone}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="lead" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="lead_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Matriculado *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleLeadSelect(value);
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um lead" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {matriculatedLeads?.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.full_name} - {lead.courses?.name || 'Sem curso'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-sm text-muted-foreground">
                  Obs: Para matricular um lead, primeiro ele precisa ter uma conta de usuário no sistema.
                </p>
              </TabsContent>

              <FormField
                control={form.control}
                name="course_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Curso *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um curso" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses?.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name} {course.price && `- R$ ${course.price}`}
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações sobre a matrícula..."
                        {...field}
                      />
                    </FormControl>
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
                  {isSubmitting ? 'Salvando...' : 'Matricular'}
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
