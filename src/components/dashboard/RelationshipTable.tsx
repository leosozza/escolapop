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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Target } from 'lucide-react';
import { useMemo, useState } from 'react';

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
  em_atendimento: { bg: 'bg-warning/10', text: 'text-warning', label: 'Em Atendimento' },
  agendado: { bg: 'bg-primary/10', text: 'text-primary', label: 'Agendado' },
  confirmado: { bg: 'bg-success/10', text: 'text-success', label: 'Confirmado' },
  compareceu: { bg: 'bg-accent/10', text: 'text-accent-foreground', label: 'Compareceu' },
  proposta: { bg: 'bg-secondary/10', text: 'text-secondary-foreground', label: 'Proposta' },
  matriculado: { bg: 'bg-success/10', text: 'text-success', label: 'Matriculado' },
  perdido: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Perdido' },
};

// Tab configuration with priority order
const TABS = [
  { key: 'todos', label: 'Todos', statuses: null },
  { key: 'agendado', label: 'Agendados', statuses: ['agendado'] },
  { key: 'confirmado', label: 'Confirmados', statuses: ['confirmado'] },
  { key: 'compareceu', label: 'Compareceram', statuses: ['compareceu'] },
  { key: 'proposta', label: 'Proposta', statuses: ['proposta'] },
  { key: 'em_atendimento', label: 'Aguardando', statuses: ['em_atendimento', 'lead'] },
  { key: 'matriculado', label: 'Matriculados', statuses: ['matriculado'] },
  { key: 'perdido', label: 'Perdidos', statuses: ['perdido'] },
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

export function RelationshipTable({ leads, agents, onLeadClick, className }: RelationshipTableProps) {
  const [activeTab, setActiveTab] = useState('todos');

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
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(lead.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{lead.full_name}</span>
                  </div>
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
