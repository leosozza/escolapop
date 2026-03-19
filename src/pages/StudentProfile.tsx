import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Save,
  MessageCircle,
  GraduationCap,
  Phone,
  User,
  Calendar,
  Award,
  Clock,
  Check,
  X,
  AlertCircle,
  FileText,
  Shield,
  Plus,
  BookOpen,
} from 'lucide-react';
import { ACADEMIC_STATUS_CONFIG, type AcademicStatus } from '@/types/database';
import { format, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { COURSE_WEEKS } from '@/lib/course-schedule-config';
import { openWhatsAppWeb } from '@/lib/whatsapp';
import { AddEnrollmentDialog } from '@/components/students/AddEnrollmentDialog';

const ENROLLMENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  modelo_agenciado_maxfama: { label: 'MaxFama', color: 'bg-purple-500 text-white' },
  modelo_agenciado_popschool: { label: 'Pop School', color: 'bg-blue-500 text-white' },
  indicacao_influencia: { label: 'Indicação Influência', color: 'bg-pink-500 text-white' },
  indicacao_aluno: { label: 'Indicação Aluno', color: 'bg-green-500 text-white' },
};

interface AttendanceRecord {
  lesson_number: number;
  status: 'presente' | 'falta' | 'justificado' | null;
  attendance_date: string | null;
}

