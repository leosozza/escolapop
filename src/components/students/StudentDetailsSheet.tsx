import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GraduationCap,
  Phone,
  Mail,
  Calendar,
  Award,
  Clock,
  MessageCircle,
} from 'lucide-react';
import { ACADEMIC_STATUS_CONFIG, type AcademicStatus } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { COURSE_WEEKS } from '@/lib/course-schedule-config';

interface StudentDetailsSheetProps {
  studentId: string | null; // This is now the lead_id
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function StudentDetailsSheet({ studentId, open, onOpenChange, onUpdate }: StudentDetailsSheetProps) {
  const queryClient = useQueryClient();

  // Fetch lead data (student is a lead now)
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

  // Fetch student's enrollments using lead_id
  const { data: enrollments } = useQuery({
    queryKey: ['student-enrollments-lead', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          course:courses(*)
        `)
        .eq('lead_id', studentId)
        .order('enrolled_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && open,
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

  // Fetch attendance counts
  const { data: attendanceCounts } = useQuery({
    queryKey: ['attendance-counts-lead', studentId, enrollments],
    queryFn: async () => {
      if (!studentId || !enrollments?.length) return {};
      const counts: Record<string, number> = {};
      
      for (const enrollment of enrollments) {
        if (enrollment.class_id) {
          const { count } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .eq('class_id', enrollment.class_id)
            .eq('status', 'presente');
          
          counts[enrollment.id] = count || 0;
        }
      }
      
      return counts;
    },
    enabled: !!studentId && !!enrollments?.length && open,
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
              {enrollments?.map((enrollment) => {
                const attendanceCount = attendanceCounts?.[enrollment.id] || 0;
                const progressPercent = Math.round((attendanceCount / COURSE_WEEKS) * 100);
                
                return (
                  <Card key={enrollment.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{enrollment.course?.name}</CardTitle>
                        {getStatusBadge(enrollment.status as AcademicStatus)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Aulas Concluídas</span>
                        <span className="font-medium">{attendanceCount}/{COURSE_WEEKS}</span>
                      </div>
                      
                      {/* Visual progress blocks */}
                      <div className="flex gap-1">
                        {Array.from({ length: COURSE_WEEKS }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-4 flex-1 rounded-sm transition-all ${
                              i < attendanceCount ? 'bg-primary' : 'bg-muted'
                            }`}
                            title={`Aula ${i + 1}`}
                          />
                        ))}
                      </div>
                      
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
