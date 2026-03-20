import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { openWhatsAppWeb } from '@/lib/whatsapp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  TrendingDown,
  Eye,
  CheckCircle2,
  MessageCircle,
  UserX,
  RefreshCcw,
  ArrowRightLeft,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { ACADEMIC_STATUS_CONFIG, type AcademicStatus } from '@/types/database';
import { AddEnrollmentDialog } from '@/components/students/AddEnrollmentDialog';
import { StudentDetailsSheet } from '@/components/students/StudentDetailsSheet';
import { QuickAttendancePopover } from '@/components/students/QuickAttendancePopover';
import { StudentCSVExportButton } from '@/components/students/StudentCSVExportButton';
import { StudentCSVImportDialog } from '@/components/students/StudentCSVImportDialog';
import { StudentWebhookSheet } from '@/components/students/StudentWebhookSheet';
import { COURSE_WEEKS } from '@/lib/course-schedule-config';

interface StudentWithEnrollments {
  id: string;
  lead_id: string;
  full_name: string;
  age: number | null;
  guardian_name: string | null;
  referral_agent_code: string | null;
  enrollment_type: string | null;
  influencer_name: string | null;
  is_active: boolean;
  lead: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
  } | null;
}

const ENROLLMENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  modelo_agenciado_maxfama: { label: 'MaxFama', color: 'bg-purple-500 text-white' },
  modelo_agenciado_popschool: { label: 'Pop School', color: 'bg-blue-500 text-white' },
  indicacao_influencia: { label: 'Indicação Influência', color: 'bg-pink-500 text-white' },
  indicacao_aluno: { label: 'Indicação Aluno', color: 'bg-green-500 text-white' },
};

