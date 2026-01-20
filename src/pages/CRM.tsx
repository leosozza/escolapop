import { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Phone, Mail, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Lead, LeadStatus } from '@/types/database';
import { LEAD_STATUS_CONFIG } from '@/types/database';
import { AddLeadDialog } from '@/components/crm/AddLeadDialog';

const PIPELINE_COLUMNS: LeadStatus[] = [
  'lead',
  'em_atendimento',
  'agendado',
  'confirmado',
  'compareceu',
  'proposta',
  'matriculado',
  'perdido',
];

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const { toast } = useToast();

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          course:courses(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads((data as Lead[]) || []);
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

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: LeadStatus) => {
    if (!draggedLead || draggedLead.status === status) {
      setDraggedLead(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', draggedLead.id);

      if (error) throw error;

      setLeads(leads.map(lead =>
        lead.id === draggedLead.id ? { ...lead, status } : lead
      ));

      toast({
        title: 'Lead atualizado!',
        description: `${draggedLead.full_name} movido para ${LEAD_STATUS_CONFIG[status].label}`,
      });
    } catch (error) {
      console.error('Error updating lead:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao mover lead',
        description: 'Tente novamente.',
      });
    } finally {
      setDraggedLead(null);
    }
  };

  const filteredLeads = leads.filter(lead =>
    lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.phone.includes(searchQuery) ||
    lead.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLeadsByStatus = (status: LeadStatus) =>
    filteredLeads.filter(lead => lead.status === status);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline CRM</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads e oportunidades
          </p>
        </div>
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
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
          <Button 
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((status) => {
          const statusConfig = LEAD_STATUS_CONFIG[status];
          const columnLeads = getLeadsByStatus(status);

          return (
            <div
              key={status}
              className="flex-shrink-0 w-72"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(status)}
            >
              <Card className="border-0 shadow-md h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${statusConfig.bgColor.replace('/10', '')}`} />
                      {statusConfig.label}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {columnLeads.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead)}
                      className={`kanban-card p-4 rounded-lg bg-background border cursor-grab active:cursor-grabbing ${
                        draggedLead?.id === lead.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gradient-primary text-white text-xs">
                              {getInitials(lead.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{lead.full_name}</p>
                            {lead.course && (
                              <p className="text-xs text-muted-foreground">
                                {(lead.course as { name: string }).name}
                              </p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Agendar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {lead.phone}
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </div>
                      )}
                      {lead.scheduled_at && (
                        <div className="flex items-center gap-2 text-xs text-primary mt-2">
                          <Calendar className="h-3 w-3" />
                          {new Date(lead.scheduled_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum lead
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      <AddLeadDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchLeads}
      />
    </div>
  );
}
