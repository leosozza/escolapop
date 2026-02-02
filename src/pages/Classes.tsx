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
import { ClassStudentsList } from '@/components/classes/ClassStudentsList';
import { ClassCalendarDialog } from '@/components/classes/ClassCalendarDialog';
import { WEEKDAYS, COURSE_WEEKS } from '@/lib/course-schedule-config';

interface ClassStatusCounts {
  em_curso: number;
  status_aberto: number; // Previously inadimplente
  evasao: number;
  trancado: number;
  total: number;
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
  course?: { name: string; duration_hours: number | null };
  teacher?: { full_name: string };
  student_count?: number;
  status_counts?: ClassStatusCounts;
}

type ViewMode = 'cards' | 'list';

export default function Classes() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isStudentsListOpen, setIsStudentsListOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const { toast } = useToast();

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
          teacher:profiles!classes_teacher_id_fkey(full_name)
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;

      // Fetch student counts and status breakdown for each class
      const classesWithCounts = await Promise.all(
        (data || []).map(async (c) => {
          const { data: enrollments } = await supabase
            .from('enrollments')
            .select('status')
            .eq('class_id', c.id)
            .not('lead_id', 'is', null);
          
          const statusCounts: ClassStatusCounts = {
            em_curso: 0,
            status_aberto: 0, // Previously inadimplente
            evasao: 0,
            trancado: 0,
            total: enrollments?.length || 0,
          };

          enrollments?.forEach((e) => {
            // Both 'ativo' and 'em_curso' count as em_curso (students attending)
            if (e.status === 'em_curso' || e.status === 'ativo') statusCounts.em_curso++;
            else if (e.status === 'inadimplente') statusCounts.status_aberto++;
            else if (e.status === 'evasao') statusCounts.evasao++;
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
    return matchesSearch && matchesRoom;
  });

  // Separate active and completed classes
  const { activeClasses, completedClasses } = useMemo(() => {
    const now = new Date();
    const active: Class[] = [];
    const completed: Class[] = [];

    filteredClasses.forEach(c => {
      const endDate = c.end_date 
        ? new Date(c.end_date) 
        : new Date(new Date(c.start_date).getTime() + COURSE_WEEKS * 7 * 24 * 60 * 60 * 1000);
      
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
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + COURSE_WEEKS * 7 * 24 * 60 * 60 * 1000);
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
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); }}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status counts grid */}
        <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-muted/50">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Em Curso:</span>
            <span className="text-xs font-semibold">{classItem.status_counts?.em_curso || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Status Aberto:</span>
            <span className="text-xs font-semibold">{classItem.status_counts?.status_aberto || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-xs text-muted-foreground">Evasão:</span>
            <span className="text-xs font-semibold">{classItem.status_counts?.evasao || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="text-xs text-muted-foreground">Trancados:</span>
            <span className="text-xs font-semibold">{classItem.status_counts?.trancado || 0}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-medium">{classItem.student_count || 0} alunos</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
            {format(new Date(classItem.start_date), 'dd/MM/yyyy', { locale: ptBR })}
            {classItem.end_date && ` → ${format(new Date(classItem.end_date), 'dd/MM/yyyy', { locale: ptBR })}`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{formatSchedule(classItem.schedule)}</span>
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
          <span className="text-sm">{format(new Date(classItem.start_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
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
            <div className="w-2 h-2 rounded-full bg-primary" />
            {classItem.status_counts?.em_curso || 0}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-warning" />
            {classItem.status_counts?.status_aberto || 0}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            {classItem.status_counts?.evasao || 0}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            {classItem.status_counts?.trancado || 0}
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
    </div>
  );
}
