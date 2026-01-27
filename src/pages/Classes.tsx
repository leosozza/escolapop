import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Users,
  Calendar,
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AddClassDialog } from '@/components/classes/AddClassDialog';
import { ClassStudentsList } from '@/components/classes/ClassStudentsList';
import { WEEKDAYS, COURSE_WEEKS } from '@/lib/course-schedule-config';

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
}

export default function Classes() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isStudentsListOpen, setIsStudentsListOpen] = useState(false);
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

      // Fetch student counts for each class
      const classesWithCounts = await Promise.all(
        (data || []).map(async (c) => {
          const { count } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', c.id)
            .not('lead_id', 'is', null);
          
          return { ...c, student_count: count || 0 };
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

  const filteredClasses = classes.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.course?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      </CardHeader>
      <CardContent className="space-y-3">
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
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {classItem.teacher?.full_name?.charAt(0) || 'P'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {classItem.teacher?.full_name || 'Sem professor'}
            </span>
          </div>
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
        </div>
      </CardContent>
    </Card>
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

        <TabsContent value="active" className="mt-6">
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
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
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
    </div>
  );
}
