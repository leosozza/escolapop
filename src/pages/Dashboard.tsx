import { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles,
  Handshake,
  Camera,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AgentCard, AddAgentCard } from '@/components/dashboard/AgentCard';
import { StatusBar, StatusSegment } from '@/components/dashboard/StatusBar';
import { SummaryPanel } from '@/components/dashboard/SummaryPanel';
import { RelationshipTable } from '@/components/dashboard/RelationshipTable';
import { DateFilter } from '@/components/dashboard/DateFilter';
import { EditAgentDialog } from '@/components/dashboard/EditAgentDialog';
import { LeadHistorySheet } from '@/components/leads/LeadHistorySheet';
import AddAgentDialog from '@/components/team/AddAgentDialog';
import { format, isSameDay, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { LeadStatus } from '@/types/database';

interface StaffMember {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

interface RelationshipAgent {
  id: string;
  full_name: string;
  avatar_url: string | null;
  whatsapp_phone: string;
  is_active: boolean;
}

interface LeadData {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  guardian_name: string | null;
  source: string;
  status: string;
  notes: string | null;
  updated_at: string;
  scheduled_at: string | null;
  created_at: string;
  assigned_agent_id: string | null;
  course?: { name: string } | null;
}

// Mock data for testing - will be removed when real data is available
const generateMockLeads = (): LeadData[] => {
  const now = new Date();
  const statuses = ['agendado', 'confirmado', 'aguardando_confirmacao', 'atrasado', 'compareceu', 'fechado', 'nao_fechado', 'reagendar'];
  const sources = ['whatsapp', 'instagram', 'facebook', 'indicacao'];
  const names = [
    'Ana Carolina Silva', 'Bruno Fernandes', 'Camila Oliveira', 'Daniel Costa',
    'Eduarda Santos', 'Felipe Rodrigues', 'Gabriela Lima', 'Henrique Almeida',
    'Isabela Martins', 'João Pedro Souza', 'Larissa Pereira', 'Marcos Vinícius',
    'Natália Ribeiro', 'Otávio Gomes', 'Patricia Carvalho', 'Rafael Mendes',
    'Sabrina Barbosa', 'Thiago Nascimento', 'Vanessa Araujo', 'William Castro',
    'Amanda Ferreira', 'Bruna Machado', 'Carlos Eduardo', 'Diana Rocha',
    'Emanuel Torres', 'Fernanda Dias', 'Gustavo Nunes', 'Helena Cardoso'
  ];
  
  return names.map((name, index) => {
    const status = statuses[index % statuses.length];
    const hoursAgo = Math.floor(Math.random() * 72);
    const scheduledHour = 8 + (index % 12);
    
    return {
      id: `mock-${index}`,
      full_name: name,
      phone: `(11) 9${String(9000 + index).padStart(4, '0')}-${String(1000 + index).padStart(4, '0')}`,
      email: `${name.toLowerCase().replace(/ /g, '.')}@email.com`,
      guardian_name: index % 3 === 0 ? `Responsável de ${name.split(' ')[0]}` : null,
      source: sources[index % sources.length],
      status,
      notes: index % 4 === 0 ? 'Lead interessado no curso de modelo' : null,
      updated_at: new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - (hoursAgo + 48) * 60 * 60 * 1000).toISOString(),
      scheduled_at: ['agendado', 'confirmado', 'aguardando_confirmacao'].includes(status) 
        ? setMinutes(setHours(now, scheduledHour), (index % 4) * 15).toISOString()
        : null,
      assigned_agent_id: null,
      course: index % 2 === 0 ? { name: 'Modelo Profissional' } : null,
    };
  });
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [relationshipAgents, setRelationshipAgents] = useState<RelationshipAgent[]>([]);
  const [agents, setAgents] = useState<StaffMember[]>([]);
  const [producers, setProducers] = useState<StaffMember[]>([]);
  const [scouters, setScouters] = useState<StaffMember[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showAddAgentDialog, setShowAddAgentDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<RelationshipAgent | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [isLeadHistoryOpen, setIsLeadHistoryOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch relationship agents from dedicated agents table
      const { data: agentsData } = await supabase
        .from('agents')
        .select('id, full_name, avatar_url, whatsapp_phone, is_active')
        .eq('is_active', true)
        .order('full_name');

      setRelationshipAgents(agentsData || []);

      // Fetch leads - exclude matriculados (they belong to academic, not commercial)
      const { data: leadsData } = await supabase
        .from('leads')
        .select(`
          id, full_name, phone, email, guardian_name, source, status, notes, 
          updated_at, scheduled_at, created_at, assigned_agent_id,
          course:courses(name)
        `)
        .neq('status', 'matriculado')
        .order('updated_at', { ascending: false });

      // Use mock data if no real leads exist
      const finalLeads = (leadsData && leadsData.length > 0) 
        ? (leadsData as unknown as LeadData[])
        : generateMockLeads();
      setLeads(finalLeads);

      // Fetch staff by role
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, avatar_url');

      const staffMap: Record<string, StaffMember[]> = {
        agente_comercial: [],
        produtor: [],
        scouter: [],
      };

      (rolesData || []).forEach((role) => {
        const profileInfo = profilesData?.find(p => p.user_id === role.user_id);
        if (profileInfo && staffMap[role.role]) {
          staffMap[role.role].push({
            id: profileInfo.id,
            user_id: profileInfo.user_id,
            full_name: profileInfo.full_name,
            avatar_url: profileInfo.avatar_url,
            role: role.role,
          });
        }
      });

      setAgents(staffMap.agente_comercial);
      setProducers(staffMap.produtor);
      setScouters(staffMap.scouter);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter leads by date
  const filteredLeadsByDate = useMemo(() => {
    if (!selectedDate) return leads;
    return leads.filter((lead) => {
      const leadDate = lead.scheduled_at ? new Date(lead.scheduled_at) : new Date(lead.updated_at);
      return isSameDay(leadDate, selectedDate);
    });
  }, [leads, selectedDate]);

  // Filter leads by status
  const filteredLeads = useMemo(() => {
    if (!statusFilter) return filteredLeadsByDate;
    return filteredLeadsByDate.filter((lead) => lead.status === statusFilter);
  }, [filteredLeadsByDate, statusFilter]);

  // Calculate agent-specific metrics filtered by date
  const getAgentMetrics = (agentId: string) => {
    const targetDate = selectedDate || new Date();
    
    // Filter leads by agent and date
    const agentLeads = leads.filter((l) => l.assigned_agent_id === agentId);
    
    // For agendados: filter by scheduled_at date
    const agendadosForDate = agentLeads.filter((l) => {
      if (l.status !== 'agendado' || !l.scheduled_at) return false;
      return isSameDay(new Date(l.scheduled_at), targetDate);
    });

    // For confirmados: filter by scheduled_at date
    const confirmadosForDate = agentLeads.filter((l) => {
      if (l.status !== 'confirmado' || !l.scheduled_at) return false;
      return isSameDay(new Date(l.scheduled_at), targetDate);
    });

    // Sem resposta: em_atendimento leads (no response yet)
    const semResposta = agentLeads.filter((l) => l.status === 'em_atendimento').length;

    // Reagendar status
    const reagendar = agentLeads.filter((l) => l.status === 'reagendar').length;

    // Fechados: compareceu or proposta (converted)
    const fechados = agentLeads.filter((l) => 
      l.status === 'compareceu' || l.status === 'proposta'
    ).length;

    // Não fechados: perdido
    const naoFechados = agentLeads.filter((l) => l.status === 'perdido').length;

    return {
      agendados: agendadosForDate.length,
      confirmados: confirmadosForDate.length,
      semResposta,
      reagendar,
      fechados,
      naoFechados,
    };
  };

  // Summary panel totals
  const summaryTotals = useMemo(() => {
    return {
      total: filteredLeadsByDate.length,
      confirmados: filteredLeadsByDate.filter((l) => l.status === 'confirmado').length,
      agendados: filteredLeadsByDate.filter((l) => l.status === 'agendado' || l.status === 'aguardando_confirmacao').length,
      semResposta: filteredLeadsByDate.filter((l) => l.status === 'em_atendimento').length,
      atrasados: filteredLeadsByDate.filter((l) => l.status === 'atrasado').length,
      reagendar: filteredLeadsByDate.filter((l) => l.status === 'reagendar').length,
      declinou: filteredLeadsByDate.filter((l) => l.status === 'declinou').length,
      limbo: filteredLeadsByDate.filter((l) => l.status === 'limbo').length,
    };
  }, [filteredLeadsByDate]);

  // Status bar segments - commercial workflow
  const statusSegments: StatusSegment[] = useMemo(() => [
    { key: 'agendado', label: 'Agendado', count: filteredLeadsByDate.filter((l) => l.status === 'agendado').length, colorClass: 'bg-blue-500' },
    { key: 'confirmado', label: 'Confirmado', count: filteredLeadsByDate.filter((l) => l.status === 'confirmado').length, colorClass: 'bg-green-500' },
    { key: 'aguardando_confirmacao', label: 'Aguard.', count: filteredLeadsByDate.filter((l) => l.status === 'aguardando_confirmacao').length, colorClass: 'bg-yellow-500' },
    { key: 'atrasado', label: 'Atrasado', count: filteredLeadsByDate.filter((l) => l.status === 'atrasado').length, colorClass: 'bg-red-500' },
    { key: 'compareceu', label: 'Compareceu', count: filteredLeadsByDate.filter((l) => l.status === 'compareceu').length, colorClass: 'bg-teal-500' },
    { key: 'fechado', label: 'Fechado', count: filteredLeadsByDate.filter((l) => l.status === 'fechado').length, colorClass: 'bg-emerald-500' },
    { key: 'reagendar', label: 'Reagendar', count: filteredLeadsByDate.filter((l) => l.status === 'reagendar').length, colorClass: 'bg-amber-500' },
    { key: 'declinou', label: 'Declinou', count: filteredLeadsByDate.filter((l) => l.status === 'declinou').length, colorClass: 'bg-rose-500' },
  ], [filteredLeadsByDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Olá, {profile?.full_name?.split(' ')[0] ?? 'Usuário'}! 👋
          </h1>
          <p className="text-muted-foreground">
            Desempenho da Equipe • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateFilter selectedDate={selectedDate} onDateChange={setSelectedDate} />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-primary text-white">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Visão Geral</span>
          </div>
        </div>
      </div>

      {/* Summary Panel */}
      <SummaryPanel totals={summaryTotals} />

      {/* Team Cards - Agents */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Agentes de Relacionamento</h2>
          <span className="text-sm text-muted-foreground">({relationshipAgents.length})</span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {relationshipAgents.map((agent) => (
              <div key={agent.id} className="group">
                <AgentCard
                  id={agent.id}
                  name={agent.full_name}
                  avatarUrl={agent.avatar_url}
                  metrics={getAgentMetrics(agent.id)}
                  onEdit={() => setEditingAgent(agent)}
                />
              </div>
            ))}
            <AddAgentCard onClick={() => setShowAddAgentDialog(true)} />
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Team Cards - Producers */}
      {producers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Produtores</h2>
            <span className="text-sm text-muted-foreground">({producers.length})</span>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {producers.map((producer) => (
                <AgentCard
                  key={producer.id}
                  id={producer.id}
                  name={producer.full_name}
                  avatarUrl={producer.avatar_url}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Team Cards - Scouters */}
      {scouters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Scouters</h2>
            <span className="text-sm text-muted-foreground">({scouters.length})</span>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {scouters.map((scouter) => (
                <AgentCard
                  key={scouter.id}
                  id={scouter.id}
                  name={scouter.full_name}
                  avatarUrl={scouter.avatar_url}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Status Bar */}
      <StatusBar
        segments={statusSegments}
        activeSegment={statusFilter}
        onSegmentClick={setStatusFilter}
      />

      {/* Full-width Carteira Table */}
      <RelationshipTable
        leads={filteredLeads}
        agents={agents}
        onLeadClick={(lead) => {
          setSelectedLead(lead as LeadData);
          setIsLeadHistoryOpen(true);
        }}
        className="min-h-[600px]"
      />

      {/* Add Agent Dialog */}
      <AddAgentDialog
        open={showAddAgentDialog}
        onOpenChange={setShowAddAgentDialog}
        onSuccess={fetchDashboardData}
      />

      {/* Edit Agent Dialog */}
      <EditAgentDialog
        open={!!editingAgent}
        onOpenChange={(open) => !open && setEditingAgent(null)}
        agent={editingAgent}
        onSuccess={fetchDashboardData}
      />

      {/* Lead History Sheet */}
      <LeadHistorySheet
        open={isLeadHistoryOpen}
        onOpenChange={setIsLeadHistoryOpen}
        lead={selectedLead ? {
          ...selectedLead,
          status: selectedLead.status as LeadStatus,
        } : null}
      />
    </div>
  );
}