export default function StudentProfile() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);

  const [editData, setEditData] = useState<{
    full_name: string;
    phone: string;
    guardian_name: string;
    notes: string;
  } | null>(null);

  const [selectedLesson, setSelectedLesson] = useState<{
    enrollmentId: string;
    classId: string;
    lessonNumber: number;
    attendanceDate: string;
  } | null>(null);

  // Fetch lead/student data
  const { data: student, isLoading } = useQuery({
    queryKey: ['student-profile', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();
      if (error) throw error;
      if (data && !editData) {
        setEditData({
          full_name: data.full_name,
          phone: data.phone,
          guardian_name: data.guardian_name || '',
          notes: data.notes || '',
        });
      }
      return data;
    },
    enabled: !!leadId,
  });

  // Fetch enrollments
  const { data: enrollments } = useQuery({
    queryKey: ['student-profile-enrollments', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          course:courses(*),
          class:classes(*, teacher:profiles!classes_teacher_id_fkey(full_name))
        `)
        .eq('lead_id', leadId)
        .order('enrolled_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  // Fetch attendance
  const { data: attendanceByEnrollment } = useQuery({
    queryKey: ['student-profile-attendance', leadId, enrollments?.map(e => e.id)],
    queryFn: async () => {
      if (!leadId || !enrollments?.length) return {};
      const result: Record<string, AttendanceRecord[]> = {};

      for (const enrollment of enrollments) {
        if (enrollment.class_id) {
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('attendance_date, status')
            .eq('student_id', leadId)
            .eq('class_id', enrollment.class_id)
            .order('attendance_date', { ascending: true });

          const classStartDate = enrollment.class?.start_date ? new Date(enrollment.class.start_date) : null;
          const records: AttendanceRecord[] = [];

          for (let i = 0; i < COURSE_WEEKS; i++) {
            const expectedDate = classStartDate ? addWeeks(classStartDate, i) : null;
            const existingAttendance = attendanceData?.find(
              a => expectedDate && format(new Date(a.attendance_date), 'yyyy-MM-dd') === format(expectedDate, 'yyyy-MM-dd')
            );
            records.push({
              lesson_number: i + 1,
              status: existingAttendance?.status as 'presente' | 'falta' | 'justificado' | null,
              attendance_date: expectedDate ? format(expectedDate, 'yyyy-MM-dd') : null,
            });
          }
          result[enrollment.id] = records;
        }
      }
      return result;
    },
    enabled: !!leadId && !!enrollments?.length,
  });

  // Fetch enrollment history
  const { data: history } = useQuery({
    queryKey: ['student-profile-history', leadId, enrollments?.map(e => e.id)],
    queryFn: async () => {
      if (!enrollments?.length) return [];
      const { data, error } = await supabase
        .from('enrollment_history')
        .select('*')
        .in('enrollment_id', enrollments.map(e => e.id))
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!enrollments?.length,
  });

  // Fetch available classes for enrollment
  const { data: availableClasses } = useQuery({
    queryKey: ['available-classes-for-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          course:courses(id, name),
          teacher:profiles!classes_teacher_id_fkey(full_name)
        `)
        .eq('is_active', true)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Save lead data
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!leadId || !editData) return;
      const { error } = await supabase
        .from('leads')
        .update({
          full_name: editData.full_name,
          phone: editData.phone,
          guardian_name: editData.guardian_name || null,
          notes: editData.notes || null,
        })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dados do aluno salvos!');
      queryClient.invalidateQueries({ queryKey: ['student-profile', leadId] });
    },
    onError: () => toast.error('Erro ao salvar dados'),
  });

  // Update enrollment status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ enrollmentId, status }: { enrollmentId: string; status: AcademicStatus }) => {
      const { error } = await supabase
        .from('enrollments')
        .update({ status })
        .eq('id', enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Status atualizado!');
      queryClient.invalidateQueries({ queryKey: ['student-profile-enrollments', leadId] });
      queryClient.invalidateQueries({ queryKey: ['student-profile-history', leadId] });
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  // Update enrollment notes/age
  const updateEnrollmentMutation = useMutation({
    mutationFn: async ({ enrollmentId, data }: { enrollmentId: string; data: { notes?: string; student_age?: number | null } }) => {
      const { error } = await supabase
        .from('enrollments')
        .update(data)
        .eq('id', enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Matrícula atualizada!');
      queryClient.invalidateQueries({ queryKey: ['student-profile-enrollments', leadId] });
    },
    onError: () => toast.error('Erro ao atualizar matrícula'),
  });

  // Mark attendance
  const markAttendanceMutation = useMutation({
    mutationFn: async ({ classId, attendanceDate, status }: { classId: string; attendanceDate: string; status: string }) => {
      const { error } = await supabase.from('attendance').upsert(
        { class_id: classId, student_id: leadId, attendance_date: attendanceDate, status },
        { onConflict: 'class_id,student_id,attendance_date' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Presença marcada!');
      queryClient.invalidateQueries({ queryKey: ['student-profile-attendance', leadId] });
    },
    onError: () => toast.error('Erro ao marcar presença'),
  });

  const handleCourseComplete = async (enrollment: any) => {
    try {
      await supabase
        .from('enrollments')
        .update({ status: 'concluido', completed_at: new Date().toISOString(), certificate_issued: false })
        .eq('id', enrollment.id);
      toast.success('Curso concluído! Redirecionando para certificados...');
      navigate('/certificates', {
        state: {
          studentName: student?.full_name,
          courseName: enrollment.course?.name,
          completionDate: enrollment.class?.end_date || new Date().toISOString(),
        },
      });
    } catch {
      toast.error('Erro ao marcar conclusão');
    }
  };

  const getStatusBadge = (status: AcademicStatus) => {
    const config = ACADEMIC_STATUS_CONFIG[status];
    if (!config) return <Badge variant="outline">{status}</Badge>;
    return <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>{config.label}</Badge>;
  };

  const handleLessonClick = (enrollmentId: string, classId: string, lesson: AttendanceRecord) => {
    if (!lesson.attendance_date) return;
    setSelectedLesson({ enrollmentId, classId, lessonNumber: lesson.lesson_number, attendanceDate: lesson.attendance_date });
  };

  const handleMarkAttendance = (status: 'presente' | 'falta' | 'justificado') => {
    if (!selectedLesson) return;
    markAttendanceMutation.mutate({ classId: selectedLesson.classId, attendanceDate: selectedLesson.attendanceDate, status });
    setSelectedLesson(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!student || !editData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Aluno não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/students')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Alunos
        </Button>
      </div>
    );
  }

  const certificateEnrollments = enrollments?.filter(e => e.certificate_issued) || [];
  const pendingCertificates = enrollments?.filter(e => e.status === 'concluido' && !e.certificate_issued) || [];

  // Active enrollments: those with a class and status ativo/em_curso
  const activeEnrollments = enrollments?.filter(e =>
    e.class_id && ['ativo', 'em_curso'].includes(e.status)
  ) || [];

  // Course history: enrollments that were actually attended or completed (have attendance records or are concluded/evasao/trancado)
  const courseHistory = enrollments?.filter(e => {
    const hasAttendance = attendanceByEnrollment?.[e.id]?.some(r => r.status !== null);
    const isFinished = ['concluido', 'evasao', 'trancado'].includes(e.status);
    return hasAttendance || isFinished;
  }) || [];

  // Enrollments without class (need to be assigned)
  const unassignedEnrollments = enrollments?.filter(e =>
    !e.class_id && ['ativo'].includes(e.status)
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/students')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => openWhatsAppWeb(student.phone, `Olá ${student.full_name}!`)}
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          WhatsApp
        </Button>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-1" />
          Salvar Alterações
        </Button>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-xl">{student.full_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {enrollments?.length || 0} matrícula(s) • Desde {format(new Date(student.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                value={editData.full_name}
                onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3 text-green-500" />
                Telefone (WhatsApp)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => openWhatsAppWeb(editData.phone, `Olá ${editData.full_name}!`)}
                  title="Abrir WhatsApp"
                >
                  <MessageCircle className="h-4 w-4 text-green-500" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Este número será usado para contato via WhatsApp</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardian_name">
                <Shield className="h-3 w-3 inline mr-1" />
                Responsável
              </Label>
              <Input
                id="guardian_name"
                value={editData.guardian_name}
                onChange={(e) => setEditData({ ...editData, guardian_name: e.target.value })}
                placeholder="Nome do responsável (se menor)"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Observações Gerais</Label>
              <Textarea
                id="notes"
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                placeholder="Observações sobre o aluno..."
                rows={3}
              />
            </div>
          </div>

          {/* Matricular Aluno button below notes */}
          <div className="mt-4">
            <Button onClick={() => setIsEnrollDialogOpen(true)} className="w-full gap-2" variant="outline">
              <Plus className="h-4 w-4" />
              Matricular Aluno em Novo Curso
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Unassigned enrollments warning */}
      {unassignedEnrollments.length > 0 && (
        <Card className="border-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              Matrículas sem Turma ({unassignedEnrollments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              O aluno precisa estar em uma turma para iniciar o curso.
            </p>
            {unassignedEnrollments.map((enrollment: any) => (
              <div key={enrollment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div>
                  <p className="font-medium text-sm">{enrollment.course?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Matriculado em {format(new Date(enrollment.enrolled_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                {getStatusBadge(enrollment.status as AcademicStatus)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active Enrollments with attendance */}
      {activeEnrollments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Cursos em Andamento ({activeEnrollments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeEnrollments.map((enrollment: any) => {
              const attendanceRecords = attendanceByEnrollment?.[enrollment.id] || [];
              const presentCount = attendanceRecords.filter(r => r.status === 'presente').length;
              const isComplete = presentCount >= COURSE_WEEKS;
              const progressPercent = Math.round((presentCount / COURSE_WEEKS) * 100);

              return (
                <Card key={enrollment.id} className="border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{enrollment.course?.name}</CardTitle>
                        {getStatusBadge(enrollment.status as AcademicStatus)}
                      </div>
                      <div className="flex items-center gap-2">
                        {enrollment.enrollment_type && ENROLLMENT_TYPE_CONFIG[enrollment.enrollment_type] && (
                          <Badge className={`${ENROLLMENT_TYPE_CONFIG[enrollment.enrollment_type].color} border-0 text-xs`}>
                            {ENROLLMENT_TYPE_CONFIG[enrollment.enrollment_type].label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {enrollment.referral_agent_code && (
                      <p className="text-xs text-muted-foreground">
                        <User className="h-3 w-3 inline mr-1" />
                        Código: {enrollment.referral_agent_code}
                        {enrollment.influencer_name && ` • Indicação: ${enrollment.influencer_name}`}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {enrollment.class && (
                      <div className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                        <span>Turma: {enrollment.class.name}</span>
                        {enrollment.class.teacher && <span>Prof. {enrollment.class.teacher.full_name}</span>}
                        <span>Início: {format(new Date(enrollment.class.start_date), 'dd/MM/yyyy')}</span>
                        {enrollment.class.end_date && <span>Fim: {format(new Date(enrollment.class.end_date), 'dd/MM/yyyy')}</span>}
                      </div>
                    )}

                    <Separator />

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">{presentCount}/{COURSE_WEEKS} aulas ({progressPercent}%)</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    {/* Attendance grid */}
                    <TooltipProvider>
                      <div className="flex gap-1">
                        {attendanceRecords.map((record, i) => (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <button
                                className={`h-10 flex-1 rounded-sm transition-all flex items-center justify-center text-xs font-medium cursor-pointer
                                  ${record.status === 'presente'
                                    ? 'bg-success text-success-foreground'
                                    : record.status === 'falta'
                                      ? 'bg-destructive text-destructive-foreground'
                                      : record.status === 'justificado'
                                        ? 'bg-warning text-warning-foreground'
                                        : 'bg-muted hover:bg-muted/80'
                                  }`}
                                onClick={() => enrollment.class_id && handleLessonClick(enrollment.id, enrollment.class_id, record)}
                                disabled={!record.attendance_date}
                              >
                                {record.lesson_number}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Aula {record.lesson_number}</p>
                              {record.attendance_date && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(record.attendance_date), 'dd/MM/yyyy')}
                                </p>
                              )}
                              <p className="text-xs">
                                {record.status === 'presente' ? '✓ Presente'
                                  : record.status === 'falta' ? '✗ Falta'
                                  : record.status === 'justificado' ? '! Justificado'
                                  : 'Clique para marcar'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>

                    {/* Attendance marking */}
                    {selectedLesson && selectedLesson.enrollmentId === enrollment.id && (
                      <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                        <p className="text-sm font-medium">Marcar presença - Aula {selectedLesson.lessonNumber}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleMarkAttendance('presente')}>
                            <Check className="h-4 w-4 mr-1" /> Presente
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleMarkAttendance('justificado')}>
                            <AlertCircle className="h-4 w-4 mr-1" /> Justificado
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Falta é registrada automaticamente quando a data da aula passa sem presença.</p>
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedLesson(null)}>
                          Cancelar
                        </Button>
                      </div>
                    )}

                    {/* Complete course button */}
                    {isComplete && enrollment.status !== 'concluido' && (
                      <Button className="w-full gap-2 bg-success hover:bg-success/90" onClick={() => handleCourseComplete(enrollment)}>
                        <Award className="h-4 w-4" /> Concluir Curso e Emitir Certificado
                      </Button>
                    )}

                    {/* Enrollment editable fields */}
                    <Separator />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select
                          value={enrollment.status}
                          onValueChange={(value) => updateStatusMutation.mutate({ enrollmentId: enrollment.id, status: value as AcademicStatus })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ACADEMIC_STATUS_CONFIG).map(([key, config]) => (
                              <SelectItem key={key} value={key}>{config.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Idade</Label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          defaultValue={enrollment.student_age || ''}
                          onBlur={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : null;
                            if (val !== enrollment.student_age) {
                              updateEnrollmentMutation.mutate({ enrollmentId: enrollment.id, data: { student_age: val } });
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Matrícula</Label>
                        <p className="text-xs text-muted-foreground pt-1">
                          {format(new Date(enrollment.enrolled_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Observações da Matrícula</Label>
                      <Textarea
                        className="text-xs min-h-[60px]"
                        defaultValue={enrollment.notes || ''}
                        placeholder="Observações específicas desta matrícula..."
                        onBlur={(e) => {
                          if (e.target.value !== (enrollment.notes || '')) {
                            updateEnrollmentMutation.mutate({ enrollmentId: enrollment.id, data: { notes: e.target.value || undefined } });
                          }
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Course History - only courses that were actually attended/completed */}
      {courseHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Histórico de Cursos ({courseHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {courseHistory.map((enrollment: any) => {
              const attendanceRecords = attendanceByEnrollment?.[enrollment.id] || [];
              const presentCount = attendanceRecords.filter(r => r.status === 'presente').length;
              const totalMarked = attendanceRecords.filter(r => r.status !== null).length;
              const progressPercent = Math.round((presentCount / COURSE_WEEKS) * 100);

              return (
                <div key={enrollment.id} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-medium">{enrollment.course?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.class?.name && `Turma: ${enrollment.class.name} • `}
                        {enrollment.class?.start_date && `${format(new Date(enrollment.class.start_date), 'dd/MM/yyyy')}`}
                        {enrollment.class?.end_date && ` a ${format(new Date(enrollment.class.end_date), 'dd/MM/yyyy')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(enrollment.status as AcademicStatus)}
                      {enrollment.certificate_issued && (
                        <Badge className="bg-success text-success-foreground border-0 text-xs gap-1">
                          <Award className="h-3 w-3" />
                          Certificado
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Conclusão</span>
                      <span className="font-medium">{progressPercent}% ({presentCount}/{COURSE_WEEKS} aulas)</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>

                  <div className="flex gap-0.5">
                    {attendanceRecords.map((record, i) => (
                      <div
                        key={i}
                        className={`h-4 flex-1 rounded-sm ${
                          record.status === 'presente'
                            ? 'bg-success'
                            : record.status === 'falta'
                              ? 'bg-destructive'
                              : record.status === 'justificado'
                                ? 'bg-warning'
                                : 'bg-muted'
                        }`}
                        title={`Aula ${record.lesson_number}: ${record.status || 'sem registro'}`}
                      />
                    ))}
                  </div>

                  {enrollment.status === 'concluido' && !enrollment.certificate_issued && (
                    <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => navigate('/certificates', {
                      state: { studentName: student?.full_name, courseName: enrollment.course?.name, completionDate: enrollment.completed_at || enrollment.class?.end_date }
                    })}>
                      <FileText className="h-3 w-3" /> Emitir Certificado
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Certificates Section */}
      {(certificateEnrollments.length > 0 || pendingCertificates.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Certificados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {certificateEnrollments.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                <div>
                  <p className="font-medium text-sm">{e.course?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Emitido em {e.certificate_issued_at ? format(new Date(e.certificate_issued_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                  </p>
                </div>
                <Badge className="bg-success text-success-foreground border-0">
                  <Check className="h-3 w-3 mr-1" /> Emitido
                </Badge>
              </div>
            ))}
            {pendingCertificates.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                <div>
                  <p className="font-medium text-sm">{e.course?.name}</p>
                  <p className="text-xs text-muted-foreground">Concluído - Certificado pendente</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/certificates', {
                  state: { studentName: student?.full_name, courseName: e.course?.name, completionDate: e.completed_at }
                })}>
                  <FileText className="h-3 w-3 mr-1" /> Emitir
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!history?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum histórico encontrado</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const enrollment = enrollments?.find(e => e.id === item.enrollment_id);
                return (
                  <div key={item.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">
                        {item.from_status ? (
                          <>
                            {ACADEMIC_STATUS_CONFIG[item.from_status as AcademicStatus]?.label || item.from_status}
                            {' → '}
                            {ACADEMIC_STATUS_CONFIG[item.to_status as AcademicStatus]?.label || item.to_status}
                          </>
                        ) : (
                          <>Iniciado como {ACADEMIC_STATUS_CONFIG[item.to_status as AcademicStatus]?.label || item.to_status}</>
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        {enrollment?.course?.name && <span className="mr-2">({enrollment.course.name})</span>}
                        {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {item.notes && <p className="mt-1 text-muted-foreground italic">{item.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddEnrollmentDialog
        open={isEnrollDialogOpen}
        onOpenChange={setIsEnrollDialogOpen}
        preSelectedLeadId={leadId}
        onSuccess={() => {
          setIsEnrollDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['student-profile-enrollments', leadId] });
        }}
      />
    </div>
  );
}
