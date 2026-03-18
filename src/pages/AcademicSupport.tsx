import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Search,
  Plus,
  GraduationCap,
  Users,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Lock,
  Clock,
  UserX,
  Award,
  XCircle,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { AcademicConversationPanel } from '@/components/academic/AcademicConversationPanel';
import { AddEnrollmentDialog } from '@/components/students/AddEnrollmentDialog';
import { NonEnrollmentReasonDialog } from '@/components/academic/NonEnrollmentReasonDialog';
import { differenceInHours } from 'date-fns';

const ACADEMIC_TABULATION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  novo_lead: { label: 'Novo Lead', color: 'bg-info', icon: MessageCircle },
  ativo: { label: 'Matriculado', color: 'bg-blue-500', icon: GraduationCap },
  em_curso: { label: 'Em Curso', color: 'bg-green-500', icon: BookOpen },
  lead_nao_matriculado: { label: 'Não Matriculado', color: 'bg-destructive', icon: UserX },
  reprovado_faltas: { label: 'Reprovado Faltas', color: 'bg-orange-500', icon: XCircle },
  ausente: { label: 'Ausente', color: 'bg-red-400', icon: UserX },
  evasao: { label: 'Não Ativo', color: 'bg-orange-500', icon: AlertTriangle },
  concluido: { label: 'Concluído', color: 'bg-emerald-600', icon: CheckCircle },
  formado: { label: 'Formado', color: 'bg-emerald-700', icon: Award },
  trancado: { label: 'Trancado', color: 'bg-muted-foreground', icon: Lock },
  inadimplente: { label: 'Status em Aberto', color: 'bg-warning', icon: AlertTriangle },
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
  // Response tracking
  first_contact_at?: string;
  first_response_at?: string;
  alert_24h?: boolean;
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
  const [courseFilter, setCourseFilter] = useState('all');
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [reasonDialogLead, setReasonDialogLead] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchContacts();
    fetchCourses();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts, activeTab, courseFilter]);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setCourses(data || []);
  };

  const fetchContacts = async () => {
    try {
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

      // Also fetch leads with status 'lead' that might be new academic leads
      const { data: newLeads } = await supabase
        .from('leads')
        .select('id, full_name, phone, created_at, updated_at')
        .eq('status', 'lead')
        .order('created_at', { ascending: false });

      // Fetch response tracking data
      const { data: trackingData } = await supabase
        .from('lead_response_tracking')
        .select('*');

      const trackingMap = new Map(
        (trackingData || []).map((t: any) => [t.lead_id, t])
      );

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

          const tracking = trackingMap.get(enrollment.lead_id);

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
            first_contact_at: tracking?.first_contact_at,
            first_response_at: tracking?.first_response_at,
            alert_24h: tracking?.alert_24h,
          };
        })
      );

      // Add new leads as novo_lead contacts
      const newLeadContacts: AcademicContact[] = (newLeads || []).map((lead: any) => {
        const tracking = trackingMap.get(lead.id);
        return {
          id: `lead_${lead.id}`,
          lead_id: lead.id,
          full_name: lead.full_name,
          phone: lead.phone,
          status: 'novo_lead',
          course_name: null,
          class_name: null,
          referral_agent_code: null,
          enrollment_type: null,
          updated_at: lead.updated_at,
          absences_count: 0,
          first_contact_at: tracking?.first_contact_at || lead.created_at,
          first_response_at: tracking?.first_response_at,
          alert_24h: tracking?.alert_24h || false,
        };
      });

      setContacts([...newLeadContacts, ...contactsWithAbsences]);
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

    if (courseFilter !== 'all') {
      filtered = filtered.filter((c) => c.course_name === courseFilter);
    }

    if (activeTab !== 'all') {
      if (activeTab === 'alerta_24h') {
        filtered = filtered.filter((c) => {
          if (c.alert_24h) return true;
          if (c.first_contact_at && !c.first_response_at) {
            const hours = differenceInHours(new Date(), new Date(c.first_contact_at));
            return hours >= 24;
          }
          return false;
        });
      } else if (activeTab === 'nao_ativos') {
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

  const handleContactSelect = (contact: AcademicContact) => {
    // If lead is "lead_nao_matriculado", require reason dialog
    if (contact.status === 'lead_nao_matriculado') {
      setReasonDialogLead({ id: contact.lead_id, name: contact.full_name });
    }
    setSelectedContact(contact);
  };

  const handleStatusUpdate = async (enrollmentId: string, newStatus: string) => {
    try {
      const validStatuses = ['ativo', 'em_curso', 'evasao', 'concluido', 'trancado', 'inadimplente', 'novo_lead', 'lead_nao_matriculado', 'reprovado_faltas', 'ausente', 'formado'];
      if (!validStatuses.includes(newStatus)) return;

      const { error } = await supabase
        .from('enrollments')
        .update({ status: newStatus as any })
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

  const getWaitTimeIndicator = (contact: AcademicContact) => {
    if (!contact.first_contact_at || contact.first_response_at) return null;
    const hours = differenceInHours(new Date(), new Date(contact.first_contact_at));
    if (hours >= 48) return { label: '48h+', color: 'bg-destructive text-destructive-foreground' };
    if (hours >= 24) return { label: '24h+', color: 'bg-warning text-warning-foreground' };
    if (hours >= 12) return { label: `${hours}h`, color: 'bg-orange-400 text-white' };
    return null;
  };

  const stats = {
    novosLeads: contacts.filter((c) => c.status === 'novo_lead').length,
    alerta24h: contacts.filter((c) => {
      if (c.alert_24h) return true;
      if (c.first_contact_at && !c.first_response_at) {
        return differenceInHours(new Date(), new Date(c.first_contact_at)) >= 24;
      }
      return false;
    }).length,
    matriculados: contacts.filter((c) => c.status === 'ativo').length,
    emCurso: contacts.filter((c) => c.status === 'em_curso').length,
    naoMatriculados: contacts.filter((c) => c.status === 'lead_nao_matriculado').length,
    reprovadoFaltas: contacts.filter((c) => c.status === 'reprovado_faltas').length,
    ausentes: contacts.filter((c) => c.status === 'ausente').length,
    formados: contacts.filter((c) => c.status === 'formado' || c.status === 'concluido').length,
    trancados: contacts.filter((c) => c.status === 'trancado').length,
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendimento Matrícula</h1>
          <p className="text-muted-foreground">
            Departamento Acadêmico • {contacts.length} contatos
          </p>
        </div>
      </div>

      {/* Stats - KPIs */}
      <div className="grid gap-3 grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
        {[
          { label: 'Novos Leads', value: stats.novosLeads, icon: MessageCircle, color: 'text-info' },
          { label: 'Alerta 24h', value: stats.alerta24h, icon: Clock, color: 'text-warning' },
          { label: 'Matriculados', value: stats.matriculados, icon: GraduationCap, color: 'text-blue-500' },
          { label: 'Em Curso', value: stats.emCurso, icon: BookOpen, color: 'text-green-500' },
          { label: 'Não Matric.', value: stats.naoMatriculados, icon: UserX, color: 'text-destructive' },
          { label: 'Rep. Faltas', value: stats.reprovadoFaltas, icon: XCircle, color: 'text-orange-500' },
          { label: 'Ausentes', value: stats.ausentes, icon: UserX, color: 'text-red-400' },
          { label: 'Formados', value: stats.formados, icon: Award, color: 'text-emerald-600' },
          { label: 'Trancados', value: stats.trancados, icon: Lock, color: 'text-muted-foreground' },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <kpi.icon className={cn('h-4 w-4 mx-auto mb-1', kpi.color)} />
              <div className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</div>
              <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Lista de Contatos */}
        <Card className="w-[420px] flex flex-col border-0 shadow-md">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Contatos
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
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Filtrar por curso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cursos</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4">
              <TabsList className="w-full grid grid-cols-5 h-auto">
                <TabsTrigger value="all" className="text-[10px] py-1">Todos</TabsTrigger>
                <TabsTrigger value="novo_lead" className="text-[10px] py-1">Novos</TabsTrigger>
                <TabsTrigger value="alerta_24h" className="text-[10px] py-1">
                  ⚠️ 24h
                </TabsTrigger>
                <TabsTrigger value="ativo" className="text-[10px] py-1">Matric.</TabsTrigger>
                <TabsTrigger value="em_curso" className="text-[10px] py-1">Curso</TabsTrigger>
              </TabsList>
              <TabsList className="w-full grid grid-cols-5 h-auto mt-1">
                <TabsTrigger value="lead_nao_matriculado" className="text-[10px] py-1">N.Matr.</TabsTrigger>
                <TabsTrigger value="reprovado_faltas" className="text-[10px] py-1">Rep.F.</TabsTrigger>
                <TabsTrigger value="ausente" className="text-[10px] py-1">Ausente</TabsTrigger>
                <TabsTrigger value="concluido" className="text-[10px] py-1">Concl.</TabsTrigger>
                <TabsTrigger value="trancado" className="text-[10px] py-1">Tranc.</TabsTrigger>
              </TabsList>
            </div>

            <CardContent className="flex-1 p-0 mt-3">
              <ScrollArea className="h-[calc(100vh-560px)]">
                <div className="px-4 pb-4 space-y-2">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <GraduationCap className="mx-auto h-10 w-10 opacity-50 mb-2" />
                      <p>Nenhum contato encontrado</p>
                    </div>
                  ) : (
                    filteredContacts.map((contact) => {
                      const waitIndicator = getWaitTimeIndicator(contact);
                      return (
                        <div
                          key={contact.id}
                          className={cn(
                            'p-3 rounded-lg border cursor-pointer transition-all',
                            selectedContact?.id === contact.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30',
                            contact.alert_24h && 'border-warning bg-warning/5'
                          )}
                          onClick={() => handleContactSelect(contact)}
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
                            <div className="text-right space-y-1">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'text-[10px] px-1.5 py-0.5 text-white',
                                  ACADEMIC_TABULATION_CONFIG[contact.status]?.color || 'bg-muted'
                                )}
                              >
                                {ACADEMIC_TABULATION_CONFIG[contact.status]?.label || contact.status}
                              </Badge>
                              {waitIndicator && (
                                <Badge className={cn('text-[10px] px-1 py-0 block', waitIndicator.color)}>
                                  <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                                  {waitIndicator.label}
                                </Badge>
                              )}
                              {contact.absences_count > 0 && (
                                <p className="text-[10px] text-orange-500">
                                  {contact.absences_count} falta(s)
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
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
              <p className="text-lg font-medium">Selecione um contato</p>
              <p className="text-sm">Escolha um contato para ver os detalhes e iniciar atendimento</p>
            </div>
          </Card>
        )}
      </div>

      <AddEnrollmentDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleContactCreated}
      />

      {reasonDialogLead && (
        <NonEnrollmentReasonDialog
          open={!!reasonDialogLead}
          onOpenChange={(open) => !open && setReasonDialogLead(null)}
          leadId={reasonDialogLead.id}
          leadName={reasonDialogLead.name}
          onReasonSaved={() => {
            fetchContacts();
            setReasonDialogLead(null);
          }}
        />
      )}
    </div>
  );
}
