import { useState, useEffect } from 'react';
import {
  Award,
  Search,
  Download,
  Eye,
  Loader2,
  Calendar,
  GraduationCap,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Enrollment {
  id: string;
  status: string;
  completed_at: string | null;
  certificate_issued: boolean;
  certificate_issued_at: string | null;
  lead?: { full_name: string };
  course?: { name: string };
}

export default function Certificates() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          completed_at,
          certificate_issued,
          certificate_issued_at,
          lead:leads!enrollments_lead_id_fkey(full_name),
          course:courses(name)
        `)
        .eq('status', 'concluido')
        .not('lead_id', 'is', null)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setEnrollments(data || []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const issueCertificate = async (enrollmentId: string) => {
    try {
      const { error } = await supabase
        .from('enrollments')
        .update({
          certificate_issued: true,
          certificate_issued_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);

      if (error) throw error;

      toast({
        title: 'Certificado emitido!',
        description: 'O certificado foi gerado com sucesso.',
      });

      fetchEnrollments();
    } catch (error) {
      console.error('Error issuing certificate:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao emitir',
        description: 'Tente novamente.',
      });
    }
  };

  const filteredEnrollments = enrollments.filter(e =>
    e.lead?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.course?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const stats = {
    concluidos: enrollments.length,
    emitidos: enrollments.filter(e => e.certificate_issued).length,
    pendentes: enrollments.filter(e => !e.certificate_issued).length,
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
          <h1 className="text-3xl font-bold tracking-tight">Certificados</h1>
          <p className="text-muted-foreground">
            Emissão e gestão de certificados de conclusão
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.concluidos}</p>
                <p className="text-sm text-muted-foreground">Cursos Concluídos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Award className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emitidos}</p>
                <p className="text-sm text-muted-foreground">Certificados Emitidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Award className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendentes}</p>
                <p className="text-sm text-muted-foreground">Aguardando Emissão</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Conclusão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEnrollments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Award className="mx-auto h-12 w-12 opacity-50 mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum certificado encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEnrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-gradient-primary text-white text-xs">
                            {getInitials(enrollment.lead?.full_name || 'A')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {enrollment.lead?.full_name || 'Aluno'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{enrollment.course?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {enrollment.completed_at
                          ? format(new Date(enrollment.completed_at), 'dd/MM/yyyy', { locale: ptBR })
                          : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {enrollment.certificate_issued ? (
                        <Badge className="bg-success/10 text-success">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Emitido
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {enrollment.certificate_issued_at
                        ? format(new Date(enrollment.certificate_issued_at), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {enrollment.certificate_issued ? (
                          <>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-primary hover:opacity-90"
                            onClick={() => issueCertificate(enrollment.id)}
                          >
                            <Award className="h-4 w-4 mr-1" />
                            Emitir
                          </Button>
                        )}
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
  );
}
