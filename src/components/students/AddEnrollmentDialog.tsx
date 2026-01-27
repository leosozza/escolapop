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

// Schema para aluno novo
const newStudentSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  course_id: z.string().min(1, 'Selecione um curso'),
  class_id: z.string().optional(),
  enrollment_type: z.string().min(1, 'Selecione o tipo de matrícula'),
  influencer_name: z.string().optional(),
  referral_agent_code: z.string().optional(),
  student_age: z.coerce.number().min(1, 'Informe a idade'),
  notes: z.string().optional(),
});

// Schema para aluno existente
const existingStudentSchema = z.object({
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

type NewStudentFormValues = z.infer<typeof newStudentSchema>;
type ExistingStudentFormValues = z.infer<typeof existingStudentSchema>;

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

  // Form para aluno existente
  const existingStudentForm = useForm<ExistingStudentFormValues>({
    resolver: zodResolver(existingStudentSchema),
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

  const selectedEnrollmentTypeNew = newStudentForm.watch('enrollment_type');
  const selectedCourseIdNew = newStudentForm.watch('course_id');
  
  const selectedEnrollmentTypeExisting = existingStudentForm.watch('enrollment_type');
  const selectedCourseIdExisting = existingStudentForm.watch('course_id');

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

  // Fetch classes for selected course (existing student)
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

  // Submit para novo aluno de indicação
  const onSubmitNewStudent = async (values: NewStudentFormValues) => {
    setIsSubmitting(true);
    try {
      // 1. Criar o lead primeiro
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

      // 2. Criar um perfil básico para o aluno (precisamos de um user_id)
      // Por enquanto, vamos usar o lead_id como referência
      // NOTA: Em produção, o aluno precisaria criar uma conta

      toast.success('Lead de indicação criado!', {
        description: `${values.full_name} foi cadastrado como lead matriculado. Para completar a matrícula, o aluno precisa criar uma conta.`,
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

  // Submit para aluno existente
  const onSubmitExistingStudent = async (values: ExistingStudentFormValues) => {
    setIsSubmitting(true);
    try {
      const enrollmentData: Record<string, unknown> = {
        student_id: values.student_id,
        course_id: values.course_id,
        lead_id: values.lead_id || null,
        notes: values.notes || null,
        status: 'ativo' as const,
        progress_percentage: 0,
      };

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

      toast.success('Matrícula realizada!', {
        description: `${COURSE_WEEKS} aulas agendadas para o aluno`,
      });
      existingStudentForm.reset();
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
            Cadastre um novo aluno ou matricule um aluno existente
          </DialogDescription>
        </DialogHeader>

        <Tabs value={enrollmentSource} onValueChange={(v) => setEnrollmentSource(v as 'new' | 'existing')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Aluno (Indicação)
            </TabsTrigger>
            <TabsTrigger value="existing" className="gap-2">
              <Users className="h-4 w-4" />
              Aluno Existente
            </TabsTrigger>
          </TabsList>

          {/* TAB: Novo Aluno de Indicação */}
          <TabsContent value="new" className="mt-4">
            <Form {...newStudentForm}>
              <form onSubmit={newStudentForm.handleSubmit(onSubmitNewStudent)} className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Cadastre leads novos que vieram por indicação. Após o cadastro, o aluno precisa criar uma conta para finalizar a matrícula.
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

                <div className="grid grid-cols-2 gap-4">
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
                </div>

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

                {selectedCourseIdNew && classesNew && classesNew.length > 0 && (
                  <FormField
                    control={newStudentForm.control}
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
                            {classesNew.map((classItem) => (
                              <SelectItem key={classItem.id} value={classItem.id}>
                                {classItem.name} - {classItem.room} • {formatSchedule(classItem.schedule as Record<string, string>)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={newStudentForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Observações sobre o aluno..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Cadastrar Aluno'}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* TAB: Aluno Existente */}
          <TabsContent value="existing" className="mt-4">
            <Form {...existingStudentForm}>
              <form onSubmit={existingStudentForm.handleSubmit(onSubmitExistingStudent)} className="space-y-4">
                <FormField
                  control={existingStudentForm.control}
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={existingStudentForm.control}
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
                    control={existingStudentForm.control}
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

                {selectedEnrollmentTypeExisting === 'indicacao_influencia' && (
                  <FormField
                    control={existingStudentForm.control}
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

                {selectedEnrollmentTypeExisting === 'indicacao_aluno' && (
                  <FormField
                    control={existingStudentForm.control}
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
                  control={existingStudentForm.control}
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
                              {course.name} ({course.duration_hours || 1}h/aula)
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

                {selectedCourseIdExisting && classesExisting && classesExisting.length > 0 && (
                  <FormField
                    control={existingStudentForm.control}
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
                            {classesExisting.map((classItem) => (
                              <SelectItem key={classItem.id} value={classItem.id}>
                                {classItem.name} - {classItem.room} • {formatSchedule(classItem.schedule as Record<string, string>)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={existingStudentForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Observações sobre a matrícula..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Matricular'}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
