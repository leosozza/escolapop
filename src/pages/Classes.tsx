import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Users,
  Calendar,
  CalendarDays,
  Clock,
  MapPin,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Timer,
  CheckCircle,
  Archive,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AddClassDialog } from '@/components/classes/AddClassDialog';
import { EditClassDialog } from '@/components/classes/EditClassDialog';
import { ClassStudentsList } from '@/components/classes/ClassStudentsList';
import { ClassCalendarDialog } from '@/components/classes/ClassCalendarDialog';
import { WEEKDAYS, COURSE_WEEKS, AGE_RANGES } from '@/lib/course-schedule-config';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ClassStatusCounts {
  em_curso: number;
  agendados: number;
  evasao: number;
  trancado: number;
  total: number;
  presente_total: number;
  aulas_realizadas: number;
}


interface Class {
  id: string;
  name: string;
  course_id: string;
  teacher_id: string | null;
  room: string | null;
  start_date: string;
  end_date: string | null;
  schedule: Record<string, string> | null;
  max_students: number;
  is_active: boolean;
  created_at: string;
  age_range?: string | null;
  course?: { name: string; duration_hours: number | null };
  teacher?: { full_name: string };
  student_count?: number;
  status_counts?: ClassStatusCounts;
}

type ViewMode = 'cards' | 'list';

function safeFormatDate(dateStr: string | null | undefined, fmt = 'dd/MM/yyyy'): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '-';
  return format(d, fmt, { locale: ptBR });
}

