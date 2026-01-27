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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Users, Info } from 'lucide-react';
import { COURSE_WEEKS } from '@/lib/course-schedule-config';

// Tipos de matrícula
const ENROLLMENT_TYPES = [
  { id: 'modelo_agenciado_maxfama', label: 'Modelo Agenciado - MaxFama', color: 'bg-purple-500' },
  { id: 'modelo_agenciado_popschool', label: 'Modelo Agenciado - Pop School', color: 'bg-blue-500' },
  { id: 'indicacao_influencia', label: 'Indicação Influência', color: 'bg-pink-500' },
  { id: 'indicacao_aluno', label: 'Indicação de Aluno', color: 'bg-green-500' },
] as const;

// Schema para novo aluno (agora é lead direto) - sem email
const newStudentSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  course_id: z.string().min(1, 'Selecione um curso'),
  class_id: z.string().min(1, 'Selecione uma turma'),
  enrollment_type: z.string().min(1, 'Selecione o tipo de matrícula'),
  influencer_name: z.string().optional(),
  referral_agent_code: z.string().optional(),
  student_age: z.coerce.number().min(1, 'Informe a idade'),
  notes: z.string().optional(),
});

// Schema para lead existente
const existingLeadSchema = z.object({
  lead_id: z.string().min(1, 'Selecione um lead'),
  course_id: z.string().min(1, 'Selecione um curso'),
  class_id: z.string().min(1, 'Selecione uma turma'),
  enrollment_type: z.string().optional(),
  influencer_name: z.string().optional(),
  referral_agent_code: z.string().optional(),
  student_age: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type NewStudentFormValues = z.infer<typeof newStudentSchema>;
type ExistingLeadFormValues = z.infer<typeof existingLeadSchema>;

interface AddEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddEnrollmentDialog({ open, onOpenChange, onSuccess }: AddEnrollmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollmentSource, setEnrollmentSource] = useState<'new' | 'existing'>('new');

  // Form para novo aluno
  const newStudentForm = useForm<NewStudentFormValues>({
    resolver: zodResolver(newStudentSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      course_id: '',
      class_id: '',
      enrollment_type: '',
      influencer_name: '',
      referral_agent_code: '',
      student_age: undefined,
      notes: '',
    },
  });

  // Form para lead existente
  const existingLeadForm = useForm<ExistingLeadFormValues>({
    resolver: zodResolver(existingLeadSchema),
    defaultValues: {
      lead_id: '',
      course_id: '',
      class_id: '',
      enrollment_type: '',
      influencer_name: '',
      referral_agent_code: '',
      student_age: undefined,
      notes: '',
    },
  });

  const selectedEnrollmentTypeNew = newStudentForm.watch('enrollment_type');
  const selectedCourseIdNew = newStudentForm.watch('course_id');
  
  const selectedEnrollmentTypeExisting = existingLeadForm.watch('enrollment_type');
  const selectedCourseIdExisting = existingLeadForm.watch('course_id');

  // Fetch leads that can be enrolled (not already enrolled)
  const { data: leads } = useQuery({
    queryKey: ['leads-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone, status')
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
        .select('id, name, price, duration_hours')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch classes for selected course (new student)
  const { data: classesNew } = useQuery({
    queryKey: ['classes-for-enrollment', selectedCourseIdNew],
    queryFn: async () => {
      if (!selectedCourseIdNew) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, room, start_date, schedule')
        .eq('course_id', selectedCourseIdNew)
        .eq('is_active', true)
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCourseIdNew,
  });

  // Fetch classes for selected course (existing lead)
  const { data: classesExisting } = useQuery({
    queryKey: ['classes-for-enrollment', selectedCourseIdExisting],
    queryFn: async () => {
      if (!selectedCourseIdExisting) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, room, start_date, schedule')
        .eq('course_id', selectedCourseIdExisting)
        .eq('is_active', true)
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCourseIdExisting,
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

  // Submit para novo aluno - cria lead E matrícula
  const onSubmitNewStudent = async (values: NewStudentFormValues) => {
    setIsSubmitting(true);
    try {
      // 1. Criar o lead (sem email)
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert({
          full_name: values.full_name,
          phone: values.phone,
          course_interest_id: values.course_id,
          source: 'indicacao' as const,
          status: 'matriculado' as const,
          notes: values.notes || null,
        })
        .select('id')
        .single();

      if (leadError) throw leadError;

      // 2. Criar a matrícula usando o lead_id - class_id é obrigatório
      const enrollmentData: Record<string, unknown> = {
        lead_id: leadData.id,
        student_id: leadData.id, // Using lead_id as student_id for compatibility
        course_id: values.course_id,
        class_id: values.class_id, // Obrigatório - aluno sempre entra em uma turma
        notes: values.notes || null,
        status: 'ativo' as const,
        progress_percentage: 0,
        enrollment_type: values.enrollment_type,
        student_age: values.student_age,
      };

      if (values.influencer_name) enrollmentData.influencer_name = values.influencer_name;
      if (values.referral_agent_code) enrollmentData.referral_agent_code = values.referral_agent_code;

      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .insert(enrollmentData as never);

      if (enrollmentError) throw enrollmentError;

      toast.success('Matrícula realizada!', {
        description: `${values.full_name} foi matriculado com sucesso. ${COURSE_WEEKS} aulas agendadas.`,
      });

      newStudentForm.reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating new student:', error);
      toast.error('Erro ao cadastrar aluno');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit para lead existente
  const onSubmitExistingLead = async (values: ExistingLeadFormValues) => {
    setIsSubmitting(true);
    try {
      // Update lead status to matriculado
      await supabase
        .from('leads')
        .update({ status: 'matriculado' as const })
        .eq('id', values.lead_id);

      const enrollmentData: Record<string, unknown> = {
        lead_id: values.lead_id,
        student_id: values.lead_id, // Using lead_id as student_id for compatibility
        course_id: values.course_id,
        class_id: values.class_id, // Obrigatório - aluno sempre entra em uma turma
        notes: values.notes || null,
        status: 'ativo' as const,
        progress_percentage: 0,
      };

      if (values.enrollment_type) enrollmentData.enrollment_type = values.enrollment_type;
      if (values.influencer_name) enrollmentData.influencer_name = values.influencer_name;
      if (values.referral_agent_code) enrollmentData.referral_agent_code = values.referral_agent_code;
      if (values.student_age) enrollmentData.student_age = values.student_age;

      const { error } = await supabase
        .from('enrollments')
        .insert(enrollmentData as never);

      if (error) {
        if (error.code === '23505') {
          toast.error('Este lead já está matriculado neste curso');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Matrícula realizada!', {
        description: `${COURSE_WEEKS} aulas agendadas para o aluno`,
      });
      existingLeadForm.reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating enrollment:', error);
      toast.error('Erro ao criar matrícula');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSchedule = (schedule: Record<string, string> | null) => {
    if (!schedule) return '';
    const days: Record<string, string> = {
      monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua',
      thursday: 'Qui', friday: 'Sex', saturday: 'Sáb', sunday: 'Dom',
    };
    return Object.entries(schedule)
      .map(([day, time]) => `${days[day] || day} ${time}`)
      .join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Matrícula</DialogTitle>
          <DialogDescription>
            Cadastre um novo aluno ou matricule um lead existente
          </DialogDescription>
        </DialogHeader>

        <Tabs value={enrollmentSource} onValueChange={(v) => setEnrollmentSource(v as 'new' | 'existing')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Aluno
            </TabsTrigger>
            <TabsTrigger value="existing" className="gap-2">
              <Users className="h-4 w-4" />
              Lead Existente
            </TabsTrigger>
          </TabsList>

          {/* TAB: Novo Aluno */}
          <TabsContent value="new" className="mt-4">
            <Form {...newStudentForm}>
              <form onSubmit={newStudentForm.handleSubmit(onSubmitNewStudent)} className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Cadastre novos alunos diretamente. Eles serão salvos como leads e matriculados automaticamente.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={newStudentForm.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do aluno" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newStudentForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone *</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={newStudentForm.control}
                  name="student_age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idade *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="18" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newStudentForm.control}
                  name="enrollment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Matrícula *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
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
                {selectedEnrollmentTypeNew === 'indicacao_influencia' && (
                  <FormField
                    control={newStudentForm.control}
                    name="influencer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quem Indicou (Influenciador) *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione quem indicou" />
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
                {selectedEnrollmentTypeNew === 'indicacao_aluno' && (
                  <FormField
                    control={newStudentForm.control}
                    name="referral_agent_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código do Aluno que Indicou *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: AG001" {...field} />
                        </FormControl>
                        <FormDescription>
                          Código de agenciado do aluno que fez a indicação
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={newStudentForm.control}
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
                              {course.name} ({course.duration_hours || 1}h/aula) - R$ {course.price || 0}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {COURSE_WEEKS} aulas semanais (2 meses)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newStudentForm.control}
                  name="class_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turma *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCourseIdNew}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedCourseIdNew ? "Selecione a turma" : "Selecione o curso primeiro"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classesNew?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} - {c.room} ({formatSchedule(c.schedule as Record<string, string>)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {classesNew?.length === 0 && selectedCourseIdNew && (
                        <p className="text-xs text-destructive">Nenhuma turma ativa para este curso</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newStudentForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Observações sobre o aluno..." 
                          className="resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Cadastrando...' : 'Cadastrar Aluno'}
                </Button>
              </form>
            </Form>
          </TabsContent>

          {/* TAB: Lead Existente */}
          <TabsContent value="existing" className="mt-4">
            <Form {...existingLeadForm}>
              <form onSubmit={existingLeadForm.handleSubmit(onSubmitExistingLead)} className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Selecione um lead existente para matricular. O status será atualizado automaticamente.
                  </AlertDescription>
                </Alert>

                <FormField
                  control={existingLeadForm.control}
                  name="lead_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o lead" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leads?.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.full_name} - {lead.phone} ({lead.status})
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
                    control={existingLeadForm.control}
                    name="student_age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Idade</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="18" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={existingLeadForm.control}
                    name="enrollment_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Matrícula</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
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
                </div>

                {/* Campo condicional: Influenciador */}
                {selectedEnrollmentTypeExisting === 'indicacao_influencia' && (
                  <FormField
                    control={existingLeadForm.control}
                    name="influencer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quem Indicou (Influenciador)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione quem indicou" />
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
                {selectedEnrollmentTypeExisting === 'indicacao_aluno' && (
                  <FormField
                    control={existingLeadForm.control}
                    name="referral_agent_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código do Aluno que Indicou</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: AG001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={existingLeadForm.control}
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
                              {course.name} ({course.duration_hours || 1}h/aula) - R$ {course.price || 0}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {COURSE_WEEKS} aulas semanais (2 meses)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={existingLeadForm.control}
                  name="class_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turma *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCourseIdExisting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedCourseIdExisting ? "Selecione a turma" : "Selecione o curso primeiro"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classesExisting?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} - {c.room} ({formatSchedule(c.schedule as Record<string, string>)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {classesExisting?.length === 0 && selectedCourseIdExisting && (
                        <p className="text-xs text-destructive">Nenhuma turma ativa para este curso</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={existingLeadForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Observações sobre a matrícula..." 
                          className="resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Matriculando...' : 'Matricular Lead'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
