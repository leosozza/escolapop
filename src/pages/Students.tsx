import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Plus, 
  GraduationCap, 
  Users, 
  BookOpen,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { ACADEMIC_STATUS_CONFIG, type AcademicStatus } from '@/types/database';
import { AddEnrollmentDialog } from '@/components/students/AddEnrollmentDialog';
import { StudentDetailsSheet } from '@/components/students/StudentDetailsSheet';

interface EnrollmentWithRelations {
  id: string;
  student_id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  progress_percentage: number | null;
  course: {
    id: string;
    name: string;
  } | null;
  student: {
    id: string;
    user_id: string;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
  } | null;
}

export default function Students() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Fetch enrollments with student and course data
  const { data: enrollments, isLoading, refetch } = useQuery({
    queryKey: ['enrollments', searchTerm, statusFilter, courseFilter],
    queryFn: async () => {
      let query = supabase
        .from('enrollments')
        .select(`
          id,
          student_id,
          course_id,
          status,
          enrolled_at,
          progress_percentage,
          course:courses(id, name),
          student:profiles!enrollments_student_id_fkey(id, user_id, full_name, phone, avatar_url)
        `)
        .order('enrolled_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'ativo' | 'em_curso' | 'inadimplente' | 'evasao' | 'concluido' | 'trancado');
      }

      if (courseFilter !== 'all') {
        query = query.eq('course_id', courseFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const typedData = data as unknown as EnrollmentWithRelations[];

      // Filter by search term on client side
      if (searchTerm) {
        return typedData?.filter(e => 
          e.student?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.course?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return typedData;
    },
  });

  // Fetch courses for filter
  const { data: courses } = useQuery({
    queryKey: ['courses-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['enrollment-stats'],
    queryFn: async () => {
      const { data: allEnrollments, error } = await supabase
        .from('enrollments')
        .select('status');
      
      if (error) throw error;

      const total = allEnrollments?.length || 0;
      const active = allEnrollments?.filter(e => e.status === 'ativo' || e.status === 'em_curso').length || 0;
      const completed = allEnrollments?.filter(e => e.status === 'concluido').length || 0;
      const dropouts = allEnrollments?.filter(e => e.status === 'evasao').length || 0;

      return { total, active, completed, dropouts };
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

  const getStatusBadge = (status: string) => {
    const config = ACADEMIC_STATUS_CONFIG[status as AcademicStatus];
    if (!config) return <Badge variant="outline">{status}</Badge>;
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Alunos</h1>
            <p className="text-muted-foreground">Gestão de matrículas e acompanhamento acadêmico</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Matrícula
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Matriculados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativos</CardTitle>
              <GraduationCap className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats?.active || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
              <BookOpen className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{stats?.completed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Evasão</CardTitle>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats?.dropouts || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome do aluno ou curso..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {Object.entries(ACADEMIC_STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Cursos</SelectItem>
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Data Matrícula</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : enrollments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma matrícula encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  enrollments?.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={enrollment.student?.avatar_url ?? undefined} />
                            <AvatarFallback>
                              {enrollment.student?.full_name ? getInitials(enrollment.student.full_name) : 'A'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{enrollment.student?.full_name || 'Aluno'}</p>
                            <p className="text-xs text-muted-foreground">{enrollment.student?.phone}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{enrollment.course?.name}</p>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(enrollment.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-muted">
                            <div 
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${enrollment.progress_percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {enrollment.progress_percentage || 0}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(enrollment.enrolled_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedStudentId(enrollment.student_id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AddEnrollmentDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => {
          refetch();
          setIsAddDialogOpen(false);
        }}
      />

      <StudentDetailsSheet
        studentId={selectedStudentId}
        open={!!selectedStudentId}
        onOpenChange={(open) => !open && setSelectedStudentId(null)}
        onUpdate={refetch}
      />
    </>
  );
}
