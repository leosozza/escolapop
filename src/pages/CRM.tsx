import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Maximize2, Minimize2, List, Kanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { LeadStatus } from '@/types/database';
import { LEAD_STATUS_CONFIG } from '@/types/database';
import { ExtendedLead, LeadSource } from '@/types/crm';
import { LeadHistorySheet } from '@/components/leads/LeadHistorySheet';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { LeadSourceManager } from '@/components/crm/LeadSourceManager';
import { CustomFieldsManager } from '@/components/crm/CustomFieldsManager';
import { CSVImportDialog } from '@/components/crm/CSVImportDialog';
import { LeadListView } from '@/components/crm/LeadListView';
import { LeadKanbanView } from '@/components/crm/LeadKanbanView';
import { QuickLeadForm } from '@/components/crm/QuickLeadForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

// Commercial workflow tabs
const STATUS_TABS: { key: LeadStatus | 'todos'; label: string; color: string }[] = [
  { key: 'agendado', label: 'Agendado', color: 'bg-blue-500' },
  { key: 'confirmado', label: 'Confirmado', color: 'bg-green-500' },
  { key: 'aguardando_confirmacao', label: 'Aguard. Confirm.', color: 'bg-yellow-500' },
  { key: 'atrasado', label: 'Atrasado', color: 'bg-red-500' },
  { key: 'compareceu', label: 'Compareceu', color: 'bg-teal-500' },
  { key: 'fechado', label: 'Fechado', color: 'bg-emerald-500' },
  { key: 'nao_fechado', label: 'Não Fechado', color: 'bg-orange-500' },
  { key: 'reagendar', label: 'Reagendar', color: 'bg-amber-500' },
  { key: 'declinou', label: 'Declinou', color: 'bg-rose-500' },
  { key: 'todos', label: 'Todos', color: 'bg-primary' },
];

// Convert ExtendedLead to format for history sheet
const toLeadData = (lead: ExtendedLead) => ({
  id: lead.id,
  full_name: lead.full_name,
  phone: lead.phone,
  email: lead.email,
  guardian_name: lead.guardian_name,
  source: lead.lead_source?.name || lead.source || 'outro',
  status: lead.status as LeadStatus,
  notes: lead.notes,
  scheduled_at: lead.scheduled_at,
  created_at: lead.created_at,
  updated_at: lead.updated_at,
  course: lead.course,
});

