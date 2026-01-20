import { useState, useEffect } from 'react';
import {
  Calendar,
  Check,
  X,
  AlertCircle,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ClassItem {
  id: string;
  name: string;
  course: { name: string } | null;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: 'presente' | 'falta' | 'justificado';
  student?: { full_name: string };
}

export default function Attendance() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [attendance, setAttendance] = useState<Map<string, 'presente' | 'falta' | 'justificado'>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudentsAndAttendance();
    }
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, course:courses(name)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setClasses(data || []);
      if (data && data.length > 0) {
        setSelectedClass(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudentsAndAttendance = async () => {
    setIsLoading(true);
    try {
      // Fetch students enrolled in this class
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('class_enrollments')
        .select(`
          enrollment:enrollments(
            student:profiles!enrollments_student_id_fkey(user_id, full_name)
          )
        `)
        .eq('class_id', selectedClass);

      if (enrollmentError) throw enrollmentError;

      const studentList = (enrollmentData || [])
        .map((e: any) => ({
          id: e.enrollment?.student?.user_id,
          full_name: e.enrollment?.student?.full_name || 'Aluno',
        }))
        .filter((s: any) => s.id);

      setStudents(studentList);

      // Fetch attendance for the selected date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', selectedClass)
        .eq('attendance_date', format(selectedDate, 'yyyy-MM-dd'));

      if (attendanceError) throw attendanceError;

      const attendanceMap = new Map<string, 'presente' | 'falta' | 'justificado'>();
      (attendanceData || []).forEach((a: any) => {
        attendanceMap.set(a.student_id, a.status);
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAttendance = async (studentId: string, status: 'presente' | 'falta' | 'justificado') => {
    setAttendance(prev => new Map(prev).set(studentId, status));
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('attendance')
        .upsert({
          class_id: selectedClass,
          student_id: studentId,
          attendance_date: format(selectedDate, 'yyyy-MM-dd'),
          status,
        }, {
          onConflict: 'class_id,student_id,attendance_date',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const stats = {
    total: students.length,
    presentes: Array.from(attendance.values()).filter(s => s === 'presente').length,
    faltas: Array.from(attendance.values()).filter(s => s === 'falta').length,
    justificados: Array.from(attendance.values()).filter(s => s === 'justificado').length,
  };

  if (isLoading && classes.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lista de Presença</h1>
          <p className="text-muted-foreground">
            Controle de frequência dos alunos
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-64">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a turma" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} - {c.course?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            disabled={selectedDate >= new Date()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Check className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.presentes}</p>
                <p className="text-sm text-muted-foreground">Presentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <X className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.faltas}</p>
                <p className="text-sm text-muted-foreground">Faltas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.justificados}</p>
                <p className="text-sm text-muted-foreground">Justificados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance List */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Chamada</CardTitle>
          <CardDescription>
            Clique nos botões para marcar a presença
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 opacity-50 mb-2" />
              <p>Nenhum aluno matriculado nesta turma</p>
            </div>
          ) : (
            <div className="space-y-2">
              {students.map((student) => {
                const status = attendance.get(student.id);
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-primary text-white">
                          {getInitials(student.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{student.full_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={status === 'presente' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          status === 'presente' && 'bg-success hover:bg-success/90'
                        )}
                        onClick={() => markAttendance(student.id, 'presente')}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Presente
                      </Button>
                      <Button
                        variant={status === 'falta' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          status === 'falta' && 'bg-destructive hover:bg-destructive/90'
                        )}
                        onClick={() => markAttendance(student.id, 'falta')}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Falta
                      </Button>
                      <Button
                        variant={status === 'justificado' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          status === 'justificado' && 'bg-warning hover:bg-warning/90'
                        )}
                        onClick={() => markAttendance(student.id, 'justificado')}
                      >
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Justificado
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
