import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  MessageCircle,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Calendar,
  Clock,
} from 'lucide-react';
import { COURSE_WEEKS, calculateClassDates } from '@/lib/course-schedule-config';
import { ACADEMIC_STATUS_CONFIG, type AcademicStatus } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ClassInfo {
  id: string;
  name: string;
  start_date: string;
  schedule: Record<string, string> | null;
  course?: { name: string };
}

interface StudentEnrollment {
  id: string;
  enrollment_id: string;
  student_id: string;
  student_name: string;
  phone: string | null;
  enrollment_status: AcademicStatus;
  attendance_records: Map<string, 'presente' | 'falta' | 'justificado'>;
  absence_count: number;
  presence_count: number;
}

interface ClassStudentsListProps {
  classInfo: ClassInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function ClassStudentsList({ classInfo, open, onOpenChange, onUpdate }: ClassStudentsListProps) {
  const [students, setStudents] = useState<StudentEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [classDates, setClassDates] = useState<Date[]>([]);

  useEffect(() => {
    if (open && classInfo) {
      fetchStudentsAndAttendance();
      calculateDates();
    }
  }, [open, classInfo]);

  const calculateDates = () => {
    if (!classInfo?.start_date || !classInfo?.schedule) return;
    
    const dayOfWeek = Object.keys(classInfo.schedule)[0];
    const dates = calculateClassDates(new Date(classInfo.start_date), dayOfWeek);
    setClassDates(dates);
  };

  const fetchStudentsAndAttendance = async () => {
    if (!classInfo) return;
    
    setIsLoading(true);
    try {
      // Fetch students enrolled in this class
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('class_enrollments')
        .select(`
          id,
          enrollment_id,
          enrollment:enrollments(
            id,
            student_id,
            status,
            student:profiles!enrollments_student_id_fkey(user_id, full_name, phone)
          )
        `)
        .eq('class_id', classInfo.id);

      if (enrollmentError) throw enrollmentError;

      // Fetch all attendance for this class
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, attendance_date, status')
        .eq('class_id', classInfo.id);

      if (attendanceError) throw attendanceError;

      // Build attendance maps per student
      const attendanceByStudent = new Map<string, Map<string, 'presente' | 'falta' | 'justificado'>>();
      (attendanceData || []).forEach((a: any) => {
        if (!attendanceByStudent.has(a.student_id)) {
          attendanceByStudent.set(a.student_id, new Map());
        }
        attendanceByStudent.get(a.student_id)?.set(a.attendance_date, a.status);
      });

      // Map students with their attendance data
      const studentList: StudentEnrollment[] = (enrollmentData || [])
        .filter((e: any) => e.enrollment?.student?.user_id)
        .map((e: any) => {
          const studentId = e.enrollment.student.user_id;
          const records = attendanceByStudent.get(studentId) || new Map();
          const absenceCount = Array.from(records.values()).filter(s => s === 'falta').length;
          const presenceCount = Array.from(records.values()).filter(s => s === 'presente').length;
          
          return {
            id: e.id,
            enrollment_id: e.enrollment.id,
            student_id: studentId,
            student_name: e.enrollment.student.full_name,
            phone: e.enrollment.student.phone,
            enrollment_status: e.enrollment.status as AcademicStatus,
            attendance_records: records,
            absence_count: absenceCount,
            presence_count: presenceCount,
          };
        });

      setStudents(studentList);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Erro ao carregar alunos');
    } finally {
      setIsLoading(false);
    }
  };

  const markAttendance = async (
    studentId: string, 
    enrollmentId: string,
    date: Date, 
    status: 'presente' | 'falta' | 'justificado'
  ) => {
    if (!classInfo) return;
    
    setIsSaving(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Upsert attendance
      const { error: attendanceError } = await supabase
        .from('attendance')
        .upsert({
          class_id: classInfo.id,
          student_id: studentId,
          attendance_date: dateStr,
          status,
        }, {
          onConflict: 'class_id,student_id,attendance_date',
        });

      if (attendanceError) throw attendanceError;

      // Update local state
      setStudents(prev => prev.map(s => {
        if (s.student_id !== studentId) return s;
        
        const newRecords = new Map(s.attendance_records);
        newRecords.set(dateStr, status);
        
        const absenceCount = Array.from(newRecords.values()).filter(s => s === 'falta').length;
        const presenceCount = Array.from(newRecords.values()).filter(s => s === 'presente').length;
        
        return {
          ...s,
          attendance_records: newRecords,
          absence_count: absenceCount,
          presence_count: presenceCount,
        };
      }));

      // Check for automatic status changes
      await checkAndUpdateEnrollmentStatus(studentId, enrollmentId, status);

      toast.success('Presença registrada!');
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast.error('Erro ao registrar presença');
    } finally {
      setIsSaving(false);
    }
  };

  const checkAndUpdateEnrollmentStatus = async (
    studentId: string, 
    enrollmentId: string, 
    newStatus: 'presente' | 'falta' | 'justificado'
  ) => {
    const student = students.find(s => s.student_id === studentId);
    if (!student) return;

    // Calculate new counts including the just-marked attendance
    const newAbsenceCount = student.absence_count + (newStatus === 'falta' ? 1 : 0);
    const newPresenceCount = student.presence_count + (newStatus === 'presente' ? 1 : 0);

    let newEnrollmentStatus: AcademicStatus | null = null;

    // Rule: First presence marks student as "em_curso"
    if (newPresenceCount >= 1 && student.enrollment_status === 'ativo') {
      newEnrollmentStatus = 'em_curso';
    }

    // Rule: 3 absences marks as "evasão"
    if (newAbsenceCount >= 3) {
      newEnrollmentStatus = 'evasao';
    }

    if (newEnrollmentStatus && newEnrollmentStatus !== student.enrollment_status) {
      const { error } = await supabase
        .from('enrollments')
        .update({ status: newEnrollmentStatus })
        .eq('id', enrollmentId);

      if (error) {
        console.error('Error updating enrollment status:', error);
      } else {
        // Update local state
        setStudents(prev => prev.map(s => 
          s.student_id === studentId 
            ? { ...s, enrollment_status: newEnrollmentStatus! }
            : s
        ));
        
        if (newEnrollmentStatus === 'evasao') {
          toast.warning(`${student.student_name} marcado como Evasão (3 faltas)`);
        } else if (newEnrollmentStatus === 'em_curso') {
          toast.success(`${student.student_name} agora está Em Curso`);
        }
      }
    }

    onUpdate?.();
  };

  const openWhatsApp = (phone: string | null, studentName: string) => {
    if (!phone) {
      toast.error('Telefone não cadastrado');
      return;
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá ${studentName}! Entramos em contato sobre suas aulas na ${classInfo?.course?.name || 'escola'}.`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getSessionNumber = (date: Date) => {
    const index = classDates.findIndex(d => 
      format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
    return index + 1;
  };

  const getStatusBadge = (status: AcademicStatus) => {
    const config = ACADEMIC_STATUS_CONFIG[status];
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
        {config.label}
      </Badge>
    );
  };

  if (!classInfo) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {classInfo.name}
          </SheetTitle>
          <SheetDescription>
            {classInfo.course?.name} • {students.length} alunos matriculados
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Users className="h-12 w-12 opacity-50 mb-2" />
            <p>Nenhum aluno matriculado nesta turma</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-6">
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-success" />
                  <span>Presente</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-destructive" />
                  <span>Falta</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-warning" />
                  <span>Justificado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-muted border" />
                  <span>Pendente</span>
                </div>
              </div>

              {/* Students with absence warning first */}
              {students
                .sort((a, b) => {
                  // Students with 1-2 absences come first (warning zone)
                  const aWarning = a.absence_count >= 1 && a.absence_count < 3;
                  const bWarning = b.absence_count >= 1 && b.absence_count < 3;
                  if (aWarning && !bWarning) return -1;
                  if (!aWarning && bWarning) return 1;
                  return a.student_name.localeCompare(b.student_name);
                })
                .map((student) => (
                  <Card 
                    key={student.id} 
                    className={cn(
                      "border shadow-sm",
                      student.absence_count >= 1 && student.absence_count < 3 && "border-warning/50 bg-warning/5",
                      student.absence_count >= 3 && "border-destructive/50 bg-destructive/5"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Student info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-gradient-primary text-white text-sm">
                              {getInitials(student.student_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{student.student_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(student.enrollment_status)}
                              {student.absence_count >= 1 && student.absence_count < 3 && (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-0 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {student.absence_count} falta{student.absence_count > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openWhatsApp(student.phone, student.student_name)}
                          className="shrink-0"
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Mensagem
                        </Button>
                      </div>

                      {/* Session attendance blocks */}
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Aulas (clique para marcar presença)
                        </p>
                        <TooltipProvider>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {classDates.map((date, index) => {
                              const dateStr = format(date, 'yyyy-MM-dd');
                              const status = student.attendance_records.get(dateStr);
                              const isPast = date <= new Date();
                              
                              return (
                                <Tooltip key={dateStr}>
                                  <TooltipTrigger asChild>
                                    <button
                                      disabled={isSaving}
                                      onClick={() => {
                                        // Cycle through statuses: none -> presente -> falta -> justificado -> none
                                        const nextStatus = 
                                          !status ? 'presente' :
                                          status === 'presente' ? 'falta' :
                                          status === 'falta' ? 'justificado' : 'presente';
                                        markAttendance(student.student_id, student.enrollment_id, date, nextStatus);
                                      }}
                                      className={cn(
                                        "h-8 w-8 rounded-md flex items-center justify-center text-xs font-medium transition-all",
                                        "hover:ring-2 hover:ring-primary/50",
                                        !status && isPast && "bg-muted border border-dashed border-muted-foreground/30",
                                        !status && !isPast && "bg-muted/50 border border-dashed border-muted-foreground/20",
                                        status === 'presente' && "bg-success text-white",
                                        status === 'falta' && "bg-destructive text-white",
                                        status === 'justificado' && "bg-warning text-white",
                                      )}
                                    >
                                      {status === 'presente' && <Check className="h-4 w-4" />}
                                      {status === 'falta' && <X className="h-4 w-4" />}
                                      {status === 'justificado' && <AlertTriangle className="h-3 w-3" />}
                                      {!status && (index + 1)}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">Aula {index + 1}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(date, "EEEE, dd/MM", { locale: ptBR })}
                                    </p>
                                    {status && (
                                      <p className="text-xs mt-1">
                                        Status: {status === 'presente' ? 'Presente' : status === 'falta' ? 'Falta' : 'Justificado'}
                                      </p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </TooltipProvider>
                      </div>

                      {/* Progress summary */}
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-success" />
                          {student.presence_count} presenças
                        </span>
                        <span className="flex items-center gap-1">
                          <X className="h-3 w-3 text-destructive" />
                          {student.absence_count} faltas
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {COURSE_WEEKS - student.presence_count - student.absence_count} pendentes
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
