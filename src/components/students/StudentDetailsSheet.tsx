import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  BookOpen,
  Award,
  Clock,
  User,
} from 'lucide-react';
import { ACADEMIC_STATUS_CONFIG, type AcademicStatus } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StudentDetailsSheetProps {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function StudentDetailsSheet({ studentId, open, onOpenChange, onUpdate }: StudentDetailsSheetProps) {
  const queryClient = useQueryClient();

  // Fetch student profile
  const { data: student } = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', studentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && open,
  });

  // Fetch student's enrollments
  const { data: enrollments } = useQuery({
    queryKey: ['student-enrollments', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          course:courses(*)
        `)
        .eq('student_id', studentId)
        .order('enrolled_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && open,
  });

  // Fetch enrollment history
  const { data: history } = useQuery({
    queryKey: ['enrollment-history', studentId],
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
      queryClient.invalidateQueries({ queryKey: ['student-enrollments', studentId] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-history', studentId] });
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

  if (!student) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={student.avatar_url ?? undefined} />
              <AvatarFallback className="text-lg">
                {getInitials(student.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-xl">{student.full_name}</SheetTitle>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                {student.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {student.phone}
                  </span>
                )}
              </div>
            </div>
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
              {enrollments?.map((enrollment) => (
                <Card key={enrollment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{enrollment.course?.name}</CardTitle>
                      {getStatusBadge(enrollment.status as AcademicStatus)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{enrollment.progress_percentage || 0}%</span>
                    </div>
                    <Progress value={enrollment.progress_percentage || 0} className="h-2" />
                    
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
              ))}
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