export default function CRM() {
  const [leads, setLeads] = useState<ExtendedLead[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LeadStatus | 'todos'>('agendado');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Dialog states
  const [selectedLead, setSelectedLead] = useState<ExtendedLead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<ExtendedLead | null>(null);
  
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          course:courses(name),
          lead_source:lead_sources(*)
        `)
        .neq('status', 'matriculado') // Exclude enrolled students from commercial portfolio
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch agents separately for leads that have assigned_agent_id
      const leadsWithAgent = data || [];
      const agentIds = [...new Set(leadsWithAgent.filter(l => l.assigned_agent_id).map(l => l.assigned_agent_id))];
      
      let agentsMap: Record<string, { full_name: string }> = {};
      if (agentIds.length > 0) {
        const { data: agentsData } = await supabase
          .from('agents')
          .select('id, full_name')
          .in('id', agentIds);
        
        if (agentsData) {
          agentsMap = agentsData.reduce((acc, agent) => {
            acc[agent.id] = { full_name: agent.full_name };
            return acc;
          }, {} as Record<string, { full_name: string }>);
        }
      }

      // Merge agent data into leads
      const enrichedLeads = leadsWithAgent.map(lead => ({
        ...lead,
        agent: lead.assigned_agent_id ? agentsMap[lead.assigned_agent_id] : null,
      }));

      setLeads(enrichedLeads as ExtendedLead[]);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar leads',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSources = async () => {
    const { data } = await supabase
      .from('lead_sources')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (data) {
      setSources(data as LeadSource[]);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchSources();
  }, []);

  const handleStatusChange = async (lead: ExtendedLead, newStatus: LeadStatus) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', lead.id);

      if (error) throw error;

      setLeads(leads.map(l =>
        l.id === lead.id ? { ...l, status: newStatus } : l
      ));

      toast({
        title: 'Lead atualizado!',
        description: `${lead.full_name} movido para ${LEAD_STATUS_CONFIG[newStatus]?.label || newStatus}`,
      });
    } catch (error) {
      console.error('Error updating lead:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao mover lead',
        description: 'Tente novamente.',
      });
    }
  };

  const handleDelete = async () => {
    if (!leadToDelete) return;

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadToDelete.id);

      if (error) throw error;

      setLeads(leads.filter(l => l.id !== leadToDelete.id));
      toast({ title: 'Lead excluído com sucesso' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir lead',
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setLeadToDelete(null);
    }
  };

  // Get counts by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: leads.length };
    STATUS_TABS.forEach(tab => {
      if (tab.key !== 'todos') {
        counts[tab.key] = leads.filter(l => l.status === tab.key).length;
      }
    });
    return counts;
  }, [leads]);

  // Filter leads by search and active tab
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = 
        lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.guardian_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = activeTab === 'todos' || lead.status === activeTab;
      
      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, activeTab]);

  const handleViewDetails = (lead: ExtendedLead) => {
    setSelectedLead(lead);
    setIsDetailsOpen(true);
  };

  const handleEdit = (lead: ExtendedLead) => {
    setSelectedLead(lead);
    setIsEditOpen(true);
  };

  const handleSchedule = (lead: ExtendedLead) => {
    toast({ title: 'Funcionalidade de agendamento em desenvolvimento' });
  };

  const handleDeleteRequest = (lead: ExtendedLead) => {
    setLeadToDelete(lead);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const MainContent = () => (
    <div className={cn(
      "space-y-4 animate-fade-in",
      isFullscreen && "p-6"
    )}>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carteira Comercial</h1>
          <p className="text-muted-foreground text-sm">
            {leads.length} leads no pipeline comercial
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'list' ? 'kanban' : 'list')}
            title={viewMode === 'list' ? 'Visualizar Kanban' : 'Visualizar Lista'}
          >
            {viewMode === 'list' ? <Kanban className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Quick Lead Form */}
      <QuickLeadForm onSuccess={fetchLeads} />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            className="pl-10 w-full md:w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LeadSourceManager />
          <CustomFieldsManager />
          <CSVImportDialog onSuccess={fetchLeads} />
        </div>
      </div>

      {/* Status Tabs */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeadStatus | 'todos')}>
            <div className="px-4 pt-4">
              <ScrollArea className="w-full">
                <TabsList className="inline-flex h-10 w-auto gap-1 bg-muted/50 p-1">
                  {STATUS_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className="text-xs px-3 data-[state=active]:bg-background whitespace-nowrap gap-2"
                    >
                      <div className={cn("w-2 h-2 rounded-full", tab.color)} />
                      {tab.label}
                      {statusCounts[tab.key] > 0 && (
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "ml-1 h-5 min-w-[20px] px-1.5 text-xs",
                            activeTab === tab.key ? "bg-primary/10 text-primary" : ""
                          )}
                        >
                          {statusCounts[tab.key]}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            <TabsContent value={activeTab} className="mt-0 p-4">
              {viewMode === 'list' ? (
                <ScrollArea className={isFullscreen ? "h-[calc(100vh-280px)]" : "h-[500px]"}>
                  <LeadListView
                    leads={filteredLeads}
                    sources={sources}
                    onViewDetails={handleViewDetails}
                    onEdit={handleEdit}
                    onSchedule={handleSchedule}
                    onDelete={handleDeleteRequest}
                    isAdmin={isAdmin()}
                  />
                </ScrollArea>
              ) : (
                <ScrollArea className={isFullscreen ? "h-[calc(100vh-280px)]" : "h-[600px]"}>
                  <LeadKanbanView
                    leads={filteredLeads}
                    sources={sources}
                    onViewDetails={handleViewDetails}
                    onEdit={handleEdit}
                    onSchedule={handleSchedule}
                    onStatusChange={handleStatusChange}
                  />
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      {isFullscreen ? (
        <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
          <DialogContent className="max-w-[98vw] w-full h-[95vh] overflow-hidden p-0">
            <MainContent />
          </DialogContent>
        </Dialog>
      ) : (
        <MainContent />
      )}

      {/* Dialogs */}
      <LeadHistorySheet
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        lead={selectedLead ? toLeadData(selectedLead) : null}
        onEdit={() => {
          setIsDetailsOpen(false);
          setIsEditOpen(true);
        }}
        onSchedule={() => {
          setIsDetailsOpen(false);
          if (selectedLead) handleSchedule(selectedLead);
        }}
      />

      {selectedLead && (
        <EditLeadDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          lead={{
            ...selectedLead,
            source: (selectedLead.lead_source?.name?.toLowerCase() || selectedLead.source || 'outro') as any,
            status: selectedLead.status as any,
          }}
          onSuccess={fetchLeads}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead "{leadToDelete?.full_name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
