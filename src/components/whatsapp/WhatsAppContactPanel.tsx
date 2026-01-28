import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Search,
  Plus,
  Phone,
  User,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AddWhatsAppContactDialog } from './AddWhatsAppContactDialog';
import { WhatsAppConversation } from './WhatsAppConversation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tables } from '@/integrations/supabase/types';

type LeadStatus = Tables<'leads'>['status'];

interface Agent {
  id: string;
  full_name: string;
}

interface WhatsAppContact {
  id: string;
  full_name: string;
  guardian_name: string | null;
  phone: string;
  email: string | null;
  source: string;
  status: LeadStatus;
  external_id: string | null;
  external_source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assigned_agent_id: string | null;
  agent?: Agent | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lead: { label: 'Novo Lead', color: 'bg-blue-500' },
  em_atendimento: { label: 'Em Atendimento', color: 'bg-yellow-500' },
  agendado: { label: 'Agendado', color: 'bg-purple-500' },
  confirmado: { label: 'Confirmado', color: 'bg-green-500' },
  compareceu: { label: 'Compareceu', color: 'bg-emerald-600' },
  proposta: { label: 'Proposta', color: 'bg-orange-500' },
  matriculado: { label: 'Matriculado', color: 'bg-teal-500' },
  perdido: { label: 'Perdido', color: 'bg-destructive' },
};

export function WhatsAppContactPanel() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<WhatsAppContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
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
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          full_name,
          guardian_name,
          phone,
          email,
          source,
          status,
          external_id,
          external_source,
          notes,
          created_at,
          updated_at,
          assigned_agent_id
        `)
        .not('status', 'eq', 'matriculado')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch agents separately
      const agentIds = [...new Set((data || []).map(l => l.assigned_agent_id).filter(Boolean))];
      let agentsMap: Record<string, Agent> = {};
      
      if (agentIds.length > 0) {
        const { data: agentsData } = await supabase
          .from('agents')
          .select('id, full_name')
          .in('id', agentIds);
        
        agentsMap = (agentsData || []).reduce((acc, agent) => {
          acc[agent.id] = agent;
          return acc;
        }, {} as Record<string, Agent>);
      }

      const contactsWithAgents: WhatsAppContact[] = (data || []).map(lead => ({
        ...lead,
        agent: lead.assigned_agent_id ? agentsMap[lead.assigned_agent_id] : null,
      }));

      setContacts(contactsWithAgents);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = contacts;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.full_name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          c.guardian_name?.toLowerCase().includes(query) ||
          c.external_id?.toLowerCase().includes(query)
      );
    }

    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter((c) => c.status === activeTab);
    }

    setFilteredContacts(filtered);
  };

  const handleContactCreated = () => {
    fetchContacts();
    setIsAddDialogOpen(false);
    toast({
      title: 'Contato adicionado',
      description: 'Pronto para iniciar a conversa no WhatsApp.',
    });
  };

  const handleStatusUpdate = async (contactId: string, newStatus: LeadStatus) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', contactId);

      if (error) throw error;

      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, status: newStatus } : c))
      );

      if (selectedContact?.id === contactId) {
        setSelectedContact((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      toast({
        title: 'Status atualizado',
        description: `Tabulação alterada para ${STATUS_CONFIG[newStatus]?.label || newStatus}`,
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
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  return (
    <div className="h-full flex gap-4">
      {/* Lista de Contatos */}
      <Card className="w-[400px] flex flex-col border-0 shadow-md">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              WhatsApp
            </CardTitle>
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, telefone ou código..."
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
              <TabsTrigger value="agendado" className="text-xs py-1.5">
                Agendados
              </TabsTrigger>
              <TabsTrigger value="em_atendimento" className="text-xs py-1.5">
                Atendendo
              </TabsTrigger>
              <TabsTrigger value="confirmado" className="text-xs py-1.5">
                Confirmados
              </TabsTrigger>
            </TabsList>
          </div>

          <CardContent className="flex-1 p-0 mt-3">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="px-4 pb-4 space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando contatos...
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="mx-auto h-10 w-10 opacity-50 mb-2" />
                    <p>Nenhum contato encontrado</p>
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
                              STATUS_CONFIG[contact.status]?.color || 'bg-muted'
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{contact.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {contact.guardian_name || contact.phone}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 text-white',
                              STATUS_CONFIG[contact.status]?.color
                            )}
                          >
                            {STATUS_CONFIG[contact.status]?.label || contact.status}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(contact.updated_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
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
        <WhatsAppConversation
          contact={selectedContact}
          onStatusChange={handleStatusUpdate}
          onOpenWhatsApp={() => openWhatsApp(selectedContact.phone)}
        />
      ) : (
        <Card className="flex-1 flex items-center justify-center border-0 shadow-md">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="mx-auto h-16 w-16 opacity-30 mb-4" />
            <p className="text-lg font-medium">Selecione um contato</p>
            <p className="text-sm">Escolha um cliente para ver os detalhes e iniciar a conversa</p>
          </div>
        </Card>
      )}

      <AddWhatsAppContactDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleContactCreated}
      />
    </div>
  );
}
