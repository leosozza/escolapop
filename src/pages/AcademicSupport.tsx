import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Search,
  Plus,
  GraduationCap,
  Users,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AcademicConversationPanel } from '@/components/academic/AcademicConversationPanel';
import { AddAcademicContactDialog } from '@/components/academic/AddAcademicContactDialog';

// Academic statuses for tabulation
const ACADEMIC_TABULATION_CONFIG: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Matriculado', color: 'bg-blue-500' },
  em_curso: { label: 'Em Curso', color: 'bg-green-500' },
  evasao: { label: 'Não Ativo', color: 'bg-orange-500' },
  concluido: { label: 'Concluído', color: 'bg-emerald-600' },
  trancado: { label: 'Trancado', color: 'bg-muted-foreground' },
  rematricular: { label: 'Rematricular', color: 'bg-purple-500' },
};

interface AcademicContact {
  id: string;
  lead_id: string;
  full_name: string;
  phone: string;
  status: string;
  course_name: string | null;
  class_name: string | null;
  referral_agent_code: string | null;
  enrollment_type: string | null;
  updated_at: string;
  absences_count: number;
}

export default function AcademicSupport() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<AcademicContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<AcademicContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<AcademicContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts, activeTab]);

  const fetchContacts = async () => {
    try {
      // Fetch enrollments with student/lead data
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          lead_id,
          status,
          referral_agent_code,
          enrollment_type,
          updated_at,
          class_id,
          lead:leads!enrollments_lead_id_fkey(id, full_name, phone),
          course:courses(name),
          class:classes(name)
        `)
        .not('lead_id', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Calculate absences for each student
      const contactsWithAbsences = await Promise.all(
        (enrollments || []).map(async (enrollment: any) => {
          let absencesCount = 0;
          if (enrollment.class_id && enrollment.lead_id) {
            const { count } = await supabase
              .from('attendance')
              .select('*', { count: 'exact', head: true })
              .eq('student_id', enrollment.lead_id)
              .eq('class_id', enrollment.class_id)
              .eq('status', 'falta');
            absencesCount = count || 0;
          }

          return {
            id: enrollment.id,
            lead_id: enrollment.lead_id,
            full_name: enrollment.lead?.full_name || 'Aluno',
            phone: enrollment.lead?.phone || '',
            status: enrollment.status,
            course_name: enrollment.course?.name || null,
            class_name: enrollment.class?.name || null,
            referral_agent_code: enrollment.referral_agent_code,
            enrollment_type: enrollment.enrollment_type,
            updated_at: enrollment.updated_at,
            absences_count: absencesCount,
          };
        })
      );

      setContacts(contactsWithAbsences);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = contacts;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.full_name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          c.referral_agent_code?.toLowerCase().includes(query) ||
          c.course_name?.toLowerCase().includes(query)
      );
    }

    if (activeTab !== 'all') {
      if (activeTab === 'nao_ativos') {
        // 3+ absences
        filtered = filtered.filter((c) => c.absences_count >= 3 || c.status === 'evasao');
      } else {
        filtered = filtered.filter((c) => c.status === activeTab);
      }
    }

    setFilteredContacts(filtered);
  };

  const handleContactCreated = () => {
    fetchContacts();
    setIsAddDialogOpen(false);
    toast({
      title: 'Contato adicionado',
      description: 'Aluno pronto para atendimento.',
    });
  };

  const handleStatusUpdate = async (enrollmentId: string, newStatus: string) => {
    try {
      // Cast to valid academic status
      const validStatus = newStatus as 'ativo' | 'em_curso' | 'evasao' | 'concluido' | 'trancado' | 'inadimplente';
      const { error } = await supabase
        .from('enrollments')
        .update({ status: validStatus })
        .eq('id', enrollmentId);

      if (error) throw error;

      setContacts((prev) =>
        prev.map((c) => (c.id === enrollmentId ? { ...c, status: newStatus } : c))
      );

      if (selectedContact?.id === enrollmentId) {
        setSelectedContact((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      toast({
        title: 'Status atualizado',
        description: `Tabulação alterada para ${ACADEMIC_TABULATION_CONFIG[newStatus]?.label || newStatus}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Tente novamente.',
      });
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  // Stats
  const stats = {
    matriculados: contacts.filter((c) => c.status === 'ativo').length,
    emCurso: contacts.filter((c) => c.status === 'em_curso').length,
    naoAtivos: contacts.filter((c) => c.absences_count >= 3 || c.status === 'evasao').length,
    concluidos: contacts.filter((c) => c.status === 'concluido').length,
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendimento Matrícula</h1>
          <p className="text-muted-foreground">
            Departamento Acadêmico - Gestão de alunos via WhatsApp
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matriculados</CardTitle>
            <GraduationCap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.matriculados}</div>
            <p className="text-xs text-muted-foreground">Aguardando início</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Curso</CardTitle>
            <BookOpen className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.emCurso}</div>
            <p className="text-xs text-muted-foreground">Estudando ativamente</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Não Ativos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.naoAtivos}</div>
            <p className="text-xs text-muted-foreground">3+ faltas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            <Users className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.concluidos}</div>
            <p className="text-xs text-muted-foreground">Formados</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Lista de Contatos */}
        <Card className="w-[420px] flex flex-col border-0 shadow-md">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Alunos
              </CardTitle>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Novo
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, código ou curso..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4">
              <TabsList className="w-full grid grid-cols-4 h-auto">
                <TabsTrigger value="all" className="text-xs py-1.5">
                  Todos
                </TabsTrigger>
                <TabsTrigger value="ativo" className="text-xs py-1.5">
                  Matriculados
                </TabsTrigger>
                <TabsTrigger value="em_curso" className="text-xs py-1.5">
                  Em Curso
                </TabsTrigger>
                <TabsTrigger value="nao_ativos" className="text-xs py-1.5">
                  Não Ativos
                </TabsTrigger>
              </TabsList>
            </div>

            <CardContent className="flex-1 p-0 mt-3">
              <ScrollArea className="h-[calc(100vh-440px)]">
                <div className="px-4 pb-4 space-y-2">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Carregando alunos...
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <GraduationCap className="mx-auto h-10 w-10 opacity-50 mb-2" />
                      <p>Nenhum aluno encontrado</p>
                    </div>
                  ) : (
                    filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={cn(
                          'p-3 rounded-lg border cursor-pointer transition-all',
                          selectedContact?.id === contact.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        )}
                        onClick={() => setSelectedContact(contact)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
                              {getInitials(contact.full_name)}
                            </div>
                            <div
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
                                ACADEMIC_TABULATION_CONFIG[contact.status]?.color || 'bg-muted'
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{contact.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {contact.course_name || 'Sem curso'}
                              {contact.referral_agent_code && ` • ${contact.referral_agent_code}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 text-white',
                                contact.absences_count >= 3
                                  ? 'bg-orange-500'
                                  : ACADEMIC_TABULATION_CONFIG[contact.status]?.color
                              )}
                            >
                              {contact.absences_count >= 3
                                ? 'Não Ativo'
                                : ACADEMIC_TABULATION_CONFIG[contact.status]?.label || contact.status}
                            </Badge>
                            {contact.absences_count > 0 && contact.absences_count < 3 && (
                              <p className="text-[10px] text-orange-500 mt-1">
                                {contact.absences_count} falta(s)
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Tabs>
        </Card>

        {/* Área de Conversa */}
        {selectedContact ? (
          <AcademicConversationPanel
            contact={selectedContact}
            onStatusChange={handleStatusUpdate}
            operatorName={profile?.full_name || 'Operador'}
          />
        ) : (
          <Card className="flex-1 flex items-center justify-center border-0 shadow-md">
            <div className="text-center text-muted-foreground">
              <GraduationCap className="mx-auto h-16 w-16 opacity-30 mb-4" />
              <p className="text-lg font-medium">Selecione um aluno</p>
              <p className="text-sm">Escolha um aluno para ver os detalhes e iniciar atendimento</p>
            </div>
          </Card>
        )}
      </div>

      <AddAcademicContactDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleContactCreated}
      />
    </div>
  );
}
