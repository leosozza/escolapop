import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  GraduationCap,
  Phone,
  Mail,
  Calendar,
  Award,
  Clock,
  MessageCircle,
  Check,
  X,
  AlertCircle,
  User,
  FileText,
} from 'lucide-react';
import { ACADEMIC_STATUS_CONFIG, type AcademicStatus } from '@/types/database';
import { format, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { COURSE_WEEKS } from '@/lib/course-schedule-config';

interface StudentDetailsSheetProps {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

interface AttendanceRecord {
  lesson_number: number;
  status: 'presente' | 'falta' | 'justificado' | null;
  attendance_date: string | null;
}

export function StudentDetailsSheet({ studentId, open, onOpenChange, onUpdate }: StudentDetailsSheetProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch lead data
  const { data: student } = useQuery({
    queryKey: ['student-lead', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', studentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && open,
  });

  // Fetch student's enrollments with class info
  const { data: enrollments } = useQuery({
    queryKey: ['student-enrollments-lead', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          course:courses(*),
          class:classes(*, teacher:profiles!classes_teacher_id_fkey(full_name))
        `)
        .eq('lead_id', studentId)
        .order('enrolled_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && open,
  });

  // Fetch attendance records by enrollment
  const { data: attendanceByEnrollment } = useQuery({
    queryKey: ['attendance-by-enrollment', studentId, enrollments],
    queryFn: async () => {
      if (!studentId || !enrollments?.length) return {};
      const result: Record<string, AttendanceRecord[]> = {};
      
      for (const enrollment of enrollments) {
        if (enrollment.class_id) {
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('attendance_date, status')
            .eq('student_id', studentId)
            .eq('class_id', enrollment.class_id)
            .order('attendance_date', { ascending: true });

          // Build array for 8 lessons based on class start date
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
    enabled: !!studentId && !!enrollments?.length && open,
  });

  // Fetch enrollment history
  const { data: history } = useQuery({
    queryKey: ['enrollment-history-lead', studentId],
    queryFn: async () => {
      if (!studentId || !enrollments?.length) return [];
      const enrollmentIds = enrollments.map(e => e.id);
      const { data, error } = await supabase
        .from('enrollment_history')
        .select('*')
        .in('enrollment_id', enrollmentIds)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && !!enrollments?.length && open,
  });

  // Mark attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: async ({
      classId,
      attendanceDate,
      status,
    }: {
      classId: string;
      attendanceDate: string;
      status: 'presente' | 'falta' | 'justificado';
    }) => {
      const { error } = await supabase.from('attendance').upsert(
        {
          class_id: classId,
          student_id: studentId,
          attendance_date: attendanceDate,
          status,
        },
        {
          onConflict: 'class_id,student_id,attendance_date',
        }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Presença marcada!');
      queryClient.invalidateQueries({ queryKey: ['attendance-by-enrollment', studentId] });
      onUpdate();
    },
    onError: () => {
      toast.error('Erro ao marcar presença');
    },
  });

  // Update enrollment status mutation
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
      queryClient.invalidateQueries({ queryKey: ['student-enrollments-lead', studentId] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-history-lead', studentId] });
      onUpdate();
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  // Mark as completed and go to certificates
  const handleCourseComplete = async (enrollment: any) => {
    try {
      await supabase
        .from('enrollments')
        .update({ 
          status: 'concluido',
          completed_at: new Date().toISOString(),
          certificate_issued: false 
        })
        .eq('id', enrollment.id);

      toast.success('Curso concluído! Redirecionando para certificados...');
      onOpenChange(false);
      
      // Navigate to certificates with pre-filled data
      navigate('/certificates', { 
        state: { 
          studentName: student?.full_name,
          courseName: enrollment.course?.name,
          completionDate: enrollment.class?.end_date || new Date().toISOString()
        } 
      });
    } catch (error) {
      toast.error('Erro ao marcar conclusão');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: AcademicStatus) => {
    const config = ACADEMIC_STATUS_CONFIG[status];
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
        {config.label}
      </Badge>
    );
  };

  const openWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${name}! Entramos em contato sobre suas aulas na escola.`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
  };

  const [selectedLesson, setSelectedLesson] = useState<{
    enrollmentId: string;
    classId: string;
    lessonNumber: number;
    attendanceDate: string;
  } | null>(null);

  const handleLessonClick = (enrollmentId: string, classId: string, lesson: AttendanceRecord) => {
    if (!lesson.attendance_date) return;
    setSelectedLesson({
      enrollmentId,
      classId,
      lessonNumber: lesson.lesson_number,
      attendanceDate: lesson.attendance_date,
    });
  };

  const handleMarkAttendance = (status: 'presente' | 'falta' | 'justificado') => {
    if (!selectedLesson) return;
    markAttendanceMutation.mutate({
      classId: selectedLesson.classId,
      attendanceDate: selectedLesson.attendanceDate,
      status,
    });
    setSelectedLesson(null);
  };

  if (!student) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-gradient-primary text-white">
                {getInitials(student.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-xl">{student.full_name}</SheetTitle>
              <div className="flex flex-col gap-1 mt-1 text-sm text-muted-foreground">
                {student.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {student.phone}
                  </span>
                )}
                {student.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {student.email}
                  </span>
                )}
              </div>
            </div>
            {student.phone && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openWhatsApp(student.phone, student.full_name)}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                WhatsApp
              </Button>
            )}
          </div>
        </SheetHeader>

        <Separator className="my-6" />

        {/* Enrollments */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Matrículas ({enrollments?.length || 0})
          </h3>

          {enrollments?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma matrícula encontrada</p>
          ) : (
            <div className="space-y-3">
              {enrollments?.map((enrollment: any) => {
                const attendanceRecords = attendanceByEnrollment?.[enrollment.id] || [];
                const presentCount = attendanceRecords.filter(r => r.status === 'presente').length;
                const isComplete = presentCount >= COURSE_WEEKS;
                
                return (
                  <Card key={enrollment.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{enrollment.course?.name}</CardTitle>
                        {getStatusBadge(enrollment.status as AcademicStatus)}
                      </div>
                      {enrollment.referral_agent_code && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Código: {enrollment.referral_agent_code}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Class info */}
                      {enrollment.class && (
                        <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                          <span>Turma: {enrollment.class.name}</span>
                          {enrollment.class.teacher && (
                            <span>Professor: {enrollment.class.teacher.full_name}</span>
                          )}
                          <span>Início: {format(new Date(enrollment.class.start_date), 'dd/MM/yyyy')}</span>
                          {enrollment.class.end_date && (
                            <span>Fim: {format(new Date(enrollment.class.end_date), 'dd/MM/yyyy')}</span>
                          )}
                        </div>
                      )}

                      <Separator className="my-2" />

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Aulas Concluídas</span>
                        <span className="font-medium">{presentCount}/{COURSE_WEEKS}</span>
                      </div>
                      
                      {/* Clickable attendance blocks */}
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

                      {/* Attendance marking dialog */}
                      {selectedLesson && selectedLesson.enrollmentId === enrollment.id && (
                        <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                          <p className="text-sm font-medium">
                            Marcar presença - Aula {selectedLesson.lessonNumber}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 hover:bg-success/10 hover:border-success hover:text-success"
                              onClick={() => handleMarkAttendance('presente')}
                              disabled={markAttendanceMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Presente
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                              onClick={() => handleMarkAttendance('falta')}
                              disabled={markAttendanceMutation.isPending}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Falta
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 hover:bg-warning/10 hover:border-warning hover:text-warning"
                              onClick={() => handleMarkAttendance('justificado')}
                              disabled={markAttendanceMutation.isPending}
                            >
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Just.
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => setSelectedLesson(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}

                      {/* Certificate button when all 8 lessons complete */}
                      {isComplete && enrollment.status !== 'concluido' && (
                        <Button
                          className="w-full gap-2 bg-success hover:bg-success/90"
                          onClick={() => handleCourseComplete(enrollment)}
                        >
                          <Award className="h-4 w-4" />
                          Concluir Curso e Emitir Certificado
                        </Button>
                      )}

                      {enrollment.status === 'concluido' && !enrollment.certificate_issued && (
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => {
                            onOpenChange(false);
                            navigate('/certificates', { 
                              state: { 
                                studentName: student?.full_name,
                                courseName: enrollment.course?.name,
                                completionDate: enrollment.completed_at || enrollment.class?.end_date
                              } 
                            });
                          }}
                        >
                          <FileText className="h-4 w-4" />
                          Ir para Emissão de Certificado
                        </Button>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Matrícula: {format(new Date(enrollment.enrolled_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                        {enrollment.grade && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Award className="h-3 w-3" />
                            Nota: {enrollment.grade}
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        <Select
                          value={enrollment.status}
                          onValueChange={(value) => 
                            updateStatusMutation.mutate({ 
                              enrollmentId: enrollment.id, 
                              status: value as AcademicStatus 
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Alterar status" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ACADEMIC_STATUS_CONFIG).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* History Timeline */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico de Alterações
          </h3>

          {history?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum histórico encontrado</p>
          ) : (
            <div className="space-y-3">
              {history?.map((item) => (
                <div key={item.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
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
                      {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {item.notes && (
                      <p className="mt-1 text-muted-foreground">{item.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
