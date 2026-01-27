import { useState, useEffect } from 'react';
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
  Eye,
  Edit,
  Trash2,
  Timer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  _count?: { students: number };
}

export default function Classes() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
      setClasses((data || []) as Class[]);
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
    const progress = Math.round((passedDays / totalDays) * 100);
    const weeksLeft = Math.ceil((end.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    return { label: `${weeksLeft} semanas restantes`, variant: 'outline' as const, progress };
  };

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
            Gestão de turmas e alunos matriculados
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
                <p className="text-2xl font-bold">{classes.filter(c => c.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Turmas Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClasses.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Users className="mx-auto h-12 w-12 opacity-50 mb-2" />
            <p>Nenhuma turma cadastrada</p>
          </div>
        ) : (
          filteredClasses.map((classItem) => (
            <Card key={classItem.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{classItem.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {classItem.course?.name || 'Curso não definido'}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
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
                  <Badge variant={classItem.is_active ? 'default' : 'secondary'}>
                    {classItem.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddClassDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => {
          fetchClasses();
          setIsAddDialogOpen(false);
        }}
      />
    </div>
  );
}
