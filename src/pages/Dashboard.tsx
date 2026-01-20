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
import { OperationalAlerts } from '@/components/dashboard/OperationalAlerts';
import AddAgentDialog from '@/components/team/AddAgentDialog';
import { format, differenceInHours, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface StaffMember {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

interface LeadData {
  id: string;
  full_name: string;
  status: string;
  updated_at: string;
  scheduled_at: string | null;
  assigned_agent_id: string | null;
}

interface Alert {
  id: string;
  type: 'overdue' | 'no_response' | 'pending_confirmation' | 'at_risk';
  title: string;
  description: string;
  leadName: string;
  timeAgo: string;
  priority: 'high' | 'medium' | 'low';
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [agents, setAgents] = useState<StaffMember[]>([]);
  const [producers, setProducers] = useState<StaffMember[]>([]);
  const [scouters, setScouters] = useState<StaffMember[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showAddAgentDialog, setShowAddAgentDialog] = useState(false);

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
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, full_name, status, updated_at, assigned_agent_id, scheduled_at')
        .order('updated_at', { ascending: false });

      setLeads(leadsData || []);

      // Generate alerts
      const generatedAlerts: Alert[] = [];
      const now = new Date();

      (leadsData || []).forEach((lead) => {
        const hoursAgo = differenceInHours(now, new Date(lead.updated_at));

        if (lead.status === 'em_atendimento' && hoursAgo > 24) {
          generatedAlerts.push({
            id: `nr-${lead.id}`,
            type: 'no_response',
            title: 'Sem resposta há mais de 24h',
            description: `Lead em atendimento sem atualização`,
            leadName: lead.full_name,
            timeAgo: `${hoursAgo}h`,
            priority: hoursAgo > 48 ? 'high' : 'medium',
          });
        }

        if (lead.status === 'lead' && hoursAgo > 12) {
          generatedAlerts.push({
            id: `od-${lead.id}`,
            type: 'overdue',
            title: 'Atrasado para agendamento',
            description: `Lead novo sem agendamento`,
            leadName: lead.full_name,
            timeAgo: `${hoursAgo}h`,
            priority: hoursAgo > 24 ? 'high' : 'medium',
          });
        }

        if (lead.status === 'agendado' && lead.scheduled_at) {
          const scheduledDate = new Date(lead.scheduled_at);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          if (scheduledDate.toDateString() === tomorrow.toDateString()) {
            generatedAlerts.push({
              id: `pc-${lead.id}`,
              type: 'pending_confirmation',
              title: 'Confirmação pendente para amanhã',
              description: `Agendado para ${format(scheduledDate, 'dd/MM', { locale: ptBR })}`,
              leadName: lead.full_name,
              timeAgo: 'Amanhã',
              priority: 'medium',
            });
          }
        }
      });

      setAlerts(generatedAlerts.slice(0, 10));

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

  // Calculate agent stats
  const getAgentCounters = (agentUserId: string) => {
    const agentLeads = leads.filter((l) => l.assigned_agent_id === agentUserId);
    return [
      { label: 'Confirmado', value: agentLeads.filter((l) => l.status === 'confirmado').length, colorClass: 'bg-success/10 text-success' },
      { label: 'Comparecido', value: agentLeads.filter((l) => l.status === 'compareceu').length, colorClass: 'bg-info/10 text-info' },
      { label: 'Fechado', value: agentLeads.filter((l) => l.status === 'matriculado').length, colorClass: 'bg-violet-500/10 text-violet-600' },
      { label: 'Em Espera', value: agentLeads.filter((l) => ['agendado', 'em_atendimento', 'lead'].includes(l.status)).length, colorClass: 'bg-warning/10 text-warning' },
    ];
  };

  // Summary panel totals
  const summaryTotals = useMemo(() => {
    const now = new Date();
    return {
      total: filteredLeadsByDate.length,
      confirmados: filteredLeadsByDate.filter((l) => l.status === 'confirmado').length,
      agendados: filteredLeadsByDate.filter((l) => l.status === 'agendado').length,
      semResposta: filteredLeadsByDate.filter((l) => l.status === 'em_atendimento' && differenceInHours(now, new Date(l.updated_at)) > 24).length,
      atrasados: filteredLeadsByDate.filter((l) => l.status === 'lead' && differenceInHours(now, new Date(l.updated_at)) > 12).length,
      declinou: filteredLeadsByDate.filter((l) => l.status === 'perdido').length,
      limbo: 0,
    };
  }, [filteredLeadsByDate]);

  // Status bar segments
  const statusSegments: StatusSegment[] = useMemo(() => [
    { key: 'confirmado', label: 'Confirmado', count: filteredLeadsByDate.filter((l) => l.status === 'confirmado').length, colorClass: 'bg-success' },
    { key: 'agendado', label: 'Pendente', count: filteredLeadsByDate.filter((l) => l.status === 'agendado').length, colorClass: 'bg-warning' },
    { key: 'em_atendimento', label: 'Sem Resposta', count: filteredLeadsByDate.filter((l) => l.status === 'em_atendimento').length, colorClass: 'bg-info' },
    { key: 'lead', label: 'Novos', count: filteredLeadsByDate.filter((l) => l.status === 'lead').length, colorClass: 'bg-primary' },
    { key: 'perdido', label: 'Declinou', count: filteredLeadsByDate.filter((l) => l.status === 'perdido').length, colorClass: 'bg-destructive' },
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
          <span className="text-sm text-muted-foreground">({agents.length})</span>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                id={agent.id}
                name={agent.full_name}
                avatarUrl={agent.avatar_url}
                counters={getAgentCounters(agent.user_id)}
              />
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
                  counters={[
                    { label: 'Atendidos', value: 0, colorClass: 'bg-warning/10 text-warning' },
                    { label: 'Finalizados', value: 0, colorClass: 'bg-success/10 text-success' },
                  ]}
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
                  counters={[]}
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

      {/* Bottom Grid: Table + Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RelationshipTable
          leads={filteredLeads.slice(0, 20)}
          agents={agents}
          onLeadClick={(lead) => console.log('Lead clicked:', lead)}
        />
        <OperationalAlerts alerts={alerts} />
      </div>

      {/* Add Agent Dialog */}
      <AddAgentDialog
        open={showAddAgentDialog}
        onOpenChange={setShowAddAgentDialog}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
}
