import { useState, useEffect } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead, LeadStatus } from '@/types/database';
import { LEAD_STATUS_CONFIG } from '@/types/database';
import { ExtendedLead, LeadSource, CRMViewMode } from '@/types/crm';
import { AddLeadDialog } from '@/components/crm/AddLeadDialog';
import { LeadDetailsSheet } from '@/components/leads/LeadDetailsSheet';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { ViewToggle } from '@/components/crm/ViewToggle';
import { LeadSourceManager } from '@/components/crm/LeadSourceManager';
import { CustomFieldsManager } from '@/components/crm/CustomFieldsManager';
import { CSVImportDialog } from '@/components/crm/CSVImportDialog';
import { LeadListView } from '@/components/crm/LeadListView';
import { LeadKanbanView } from '@/components/crm/LeadKanbanView';
import { LeadPipelineView } from '@/components/crm/LeadPipelineView';
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

// Convert ExtendedLead to Lead for legacy components
const toBaseLead = (lead: ExtendedLead): Lead => ({
  ...lead,
  source: (lead.lead_source?.name?.toLowerCase() || lead.source || 'outro') as Lead['source'],
  status: lead.status as Lead['status'],
});

export default function CRM() {
  const [leads, setLeads] = useState<ExtendedLead[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<CRMViewMode>('kanban');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | null>(null);
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads((data as ExtendedLead[]) || []);
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
        description: `${lead.full_name} movido para ${LEAD_STATUS_CONFIG[newStatus].label}`,
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

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.guardian_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (lead: ExtendedLead) => {
    setSelectedLead(lead);
    setIsDetailsOpen(true);
  };

  const handleEdit = (lead: ExtendedLead) => {
    setSelectedLead(lead);
    setIsEditOpen(true);
  };

  const handleSchedule = (lead: ExtendedLead) => {
    // TODO: Implementar agendamento
    toast({ title: 'Funcionalidade de agendamento em desenvolvimento' });
  };

  const handleDeleteRequest = (lead: ExtendedLead) => {
    setLeadToDelete(lead);
    setIsDeleteDialogOpen(true);
  };

  const handlePipelineStageClick = (status: LeadStatus) => {
    setStatusFilter(status);
    setViewMode('list');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline CRM</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads e oportunidades • {leads.length} leads totais
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {statusFilter && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setStatusFilter(null)}
            >
              Limpar filtro: {LEAD_STATUS_CONFIG[statusFilter].label}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LeadSourceManager />
          <CustomFieldsManager />
          <CSVImportDialog onSuccess={fetchLeads} />
          <Button 
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Views */}
      {viewMode === 'list' && (
        <LeadListView
          leads={filteredLeads}
          sources={sources}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
          onSchedule={handleSchedule}
          onDelete={handleDeleteRequest}
          isAdmin={isAdmin()}
        />
      )}

      {viewMode === 'kanban' && (
        <LeadKanbanView
          leads={filteredLeads}
          sources={sources}
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
          onSchedule={handleSchedule}
          onStatusChange={handleStatusChange}
        />
      )}

      {viewMode === 'pipeline' && (
        <LeadPipelineView
          leads={filteredLeads}
          onStageClick={handlePipelineStageClick}
        />
      )}

      {/* Dialogs */}
      <AddLeadDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchLeads}
      />

      <LeadDetailsSheet
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        lead={selectedLead ? toBaseLead(selectedLead) : null}
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
          lead={toBaseLead(selectedLead)}
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
    </div>
  );
}
