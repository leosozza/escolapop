import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, Check, X, AlertCircle, MessageCircle, User, GraduationCap } from 'lucide-react';
import { format, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { COURSE_WEEKS } from '@/lib/course-schedule-config';
import { ACADEMIC_STATUS_CONFIG, type AcademicStatus } from '@/types/database';
import { openWhatsAppWeb } from '@/lib/whatsapp';

interface AttendanceRecord {
  lesson_number: number;
  status: 'presente' | 'falta' | 'justificado' | null;
  attendance_date: string | null;
}

export default function QuickAttendance() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<{
    enrollmentId: string;
    classId: string;
    lessonNumber: number;
    attendanceDate: string;
    leadId: string;
  } | null>(null);

  // Search enrollments by code or name
  const { data: results, isLoading } = useQuery({
    queryKey: ['quick-attendance-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      const isCode = /^\d{6,8}$/.test(searchQuery);

      let query = supabase
        .from('enrollments')
        .select(`
          id, status, referral_agent_code, class_id, enrolled_at, student_age,
          course:courses(id, name),
          class:classes(id, name, room, start_date, schedule),
          lead:leads!enrollments_lead_id_fkey(id, full_name, phone, guardian_name)
        `)
        .in('status', ['ativo', 'em_curso']);

      if (isCode) {
        query = query.eq('referral_agent_code', searchQuery);
      } else {
        // Search by lead name - need to filter after
        const { data: leads } = await supabase
          .from('leads')
          .select('id')
          .ilike('full_name', `%${searchQuery}%`)
          .limit(20);

        if (!leads?.length) return [];
        query = query.in('lead_id', leads.map(l => l.id));
      }

      const { data, error } = await query.order('enrolled_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  // Fetch attendance for found enrollments
  const enrollmentIds = results?.map(r => r.id) || [];
  const { data: attendanceMap } = useQuery({
    queryKey: ['quick-attendance-records', enrollmentIds],
    queryFn: async () => {
      if (!results?.length) return {};
      const result: Record<string, AttendanceRecord[]> = {};

      for (const enrollment of results) {
        if (!enrollment.class_id || !enrollment.lead) continue;
        const leadData = enrollment.lead as any;

        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('attendance_date, status')
          .eq('student_id', leadData.id)
          .eq('class_id', enrollment.class_id)
          .order('attendance_date', { ascending: true });

        const classStartDate = enrollment.class ? new Date((enrollment.class as any).start_date) : null;
        const records: AttendanceRecord[] = [];

        for (let i = 0; i < COURSE_WEEKS; i++) {
          const expectedDate = classStartDate ? addWeeks(classStartDate, i) : null;
          const existing = attendanceData?.find(
            a => expectedDate && format(new Date(a.attendance_date), 'yyyy-MM-dd') === format(expectedDate, 'yyyy-MM-dd')
          );
          records.push({
            lesson_number: i + 1,
            status: existing?.status as 'presente' | 'falta' | 'justificado' | null,
            attendance_date: expectedDate ? format(expectedDate, 'yyyy-MM-dd') : null,
          });
        }
        result[enrollment.id] = records;
      }
      return result;
    },
    enabled: !!results?.length,
  });

  // Mark attendance
  const markAttendanceMutation = useMutation({
    mutationFn: async ({ classId, studentId, attendanceDate, status }: { classId: string; studentId: string; attendanceDate: string; status: string }) => {
      const { error } = await supabase.from('attendance').upsert(
        { class_id: classId, student_id: studentId, attendance_date: attendanceDate, status },
        { onConflict: 'class_id,student_id,attendance_date' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Presença marcada!');
      queryClient.invalidateQueries({ queryKey: ['quick-attendance-records'] });
      setSelectedLesson(null);
    },
    onError: () => toast.error('Erro ao marcar presença'),
  });

  const handleSearch = () => {
    setSearchQuery(searchTerm.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleLessonClick = (enrollmentId: string, classId: string, leadId: string, lesson: AttendanceRecord) => {
    if (!lesson.attendance_date) return;
    setSelectedLesson({ enrollmentId, classId, lessonNumber: lesson.lesson_number, attendanceDate: lesson.attendance_date, leadId });
  };

  const handleMarkAttendance = (status: 'presente' | 'falta' | 'justificado') => {
    if (!selectedLesson) return;
    markAttendanceMutation.mutate({
      classId: selectedLesson.classId,
      studentId: selectedLesson.leadId,
      attendanceDate: selectedLesson.attendanceDate,
      status,
    });
  };

  // Group enrollments by lead
  const groupedByLead = results?.reduce((acc, enrollment) => {
    const lead = enrollment.lead as any;
    if (!lead) return acc;
    if (!acc[lead.id]) acc[lead.id] = { lead, enrollments: [] };
    acc[lead.id].enrollments.push(enrollment);
    return acc;
  }, {} as Record<string, { lead: any; enrollments: typeof results }>) || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Presença Rápida</h1>
        <p className="text-muted-foreground">Busque pelo código MaxFama (6-8 dígitos) ou nome do aluno</p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Código MaxFama ou nome do aluno..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10 h-12 text-lg"
                autoFocus
              />
            </div>
            <Button onClick={handleSearch} size="lg" className="h-12 px-8">
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && (
        <p className="text-center text-muted-foreground py-8">Buscando...</p>
      )}

      {searchQuery && !isLoading && Object.keys(groupedByLead).length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Nenhum aluno encontrado para "{searchQuery}"</p>
          </CardContent>
        </Card>
      )}

      {Object.values(groupedByLead).map(({ lead, enrollments: studentEnrollments }) => (
        <Card key={lead.id}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{lead.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{lead.phone}</p>
                  {lead.guardian_name && (
                    <p className="text-xs text-muted-foreground">Responsável: {lead.guardian_name}</p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => openWhatsAppWeb(lead.phone, `Olá ${lead.full_name}!`)}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentEnrollments.map((enrollment: any) => {
              const course = enrollment.course as any;
              const classData = enrollment.class as any;
              const records = attendanceMap?.[enrollment.id] || [];
              const presentCount = records.filter(r => r.status === 'presente').length;

              return (
                <div key={enrollment.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{course?.name}</span>
                      {classData && <Badge variant="outline">{classData.name}</Badge>}
                      {enrollment.referral_agent_code && (
                        <Badge variant="secondary" className="text-xs">Cód: {enrollment.referral_agent_code}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${ACADEMIC_STATUS_CONFIG[enrollment.status as AcademicStatus]?.bgColor} ${ACADEMIC_STATUS_CONFIG[enrollment.status as AcademicStatus]?.color} border-0`}>
                        {ACADEMIC_STATUS_CONFIG[enrollment.status as AcademicStatus]?.label || enrollment.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{presentCount}/{COURSE_WEEKS} presenças</span>
                    </div>
                  </div>

                  {classData && (
                    <p className="text-xs text-muted-foreground">
                      {classData.room} • Início: {format(new Date(classData.start_date), 'dd/MM/yyyy')}
                    </p>
                  )}

                  <Separator />

                  {/* Attendance Grid */}
                  <TooltipProvider>
                    <div className="flex gap-1">
                      {records.map((record, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <button
                              className={`h-12 flex-1 rounded-md transition-all flex items-center justify-center text-sm font-medium cursor-pointer border
                                ${record.status === 'presente'
                                  ? 'bg-success text-success-foreground border-success'
                                  : record.status === 'falta'
                                    ? 'bg-destructive text-destructive-foreground border-destructive'
                                    : record.status === 'justificado'
                                      ? 'bg-warning text-warning-foreground border-warning'
                                      : 'bg-muted hover:bg-accent border-border'
                                }`}
                              onClick={() => enrollment.class_id && handleLessonClick(enrollment.id, enrollment.class_id, lead.id, record)}
                              disabled={!record.attendance_date}
                            >
                              {record.lesson_number}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Aula {record.lesson_number}</p>
                            {record.attendance_date && (
                              <p className="text-xs">{format(new Date(record.attendance_date), 'dd/MM/yyyy')}</p>
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

                  {/* Attendance marking buttons */}
                  {selectedLesson && selectedLesson.enrollmentId === enrollment.id && (
                    <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                      <p className="text-sm font-medium">Marcar presença - Aula {selectedLesson.lessonNumber}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleMarkAttendance('presente')}>
                          <Check className="h-4 w-4 mr-1" /> Presente
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleMarkAttendance('falta')}>
                          <X className="h-4 w-4 mr-1" /> Falta
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleMarkAttendance('justificado')}>
                          <AlertCircle className="h-4 w-4 mr-1" /> Just.
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedLesson(null)}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
