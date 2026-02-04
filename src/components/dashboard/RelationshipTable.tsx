import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Target, Clock, User, MessageSquare, Loader2 } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Agent {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface Lead {
  id: string;
  full_name: string;
  status: string;
  updated_at: string;
  scheduled_at?: string | null;
  assigned_agent_id?: string | null;
}

interface RelationshipTableProps {
  leads: Lead[];
  agents: Agent[];
  onLeadClick?: (lead: Lead) => void;
  className?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  lead: { bg: 'bg-info/10', text: 'text-info', label: 'Novo' },
  em_atendimento: { bg: 'bg-warning/10', text: 'text-warning', label: 'Sem Resposta' },
  agendado: { bg: 'bg-primary/10', text: 'text-primary', label: 'Agendado' },
  aguardando_confirmacao: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', label: 'Aguardando Confirm.' },
  confirmado: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Confirmado' },
  atrasado: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Atrasado' },
  compareceu: { bg: 'bg-teal-500/10', text: 'text-teal-600', label: 'Compareceu' },
  fechado: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Fechado' },
  nao_fechado: { bg: 'bg-orange-500/10', text: 'text-orange-600', label: 'Não Fechado' },
  proposta: { bg: 'bg-secondary/10', text: 'text-secondary-foreground', label: 'Proposta' },
  reagendar: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Reagendar' },
  declinou: { bg: 'bg-rose-500/10', text: 'text-rose-600', label: 'Declinou' },
  limbo: { bg: 'bg-muted/50', text: 'text-muted-foreground', label: 'Limbo' },
  matriculado: { bg: 'bg-success/10', text: 'text-success', label: 'Matriculado' },
  perdido: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Perdido' },
};

// Tab configuration - Commercial workflow order
const TABS = [
  { key: 'agendado', label: 'Agendado', statuses: ['agendado'], area: 'agente' },
  { key: 'confirmado', label: 'Confirmado', statuses: ['confirmado'], area: 'agente' },
  { key: 'aguardando_confirmacao', label: 'Aguard. Confirm.', statuses: ['aguardando_confirmacao'], area: 'agente' },
  { key: 'atrasado', label: 'Atrasado', statuses: ['atrasado'], area: 'auto' },
  { key: 'compareceu', label: 'Compareceu', statuses: ['compareceu'], area: 'recepcao' },
  { key: 'fechado', label: 'Fechado', statuses: ['fechado'], area: 'recepcao' },
  { key: 'nao_fechado', label: 'Não Fechado', statuses: ['nao_fechado'], area: 'recepcao' },
  { key: 'reagendar', label: 'Reagendar', statuses: ['reagendar'], area: 'auto' },
  { key: 'declinou', label: 'Declinou', statuses: ['declinou'], area: 'agente' },
  { key: 'todos', label: 'Todos', statuses: null, area: 'all' },
];

const ROW_COLORS = [
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-orange-500',
];

interface LeadHistoryEntry {
  id: string;
  to_status: string;
  from_status: string | null;
  created_at: string;
  notes: string | null;
  changed_by: string | null;
}

export function RelationshipTable({ leads, agents, onLeadClick, className }: RelationshipTableProps) {
  const [activeTab, setActiveTab] = useState('todos');
  const [hoveredLeadHistory, setHoveredLeadHistory] = useState<LeadHistoryEntry | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyCache, setHistoryCache] = useState<Record<string, LeadHistoryEntry | null>>({});

  const getAgentById = (agentId: string | null | undefined) => {
    if (!agentId) return null;
    return agents.find((a) => a.user_id === agentId);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), "dd/MM 'às' HH:mm", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  // Fetch last history entry for a lead
  const fetchLeadHistory = useCallback(async (leadId: string) => {
    // Check cache first
    if (historyCache[leadId] !== undefined) {
      setHoveredLeadHistory(historyCache[leadId]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('lead_history')
        .select('id, to_status, from_status, created_at, notes, changed_by')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const historyEntry = data as LeadHistoryEntry | null;
      setHistoryCache(prev => ({ ...prev, [leadId]: historyEntry }));
      setHoveredLeadHistory(historyEntry);
    } catch (error) {
      console.error('Error fetching lead history:', error);
      setHoveredLeadHistory(null);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyCache]);

  // Get tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TABS.forEach((tab) => {
      if (tab.statuses === null) {
        counts[tab.key] = leads.length;
      } else {
        counts[tab.key] = leads.filter((l) => tab.statuses!.includes(l.status)).length;
      }
    });
    return counts;
  }, [leads]);

  // Filter leads by active tab
  const filteredLeads = useMemo(() => {
    const activeTabConfig = TABS.find((t) => t.key === activeTab);
    if (!activeTabConfig || activeTabConfig.statuses === null) return leads;
    return leads.filter((l) => activeTabConfig.statuses!.includes(l.status));
  }, [leads, activeTab]);

  const renderTable = (leadsToRender: Lead[]) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30">
          <TableHead className="w-12">#</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead>Agente</TableHead>
          <TableHead>Data/Hora</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leadsToRender.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              Nenhum lead encontrado
            </TableCell>
          </TableRow>
        ) : (
          leadsToRender.map((lead, index) => {
            const agent = getAgentById(lead.assigned_agent_id);
            const statusStyle = STATUS_STYLES[lead.status] || STATUS_STYLES.lead;
            const rowColor = ROW_COLORS[index % ROW_COLORS.length];

            return (
              <TableRow
                key={lead.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onLeadClick?.(lead)}
              >
                <TableCell>
                  <div
                    className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold',
                      rowColor
                    )}
                  >
                    {index + 1}
                  </div>
                </TableCell>
                <TableCell>
                  <HoverCard openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <div 
                        className="flex items-center gap-2 cursor-pointer"
                        onMouseEnter={() => fetchLeadHistory(lead.id)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(lead.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium hover:underline">{lead.full_name}</span>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" side="right" align="start">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-semibold">Última Atualização</h4>
                        </div>
                        
                        {isLoadingHistory ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : hoveredLeadHistory ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {hoveredLeadHistory.from_status && (
                                <>
                                  <Badge variant="outline" className="text-xs">
                                    {STATUS_STYLES[hoveredLeadHistory.from_status]?.label || hoveredLeadHistory.from_status}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">→</span>
                                </>
                              )}
                              <Badge className={cn(
                                STATUS_STYLES[hoveredLeadHistory.to_status]?.bg,
                                STATUS_STYLES[hoveredLeadHistory.to_status]?.text,
                                'text-xs'
                              )}>
                                {STATUS_STYLES[hoveredLeadHistory.to_status]?.label || hoveredLeadHistory.to_status}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(hoveredLeadHistory.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            </div>
                            
                            {hoveredLeadHistory.notes && (
                              <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                                <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                                <p className="text-xs text-muted-foreground">{hoveredLeadHistory.notes}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground">Nenhum histórico encontrado</p>
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell>
                  {agent ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={agent.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(agent.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
                        {agent.full_name.split(' ')[0]}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(lead.scheduled_at || lead.updated_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge className={cn(statusStyle.bg, statusStyle.text, 'font-medium')}>
                    {statusStyle.label}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  return (
    <Card className={cn('border-0 shadow-md', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-5 w-5 text-primary" />
          Carteira de Leads
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 pb-2">
            <ScrollArea className="w-full">
              <TabsList className="inline-flex h-9 w-auto gap-1 bg-muted/50 p-1">
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="text-xs px-3 data-[state=active]:bg-background whitespace-nowrap"
                  >
                    {tab.label}
                    {tabCounts[tab.key] > 0 && (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "ml-1.5 h-5 min-w-[20px] px-1.5 text-xs",
                          activeTab === tab.key ? "bg-primary/10 text-primary" : ""
                        )}
                      >
                        {tabCounts[tab.key]}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </div>
          <TabsContent value={activeTab} className="mt-0">
            <ScrollArea className="h-[500px]">
              {renderTable(filteredLeads)}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
