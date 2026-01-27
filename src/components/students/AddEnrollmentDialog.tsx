import { useState, useEffect } from 'react';
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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Tipos de matrícula
const ENROLLMENT_TYPES = [
  { id: 'modelo_agenciado_maxfama', label: 'Modelo Agenciado - MaxFama', color: 'bg-purple-500' },
  { id: 'modelo_agenciado_popschool', label: 'Modelo Agenciado - Pop School', color: 'bg-blue-500' },
  { id: 'indicacao_influencia', label: 'Indicação Influência', color: 'bg-pink-500' },
  { id: 'indicacao_aluno', label: 'Indicação de Aluno', color: 'bg-green-500' },
] as const;

const enrollmentSchema = z.object({
  student_id: z.string().min(1, 'Selecione um aluno'),
  course_id: z.string().min(1, 'Selecione um curso'),
  class_id: z.string().optional(),
  lead_id: z.string().optional(),
  enrollment_type: z.string().optional(),
  influencer_name: z.string().optional(),
  referral_agent_code: z.string().optional(),
  student_age: z.coerce.number().optional(),
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
      class_id: '',
      lead_id: '',
      enrollment_type: '',
      influencer_name: '',
      referral_agent_code: '',
      student_age: undefined,
      notes: '',
    },
  });

  const selectedEnrollmentType = form.watch('enrollment_type');
  const selectedCourseId = form.watch('course_id');

  // Fetch existing users
  const { data: students } = useQuery({
    queryKey: ['students-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch leads with status 'matriculado'
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

  // Fetch classes for selected course
  const { data: classes } = useQuery({
    queryKey: ['classes-for-enrollment', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, room, start_date')
        .eq('course_id', selectedCourseId)
        .eq('is_active', true)
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCourseId,
  });

  // Fetch influencers
  const { data: influencers } = useQuery({
    queryKey: ['influencers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const onSubmit = async (values: EnrollmentFormValues) => {
    setIsSubmitting(true);
    try {
      // Build the enrollment data - cast to any for new fields not yet in types
      const enrollmentData: Record<string, unknown> = {
        student_id: values.student_id,
        course_id: values.course_id,
        lead_id: values.lead_id || null,
        notes: values.notes || null,
        status: 'ativo' as const,
      };

      // Add optional new fields
      if (values.class_id) enrollmentData.class_id = values.class_id;
      if (values.enrollment_type) enrollmentData.enrollment_type = values.enrollment_type;
      if (values.influencer_name) enrollmentData.influencer_name = values.influencer_name;
      if (values.referral_agent_code) enrollmentData.referral_agent_code = values.referral_agent_code;
      if (values.student_age) enrollmentData.student_age = values.student_age;

      const { error } = await supabase
        .from('enrollments')
        .insert(enrollmentData as never);

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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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

              {/* Tipo de Matrícula */}
              <FormField
                control={form.control}
                name="enrollment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Matrícula</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de matrícula" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ENROLLMENT_TYPES.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${type.color}`} />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo condicional: Influenciador */}
              {selectedEnrollmentType === 'indicacao_influencia' && (
                <FormField
                  control={form.control}
                  name="influencer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Influenciador</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o influenciador" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {influencers?.map((influencer) => (
                            <SelectItem key={influencer.id} value={influencer.name}>
                              {influencer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Campo condicional: Código do Agenciado */}
              {selectedEnrollmentType === 'indicacao_aluno' && (
                <FormField
                  control={form.control}
                  name="referral_agent_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código do Agenciado</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: AG001" {...field} />
                      </FormControl>
                      <FormDescription>
                        Código do aluno que fez a indicação
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Idade do Aluno */}
              <FormField
                control={form.control}
                name="student_age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Idade do Aluno</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Ex: 18" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Curso */}
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

              {/* Turma */}
              {selectedCourseId && classes && classes.length > 0 && (
                <FormField
                  control={form.control}
                  name="class_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turma</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma turma" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classes.map((classItem) => (
                            <SelectItem key={classItem.id} value={classItem.id}>
                              {classItem.name} - {classItem.room} ({new Date(classItem.start_date).toLocaleDateString('pt-BR')})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Opcional: vincule o aluno a uma turma específica
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Observações */}
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