export default function Classes() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isStudentsListOpen, setIsStudentsListOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const { toast } = useToast();

  const handleDeleteClass = async () => {
    if (!selectedClass) return;
    const hasStudents = (selectedClass.student_count || 0) > 0;

    if (hasStudents) {
      // Validate admin password
      if (!deleteAdminPassword.trim()) {
        setDeleteError('Digite a senha de administrador');
        return;
      }
      setIsDeleting(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');

        // Try to sign in with current user email + provided password to validate
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: deleteAdminPassword,
        });
        if (authError) {
          setDeleteError('Senha incorreta');
          setIsDeleting(false);
          return;
        }

        // Check if user is admin or gestor
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'gestor']);

        if (!roles || roles.length === 0) {
          setDeleteError('Apenas administradores ou gestores podem excluir turmas com alunos');
          setIsDeleting(false);
          return;
        }
      } catch {
        setDeleteError('Erro ao validar credenciais');
        setIsDeleting(false);
        return;
      }
    }

    setIsDeleting(true);
    try {
      // Delete enrollments linked to this class first
      await supabase.from('attendance').delete().eq('class_id', selectedClass.id);
      await supabase.from('enrollments').update({ class_id: null }).eq('class_id', selectedClass.id);
      
      const { error } = await supabase.from('classes').delete().eq('id', selectedClass.id);
      if (error) throw error;
      
      toast({ title: 'Turma excluída', description: `${selectedClass.name} foi removida.` });
      fetchClasses();
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao excluir turma' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setDeleteAdminPassword('');
      setDeleteError('');
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          course:courses(name, duration_hours),
          teacher:team_members!classes_teacher_id_fkey(full_name)
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;

      // Normalize teacher join (FK returns single object or array depending on relationship)
      const normalizedData = (data || []).map((c: any) => ({
        ...c,
        teacher: Array.isArray(c.teacher) ? c.teacher[0] || null : c.teacher,
      }));

      // Fetch student counts and status breakdown for each class
      const classesWithCounts = await Promise.all(
        normalizedData.map(async (c: any) => {
          const { data: enrollments } = await supabase
            .from('enrollments')
            .select('status')
            .eq('class_id', c.id)
            .not('lead_id', 'is', null);
          
          // Fetch attendance data for this class
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('attendance_date, status')
            .eq('class_id', c.id);

          const uniqueDates = new Set(attendanceData?.map(a => a.attendance_date) || []);
          const presenteTotal = attendanceData?.filter(a => a.status === 'presente').length || 0;

          const statusCounts: ClassStatusCounts = {
            em_curso: 0,
            agendados: 0,
            evasao: 0,
            trancado: 0,
            total: enrollments?.length || 0,
            presente_total: presenteTotal,
            aulas_realizadas: uniqueDates.size,
          };

          enrollments?.forEach((e) => {
            if (e.status === 'em_curso') statusCounts.em_curso++;
            else if (e.status === 'ativo') statusCounts.agendados++;
            else if (e.status === 'evasao' || e.status === 'reprovado_faltas') statusCounts.evasao++;
            else if (e.status === 'trancado') statusCounts.trancado++;
          });
          
          return { 
            ...c, 
            student_count: statusCounts.total,
            status_counts: statusCounts,
          };
        })
      );

      setClasses(classesWithCounts as Class[]);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar turmas',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique rooms for filter
  const uniqueRooms = useMemo(() => {
    const rooms = classes
      .map(c => c.room)
      .filter((room): room is string => !!room);
    return [...new Set(rooms)].sort();
  }, [classes]);

  const filteredClasses = classes.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.course?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRoom = selectedRoom === 'all' || c.room === selectedRoom;
    const matchesAge = selectedAgeRange === 'all' || (c as any).age_range === selectedAgeRange;
    const matchesDay = selectedDay === 'all' || (c.schedule && Object.keys(c.schedule).includes(selectedDay));
    return matchesSearch && matchesRoom && matchesAge && matchesDay;
  });

  // Separate active and completed classes
  const { activeClasses, completedClasses } = useMemo(() => {
    const now = new Date();
    const active: Class[] = [];
    const completed: Class[] = [];

    filteredClasses.forEach(c => {
      const endDate = c.end_date 
        ? new Date(c.end_date) 
        : new Date(new Date(c.start_date).getTime() + (COURSE_WEEKS - 1) * 7 * 24 * 60 * 60 * 1000);
      
      if (now > endDate || !c.is_active) {
        completed.push(c);
      } else {
        active.push(c);
      }
    });

    return { activeClasses: active, completedClasses: completed };
  }, [filteredClasses]);

  const formatSchedule = (schedule: Record<string, string> | null) => {
    if (!schedule) return 'Não definido';
    const dayLabels = WEEKDAYS.reduce((acc, day) => {
      acc[day.id] = day.name;
      return acc;
    }, {} as Record<string, string>);
    
    return Object.entries(schedule)
      .map(([day, time]) => `${dayLabels[day] || day} ${time}`)
      .join(' | ');
  };

  const getClassProgress = (startDate: string, endDate: string | null) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + (COURSE_WEEKS - 1) * 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    if (now < start) return { label: 'Não iniciada', variant: 'secondary' as const };
    if (now > end) return { label: 'Concluída', variant: 'default' as const };
    
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const passedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const weeksLeft = Math.ceil((end.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    return { label: `${weeksLeft} semanas restantes`, variant: 'outline' as const };
  };

  const handleClassClick = (classItem: Class) => {
    setSelectedClass(classItem);
    setIsStudentsListOpen(true);
  };

  const renderClassCard = (classItem: Class, isCompleted = false) => (
    <Card 
      key={classItem.id} 
      className={`border-0 shadow-md hover:shadow-lg transition-all cursor-pointer ${isCompleted ? 'opacity-75' : ''}`}
      onClick={() => handleClassClick(classItem)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{classItem.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {classItem.course?.name || 'Curso não definido'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Concluída
              </Badge>
            ) : (
              <Badge variant={classItem.is_active ? 'default' : 'secondary'}>
                {classItem.is_active ? 'Ativa' : 'Inativa'}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedClass(classItem); setIsEditDialogOpen(true); }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setSelectedClass(classItem); setDeleteAdminPassword(''); setDeleteError(''); setIsDeleteDialogOpen(true); }}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Schedule prominently displayed */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Clock className="h-4 w-4" />
              <span>{formatSchedule(classItem.schedule)}</span>
            </div>
            {(classItem as any).age_range && (classItem as any).age_range !== 'todas' && (
              <Badge variant="outline" className="text-xs">
                {AGE_RANGES.find(r => r.id === (classItem as any).age_range)?.label || (classItem as any).age_range}
              </Badge>
            )}
            {(classItem as any).age_range === 'todas' && (
              <Badge variant="secondary" className="text-xs">Todas as idades</Badge>
            )}
          </div>
        </div>

        {/* Attendance metrics */}
        <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-muted/50">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Agendados:</span>
            <span className="text-xs font-semibold">{classItem.status_counts?.agendados || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Em Curso:</span>
            <span className="text-xs font-semibold">{classItem.status_counts?.em_curso || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">% Comparecidos:</span>
            <span className="text-xs font-semibold">
              {classItem.status_counts?.total && classItem.status_counts?.aulas_realizadas
                ? `${Math.round((classItem.status_counts.presente_total / (classItem.status_counts.total * classItem.status_counts.aulas_realizadas)) * 100)}%`
                : '0%'
              }
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Aulas:</span>
            <span className="text-xs font-semibold">{classItem.status_counts?.aulas_realizadas || 0}/{COURSE_WEEKS}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-medium">{classItem.student_count || 0} alunos</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
            {safeFormatDate(classItem.start_date)}
            {classItem.end_date && ` → ${safeFormatDate(classItem.end_date)}`}
          </span>
        </div>
        {classItem.course?.duration_hours && (
          <div className="flex items-center gap-2 text-sm">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span>{classItem.course.duration_hours}h por aula • {COURSE_WEEKS} semanas</span>
          </div>
        )}
        {classItem.room && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{classItem.room}</span>
          </div>
        )}
        {classItem.teacher?.full_name && (
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <span>Prof. {classItem.teacher.full_name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderClassListRow = (classItem: Class, isCompleted = false) => (
    <tr
      key={classItem.id}
      className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${isCompleted ? 'opacity-75' : ''}`}
      onClick={() => handleClassClick(classItem)}
    >
      <td className="p-4">
        <div>
          <p className="font-medium">{classItem.name}</p>
          <p className="text-sm text-muted-foreground">{classItem.course?.name}</p>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{safeFormatDate(classItem.start_date)}</span>
        </div>
      </td>
      <td className="p-4">
        <span className="text-sm">{formatSchedule(classItem.schedule)}</span>
      </td>
      <td className="p-4">
        <span className="text-sm">{classItem.room || '-'}</span>
      </td>
      <td className="p-4 text-center">
        <span className="font-medium">{classItem.student_count || 0}</span>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-success" />
            {classItem.status_counts?.agendados || 0}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            {classItem.status_counts?.em_curso || 0}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            {classItem.status_counts?.evasao || 0}
          </span>
          <span className="text-muted-foreground">
            {classItem.status_counts?.aulas_realizadas || 0}/{COURSE_WEEKS} aulas
          </span>
        </div>
      </td>
      <td className="p-4">
        {isCompleted ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Concluída
          </Badge>
        ) : (
          <Badge variant={classItem.is_active ? 'default' : 'secondary'}>
            {classItem.is_active ? 'Ativa' : 'Inativa'}
          </Badge>
        )}
      </td>
    </tr>
  );

  if (isLoading) {
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
          <h1 className="text-3xl font-bold tracking-tight">Turmas</h1>
          <p className="text-muted-foreground">
            Clique em uma turma para ver a lista de alunos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsCalendarOpen(true)}
            className="gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            Calendário
          </Button>
          <Select value={selectedAgeRange} onValueChange={setSelectedAgeRange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Faixa Etária" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Faixas</SelectItem>
              {AGE_RANGES.map((range) => (
                <SelectItem key={range.id} value={range.id}>{range.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Dia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Dias</SelectItem>
              {WEEKDAYS.map((day) => (
                <SelectItem key={day.id} value={day.id}>{day.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-40">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Salas</SelectItem>
              {uniqueRooms.map((room) => (
                <SelectItem key={room} value={room}>
                  {room}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar turmas..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Turma
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classes.length}</p>
                <p className="text-sm text-muted-foreground">Total de Turmas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <GraduationCap className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeClasses.length}</p>
                <p className="text-sm text-muted-foreground">Turmas Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Archive className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedClasses.length}</p>
                <p className="text-sm text-muted-foreground">Turmas Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Users className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {classes.reduce((acc, c) => acc + (c.student_count || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total de Alunos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Active and Completed */}
      <Tabs defaultValue="active" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <GraduationCap className="h-4 w-4" />
              Turmas Ativas ({activeClasses.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <Archive className="h-4 w-4" />
              Turmas Concluídas ({completedClasses.length})
            </TabsTrigger>
          </TabsList>
          
          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 px-3"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-3"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="active" className="mt-2">
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeClasses.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 opacity-50 mb-2" />
                  <p>Nenhuma turma ativa</p>
                </div>
              ) : (
                activeClasses.map((classItem) => renderClassCard(classItem))
              )}
            </div>
          ) : (
            <Card className="border-0 shadow-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Sala</TableHead>
                    <TableHead className="text-center">Alunos</TableHead>
                    <TableHead>Status Alunos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeClasses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Users className="mx-auto h-12 w-12 opacity-50 mb-2" />
                        <p>Nenhuma turma ativa</p>
                      </td>
                    </tr>
                  ) : (
                    activeClasses.map((classItem) => renderClassListRow(classItem))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-2">
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedClasses.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Archive className="mx-auto h-12 w-12 opacity-50 mb-2" />
                  <p>Nenhuma turma concluída</p>
                </div>
              ) : (
                completedClasses.map((classItem) => renderClassCard(classItem, true))
              )}
            </div>
          ) : (
            <Card className="border-0 shadow-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Sala</TableHead>
                    <TableHead className="text-center">Alunos</TableHead>
                    <TableHead>Status Alunos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedClasses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Archive className="mx-auto h-12 w-12 opacity-50 mb-2" />
                        <p>Nenhuma turma concluída</p>
                      </td>
                    </tr>
                  ) : (
                    completedClasses.map((classItem) => renderClassListRow(classItem, true))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AddClassDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => {
          fetchClasses();
          setIsAddDialogOpen(false);
        }}
      />

      <ClassStudentsList
        classInfo={selectedClass}
        open={isStudentsListOpen}
        onOpenChange={setIsStudentsListOpen}
        onUpdate={fetchClasses}
      />

      {isCalendarOpen && (
        <ClassCalendarDialog
          open={isCalendarOpen}
          onOpenChange={setIsCalendarOpen}
          classes={classes}
          onClassSelect={(classItem) => {
            setSelectedClass(classItem);
            setIsStudentsListOpen(true);
          }}
        />
      )}

      {selectedClass && (
        <EditClassDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          classData={selectedClass}
          onSuccess={fetchClasses}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) { setDeleteAdminPassword(''); setDeleteError(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma?</AlertDialogTitle>
            <AlertDialogDescription>
              {(selectedClass?.student_count || 0) > 0 ? (
                <>
                  A turma "<strong>{selectedClass?.name}</strong>" possui <strong>{selectedClass?.student_count} aluno(s)</strong>. 
                  Para excluí-la, confirme com a senha de administrador ou gestor. 
                  Os alunos serão desvinculados da turma mas permanecerão no sistema.
                </>
              ) : (
                <>
                  A turma "<strong>{selectedClass?.name}</strong>" não possui alunos e será excluída permanentemente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(selectedClass?.student_count || 0) > 0 && (
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium">Senha de administrador</label>
              <Input
                type="password"
                placeholder="Digite sua senha"
                value={deleteAdminPassword}
                onChange={(e) => { setDeleteAdminPassword(e.target.value); setDeleteError(''); }}
              />
              {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <Button 
              variant="destructive" 
              onClick={handleDeleteClass} 
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