export default function Students() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);

  // Fetch students from the students table
  const { data: studentsList, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-list', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select(`
          id,
          lead_id,
          full_name,
          age,
          guardian_name,
          referral_agent_code,
          enrollment_type,
          influencer_name,
          is_active,
          lead:leads!students_lead_id_fkey(id, full_name, phone, email)
        `)
        .eq('is_active', true)
        .order('full_name');

      const { data, error } = await query;
      if (error) throw error;

      if (searchTerm) {
        return (data as unknown as StudentWithEnrollments[])?.filter(s =>
          s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.lead?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return data as unknown as StudentWithEnrollments[];
    },
  });

  // Fetch enrollments for display
  const { data: enrollments, isLoading, refetch } = useQuery({
    queryKey: ['enrollments-leads', searchTerm, statusFilter, courseFilter],
    queryFn: async () => {
      let query = supabase
        .from('enrollments')
        .select(`
          id,
          lead_id,
          student_record_id,
          course_id,
          class_id,
          status,
          enrolled_at,
          progress_percentage,
          enrollment_type,
          influencer_name,
          referral_agent_code,
          student_age,
          course:courses(id, name),
          lead:leads!enrollments_lead_id_fkey(id, full_name, phone, email),
          class:classes(id, name, start_date, end_date, teacher:team_members!classes_teacher_id_fkey(full_name))
        `)
        .not('lead_id', 'is', null)
        .order('enrolled_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as AcademicStatus);
      }

      if (courseFilter !== 'all') {
        query = query.eq('course_id', courseFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const typedData = data as unknown as any[];

      const enrollmentsWithAttendance = await Promise.all(
        typedData.map(async (enrollment) => {
          if (enrollment.class_id && enrollment.lead_id) {
            const { count } = await supabase
              .from('attendance')
              .select('*', { count: 'exact', head: true })
              .eq('student_id', enrollment.lead_id)
              .eq('class_id', enrollment.class_id)
              .eq('status', 'presente');
            
            return { ...enrollment, attendance_count: count || 0 };
          }
          return { ...enrollment, attendance_count: 0 };
        })
      );

      if (searchTerm) {
        return enrollmentsWithAttendance?.filter(e => 
          e.lead?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.course?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return enrollmentsWithAttendance;
    },
  });

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

  const { data: stats } = useQuery({
    queryKey: ['enrollment-stats-leads'],
    queryFn: async () => {
      const { data: allEnrollments, error } = await supabase
        .from('enrollments')
        .select('status')
        .not('lead_id', 'is', null);
      
      if (error) throw error;

      const total = allEnrollments?.length || 0;
      const matriculados = allEnrollments?.filter(e => e.status === 'ativo').length || 0;
      const ativos = allEnrollments?.filter(e => e.status === 'em_curso').length || 0;
      const ausentes = allEnrollments?.filter(e => e.status === 'ausente').length || 0;
      const reprovados = allEnrollments?.filter(e => e.status === 'reprovado_faltas').length || 0;
      const desistentes = allEnrollments?.filter(e => e.status === 'desistente').length || 0;
      const rematricula = allEnrollments?.filter(e => e.status === 'rematricula').length || 0;
      const remanejados = allEnrollments?.filter(e => e.status === 'remanejado').length || 0;
      const completed = allEnrollments?.filter(e => e.status === 'concluido' || e.status === 'formado').length || 0;

      return { total, matriculados, ativos, ausentes, reprovados, desistentes, rematricula, remanejados, completed };
    },
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

  const getEnrollmentTypeBadge = (enrollmentType: string | null | undefined) => {
    if (!enrollmentType) return null;
    const config = ENROLLMENT_TYPE_CONFIG[enrollmentType];
    if (!config) return null;
    return (
      <Badge className={`${config.color} border-0 text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const handleOpenWhatsApp = (phone: string, name: string) => {
    openWhatsAppWeb(phone, `Olá ${name}! Entramos em contato sobre suas aulas na escola.`);
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
          <div className="flex gap-2">
            <StudentCSVExportButton enrollments={enrollments} />
            <StudentCSVImportDialog onSuccess={() => refetch()} />
            <StudentWebhookSheet />
            <Button variant="outline" onClick={() => setIsAttendanceOpen(true)} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Dar Presença
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Matrícula
            </Button>
          </div>
        </div>

        {/* Stats Cards - New KPIs */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-success shrink-0" />
                <div>
                  <p className="text-xl font-bold">{stats?.matriculados || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Matriculados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-xl font-bold text-primary">{stats?.ativos || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Em Curso</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-400 shrink-0" />
                <div>
                  <p className="text-xl font-bold text-red-400">{stats?.ausentes || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Ausentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                <div>
                  <p className="text-xl font-bold text-orange-500">{stats?.reprovados || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Reprov. Faltas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <div>
                  <p className="text-xl font-bold text-rose-600">{stats?.desistentes || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Desistentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-purple-600 shrink-0" />
                <div>
                  <p className="text-xl font-bold text-purple-600">{stats?.rematricula || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Rematrícula</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-violet-600 shrink-0" />
                <div>
                  <p className="text-xl font-bold text-violet-600">{stats?.remanejados || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Remanejados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-info shrink-0" />
                <div>
                  <p className="text-xl font-bold text-info">{stats?.completed || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Concluídos</p>
                </div>
              </div>
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
                  <TableHead>Código/Tipo</TableHead>
                  <TableHead>Curso/Professor</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aulas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : enrollments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma matrícula encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  enrollments?.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {enrollment.lead?.full_name ? getInitials(enrollment.lead.full_name) : 'A'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{enrollment.lead?.full_name || 'Aluno'}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">{enrollment.lead?.phone}</p>
                              {enrollment.student_age && (
                                <span className="text-xs text-muted-foreground">• {enrollment.student_age} anos</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {enrollment.referral_agent_code && (
                            <Badge variant="secondary" className="w-fit text-xs">
                              {enrollment.referral_agent_code}
                            </Badge>
                          )}
                          {getEnrollmentTypeBadge(enrollment.enrollment_type)}
                          {enrollment.influencer_name && (
                            <span className="text-xs text-muted-foreground">
                              por {enrollment.influencer_name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <p className="font-medium">{enrollment.course?.name}</p>
                          {enrollment.class?.teacher && (
                            <span className="text-xs text-muted-foreground">
                              Prof. {enrollment.class.teacher.full_name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {enrollment.class ? (
                          <div className="flex flex-col text-xs">
                            <span>{new Date(enrollment.class.start_date).toLocaleDateString('pt-BR')}</span>
                            {enrollment.class.end_date && (
                              <span className="text-muted-foreground">
                                até {new Date(enrollment.class.end_date).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem turma</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(enrollment.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {Array.from({ length: COURSE_WEEKS }).map((_, i) => (
                              <div
                                key={i}
                                className={`h-6 w-2 rounded-sm transition-all ${
                                  i < (enrollment.attendance_count || 0)
                                    ? 'bg-primary'
                                    : 'bg-muted'
                                }`}
                                title={`Aula ${i + 1}`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium">
                            {enrollment.attendance_count || 0}/{COURSE_WEEKS}
                          </span>
                          {(enrollment.attendance_count || 0) >= COURSE_WEEKS && (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {enrollment.lead?.phone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenWhatsApp(enrollment.lead!.phone, enrollment.lead!.full_name)}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/students/${enrollment.lead_id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Perfil
                          </Button>
                        </div>
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
        studentId={selectedLeadId}
        open={!!selectedLeadId}
        onOpenChange={(open) => !open && setSelectedLeadId(null)}
        onUpdate={refetch}
      />

      <QuickAttendancePopover
        open={isAttendanceOpen}
        onOpenChange={setIsAttendanceOpen}
      />
    </>
  );
}
