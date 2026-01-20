import { useState, useEffect } from 'react';
import { 
  Users, 
  Target, 
  TrendingUp, 
  Calendar,
  Sparkles,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Handshake,
  Camera,
  Eye,
  GraduationCap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LEAD_STATUS_CONFIG, ROLE_CONFIG } from '@/types/database';
import { FunnelKPIs } from '@/components/dashboard/FunnelKPIs';
import { TeamPerformanceGrid } from '@/components/dashboard/TeamPerformanceGrid';
import { OperationalAlerts } from '@/components/dashboard/OperationalAlerts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, subHours, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FunnelData {
  lead: number;
  em_atendimento: number;
  agendado: number;
  confirmado: number;
  compareceu: number;
  proposta: number;
  matriculado: number;
  perdido: number;
}

interface StaffMember {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

interface LeadWithAgent {
  id: string;
  full_name: string;
  status: string;
  updated_at: string;
  assigned_agent_id: string | null;
  agent?: { full_name: string } | null;
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
  const [funnelData, setFunnelData] = useState<FunnelData>({
    lead: 0,
    em_atendimento: 0,
    agendado: 0,
    confirmado: 0,
    compareceu: 0,
    proposta: 0,
    matriculado: 0,
    perdido: 0,
  });
  const [agents, setAgents] = useState<StaffMember[]>([]);
  const [producers, setProducers] = useState<StaffMember[]>([]);
  const [scouters, setScouters] = useState<StaffMember[]>([]);
  const [recentLeads, setRecentLeads] = useState<LeadWithAgent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [agentStats, setAgentStats] = useState<Record<string, { agendados: number; confirmados: number }>>({});
  const [producerStats, setProducerStats] = useState<Record<string, { atendidos: number; finalizados: number }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    
    // Real-time subscription for leads changes
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
      // Fetch all leads
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, full_name, status, updated_at, assigned_agent_id, scheduled_at')
        .order('updated_at', { ascending: false });

      // Calculate funnel data
      const funnel: FunnelData = {
        lead: 0,
        em_atendimento: 0,
        agendado: 0,
        confirmado: 0,
        compareceu: 0,
        proposta: 0,
        matriculado: 0,
        perdido: 0,
      };

      (leadsData || []).forEach((lead) => {
        if (funnel.hasOwnProperty(lead.status)) {
          funnel[lead.status as keyof FunnelData]++;
        }
      });

      setFunnelData(funnel);
      setRecentLeads((leadsData?.slice(0, 10) as LeadWithAgent[]) || []);

      // Generate alerts
      const generatedAlerts: Alert[] = [];
      const now = new Date();

      (leadsData || []).forEach((lead) => {
        const hoursAgo = differenceInHours(now, new Date(lead.updated_at));

        // No response for >24 hours
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

        // Overdue scheduling
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

        // Pending confirmation for tomorrow
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

      // Calculate agent stats
      const agentStatsMap: Record<string, { agendados: number; confirmados: number }> = {};
      staffMap.agente_comercial.forEach(agent => {
        const agentLeads = (leadsData || []).filter(l => l.assigned_agent_id === agent.user_id);
        agentStatsMap[agent.id] = {
          agendados: agentLeads.filter(l => l.status === 'agendado').length,
          confirmados: agentLeads.filter(l => l.status === 'confirmado').length,
        };
      });
      setAgentStats(agentStatsMap);

      // Fetch producer stats from appointments
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('agent_id, attended')
        .eq('scheduled_date', today);

      const producerStatsMap: Record<string, { atendidos: number; finalizados: number }> = {};
      staffMap.produtor.forEach(producer => {
        const producerAppointments = (appointmentsData || []).filter(a => a.agent_id === producer.id);
        producerStatsMap[producer.id] = {
          atendidos: producerAppointments.filter(a => a.attended === null).length,
          finalizados: producerAppointments.filter(a => a.attended === true).length,
        };
      });
      setProducerStats(producerStatsMap);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalLeads = Object.values(funnelData).reduce((a, b) => a + b, 0);
  const conversionRate = totalLeads > 0 ? (funnelData.matriculado / totalLeads) * 100 : 0;

  const funnelSteps = [
    { label: 'Novos Leads', value: funnelData.lead, icon: Users, color: 'text-info', bgColor: 'bg-info/10' },
    { label: 'Em Atendimento', value: funnelData.em_atendimento, icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' },
    { label: 'Agendados', value: funnelData.agendado, icon: Calendar, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Confirmados', value: funnelData.confirmado, icon: CheckCircle2, color: 'text-accent', bgColor: 'bg-accent/10' },
    { label: 'Compareceram', value: funnelData.compareceu, icon: UserCheck, color: 'text-success', bgColor: 'bg-success/10' },
    { label: 'Proposta', value: funnelData.proposta, icon: Handshake, color: 'text-secondary', bgColor: 'bg-secondary/10' },
    { label: 'Matriculados', value: funnelData.matriculado, icon: GraduationCap, color: 'text-success', bgColor: 'bg-success/10', percentage: conversionRate },
    { label: 'Perdidos', value: funnelData.perdido, icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  ];

  const formatTimeAgo = (dateString: string) => {
    const hours = differenceInHours(new Date(), new Date(dateString));
    if (hours < 1) return 'Agora';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Olá, {profile?.full_name?.split(' ')[0] ?? 'Usuário'}! 👋
          </h1>
          <p className="text-muted-foreground">
            Dashboard Gerencial • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-primary text-white">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">Visão Geral</span>
        </div>
      </div>

      {/* Funnel KPIs */}
      <FunnelKPIs steps={funnelSteps} className="grid-cols-4 lg:grid-cols-8" />

      {/* Team Performance Grids */}
      <div className="grid gap-6 lg:grid-cols-3">
        <TeamPerformanceGrid
          title="Agentes de Relacionamento"
          icon={Handshake}
          members={agents.map(agent => ({
            id: agent.id,
            name: agent.full_name,
            role: ROLE_CONFIG.agente_comercial.label,
            avatarUrl: agent.avatar_url,
            status: 'online' as const,
            counters: [
              { label: 'Agend.', value: agentStats[agent.id]?.agendados || 0, color: 'bg-primary/10 text-primary' },
              { label: 'Conf.', value: agentStats[agent.id]?.confirmados || 0, color: 'bg-success/10 text-success' },
            ],
          }))}
          emptyMessage="Nenhum agente cadastrado"
        />

        <TeamPerformanceGrid
          title="Produtores"
          icon={Camera}
          members={producers.map(producer => ({
            id: producer.id,
            name: producer.full_name,
            role: ROLE_CONFIG.produtor.label,
            avatarUrl: producer.avatar_url,
            status: 'online' as const,
            counters: [
              { label: 'Atend.', value: producerStats[producer.id]?.atendidos || 0, color: 'bg-warning/10 text-warning' },
              { label: 'Final.', value: producerStats[producer.id]?.finalizados || 0, color: 'bg-success/10 text-success' },
            ],
          }))}
          emptyMessage="Nenhum produtor cadastrado"
        />

        <TeamPerformanceGrid
          title="Scouters"
          icon={Eye}
          members={scouters.map(scouter => ({
            id: scouter.id,
            name: scouter.full_name,
            role: ROLE_CONFIG.scouter.label,
            avatarUrl: scouter.avatar_url,
            status: 'online' as const,
            counters: [],
          }))}
          emptyMessage="Nenhum scouter cadastrado"
        />
      </div>

      {/* Bottom Grid: Table + Alerts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* General Portfolio Table */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-primary" />
              Carteira Geral
            </CardTitle>
            <CardDescription>Últimas movimentações</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLeads.map((lead) => {
                    const statusConfig = LEAD_STATUS_CONFIG[lead.status as keyof typeof LEAD_STATUS_CONFIG];
                    return (
                      <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{lead.full_name}</TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig?.bgColor} ${statusConfig?.color}`}>
                            {statusConfig?.label || lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatTimeAgo(lead.updated_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Operational Alerts */}
        <OperationalAlerts alerts={alerts} />
      </div>
    </div>
  );
}
