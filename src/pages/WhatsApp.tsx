import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Search,
  Plus,
  Phone,
  ExternalLink,
  Info,
  X,
  Users,
  User,
  Calendar,
  Tag,
  Edit3,
  Save,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { openWhatsAppWeb } from '@/lib/whatsapp';
import { AddWhatsAppContactDialog } from '@/components/whatsapp/AddWhatsAppContactDialog';
import { WhatsAppMessageList } from '@/components/whatsapp/WhatsAppMessageList';
import { WhatsAppChatInput } from '@/components/whatsapp/WhatsAppChatInput';
import { WhatsAppStatusIndicator } from '@/components/whatsapp/WhatsAppStatusIndicator';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

type LeadStatus = Tables<'leads'>['status'];

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
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: 'bg-blue-500' },
  em_atendimento: { label: 'Atendendo', color: 'bg-yellow-500' },
  agendado: { label: 'Agendado', color: 'bg-purple-500' },
  confirmado: { label: 'Confirmado', color: 'bg-green-500' },
  compareceu: { label: 'Compareceu', color: 'bg-emerald-600' },
  proposta: { label: 'Proposta', color: 'bg-orange-500' },
  matriculado: { label: 'Matriculado', color: 'bg-teal-500' },
  perdido: { label: 'Perdido', color: 'bg-destructive' },
};

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'lead', label: 'Novo Lead', color: 'bg-blue-500' },
  { value: 'em_atendimento', label: 'Em Atendimento', color: 'bg-yellow-500' },
  { value: 'agendado', label: 'Agendado', color: 'bg-purple-500' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-green-500' },
  { value: 'compareceu', label: 'Compareceu', color: 'bg-emerald-600' },
  { value: 'proposta', label: 'Proposta', color: 'bg-orange-500' },
  { value: 'perdido', label: 'Perdido', color: 'bg-destructive' },
];

const WhatsApp = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | undefined>();
  const [instances, setInstances] = useState<{ id: string; name: string; status: string }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAllContacts, setShowAllContacts] = useState(false);

  // Notes editing
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchContacts();
    fetchInstances();
  }, []);

  useEffect(() => {
    if (selectedContact) {
      setNotes(selectedContact.notes || '');
      setIsEditingNotes(false);
    }
  }, [selectedContact?.id]);

  const fetchInstances = async () => {
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('id, name, status')
      .eq('status', 'connected');

    if (data && data.length > 0) {
      setInstances(data);
      setSelectedInstanceId(data[0].id);
    } else {
      setInstances([]);
      setSelectedInstanceId(undefined);
    }
  };

  const fetchContacts = async () => {
    try {
      // Fetch all messages ordered by most recent to build phone->lastMessage map
      const { data: lastMessages } = await supabase
        .from('whatsapp_messages')
        .select('phone, content, created_at, direction')
        .order('created_at', { ascending: false })
        .limit(1000);

      // Build map: cleaned phone (last 8 digits) -> last message info
      const messageMap = new Map<string, { content: string | null; created_at: string; direction: string; rawPhone: string }>();
      const phonesWithMessages = new Set<string>();
      if (lastMessages) {
        for (const msg of lastMessages) {
          const cleanPhone = msg.phone.replace(/\D/g, '').slice(-8);
          if (!messageMap.has(cleanPhone)) {
            messageMap.set(cleanPhone, { ...msg, rawPhone: msg.phone });
          }
          phonesWithMessages.add(cleanPhone);
        }
      }

      // Fetch leads
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, full_name, guardian_name, phone, email, source, status, external_id, external_source, notes, created_at, updated_at, assigned_agent_id')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const contactsWithMessages: WhatsAppContact[] = (leads || []).map(lead => {
        const cleanPhone = lead.phone.replace(/\D/g, '').slice(-8);
        const lastMsg = messageMap.get(cleanPhone);
        return {
          ...lead,
          last_message: lastMsg?.content || null,
          last_message_at: lastMsg?.created_at || null,
          _hasConversation: phonesWithMessages.has(cleanPhone),
        };
      }) as (WhatsAppContact & { _hasConversation: boolean })[];

      // Sort: contacts with recent messages first
      contactsWithMessages.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        if (aTime && bTime) return bTime - aTime;
        if (aTime) return -1;
        if (bTime) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setContacts(contactsWithMessages);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContacts = searchQuery
    ? contacts.filter(c => {
        const q = searchQuery.toLowerCase();
        return (
          c.full_name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.guardian_name?.toLowerCase().includes(q) ||
          c.external_id?.toLowerCase().includes(q)
        );
      })
    : contacts;

  const handleStatusChange = async (contactId: string, newStatus: LeadStatus) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', contactId);
      if (error) throw error;

      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus } : c));
      if (selectedContact?.id === contactId) {
        setSelectedContact(prev => prev ? { ...prev, status: newStatus } : null);
      }
      toast.success(`Status alterado para ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedContact) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ notes })
        .eq('id', selectedContact.id);
      if (error) throw error;
      toast.success('Notas salvas');
      setIsEditingNotes(false);
      setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, notes } : c));
      setSelectedContact(prev => prev ? { ...prev, notes } : null);
    } catch {
      toast.error('Erro ao salvar notas');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const formatPhone = (phone: string) => {
    const c = phone.replace(/\D/g, '');
    if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
    return phone;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-muted/30">
      {/* ─── Sidebar: Contact List ─── */}
      <div className="w-[340px] flex flex-col border-r bg-background">
        {/* Sidebar Header */}
        <div className="p-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-sm">WhatsApp</span>
              <WhatsAppStatusIndicator />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Instance selector */}
          {instances.length > 1 && (
            <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map(inst => (
                  <SelectItem key={inst.id} value={inst.id}>
                    <div className="flex items-center gap-2">
                      <div className={cn('h-2 w-2 rounded-full', inst.status === 'connected' ? 'bg-green-500' : 'bg-muted-foreground')} />
                      {inst.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Contact List */}
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {isLoading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Carregando...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <MessageCircle className="mx-auto h-10 w-10 opacity-30 mb-2" />
                Nenhum contato
              </div>
            ) : (
              filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors hover:bg-muted/50',
                    selectedContact?.id === contact.id && 'bg-muted'
                  )}
                  onClick={() => setSelectedContact(contact)}
                >
                  <div className="relative shrink-0">
                    <div className="h-11 w-11 rounded-full bg-green-600 flex items-center justify-center text-white font-medium text-sm">
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
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{contact.full_name}</p>
                      {contact.last_message_at && (
                        <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                          {formatDistanceToNow(new Date(contact.last_message_at), { addSuffix: false, locale: ptBR })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {contact.last_message || contact.phone}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ─── Chat Area ─── */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b bg-background shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center text-white font-medium text-sm">
                {getInitials(selectedContact.full_name)}
              </div>
              <div>
                <p className="font-semibold text-sm">{selectedContact.full_name}</p>
                <p className="text-xs text-muted-foreground">{formatPhone(selectedContact.phone)}</p>
              </div>
              <Badge
                className={cn('text-[10px] text-white ml-2', STATUS_CONFIG[selectedContact.status]?.color)}
              >
                {STATUS_CONFIG[selectedContact.status]?.label || selectedContact.status}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => openWhatsAppWeb(selectedContact.phone)}
                title="Abrir WhatsApp Web"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-9 w-9', showInfoPanel && 'bg-muted')}
                onClick={() => setShowInfoPanel(!showInfoPanel)}
                title="Info do contato"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex min-h-0">
            {/* Messages + Input */}
            <div className="flex-1 flex flex-col bg-[hsl(var(--muted))]/30">
              {/* Message List */}
              <div className="flex-1 min-h-0">
                <WhatsAppMessageList
                  phone={selectedContact.phone}
                  leadId={selectedContact.id}
                  key={`msg-${selectedContact.id}-${refreshKey}`}
                />
              </div>

              {/* Input */}
              <div className="p-3 bg-background border-t">
                <WhatsAppChatInput
                  phone={selectedContact.phone}
                  leadId={selectedContact.id}
                  instanceId={selectedInstanceId}
                  onMessageSent={() => setRefreshKey(k => k + 1)}
                />
              </div>
            </div>

            {/* ─── Info Panel ─── */}
            {showInfoPanel && (
              <div className="w-[320px] border-l bg-background flex flex-col shrink-0">
                <div className="p-4 border-b flex items-center justify-between">
                  <span className="font-semibold text-sm">Info do contato</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowInfoPanel(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-5">
                    {/* Avatar + Name */}
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="h-20 w-20 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-2xl">
                        {getInitials(selectedContact.full_name)}
                      </div>
                      <div>
                        <p className="font-semibold">{selectedContact.full_name}</p>
                        <p className="text-sm text-muted-foreground">{formatPhone(selectedContact.phone)}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Status */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Tabulação</p>
                      <Select
                        value={selectedContact.status}
                        onValueChange={v => handleStatusChange(selectedContact.id, v as LeadStatus)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s.value} value={s.value}>
                              <div className="flex items-center gap-2">
                                <div className={cn('h-2 w-2 rounded-full', s.color)} />
                                {s.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-3">
                      {selectedContact.guardian_name && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Responsável</p>
                          <p className="text-sm flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            {selectedContact.guardian_name}
                          </p>
                        </div>
                      )}
                      {selectedContact.email && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                          <p className="text-sm">{selectedContact.email}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Origem</p>
                        <p className="text-sm capitalize">{selectedContact.source}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cadastrado em</p>
                        <p className="text-sm">
                          {format(new Date(selectedContact.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {selectedContact.external_id && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">ID Externo</p>
                          <p className="text-sm font-mono text-primary">{selectedContact.external_id}</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Observações</p>
                        {!isEditingNotes ? (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsEditingNotes(true)}>
                            <Edit3 className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                        ) : (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setNotes(selectedContact.notes || ''); setIsEditingNotes(false); }}>
                              Cancelar
                            </Button>
                            <Button size="sm" className="h-6 text-xs" onClick={handleSaveNotes} disabled={isSaving}>
                              Salvar
                            </Button>
                          </div>
                        )}
                      </div>
                      {isEditingNotes ? (
                        <Textarea
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          rows={4}
                          className="resize-none text-sm"
                          placeholder="Observações..."
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedContact.notes || 'Nenhuma observação'}
                        </p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex items-center justify-center bg-muted/20">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="mx-auto h-16 w-16 opacity-20 mb-4" />
            <p className="text-lg font-medium">WhatsApp Atendimento</p>
            <p className="text-sm mt-1">Selecione um contato para iniciar a conversa</p>
          </div>
        </div>
      )}

      <AddWhatsAppContactDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => { fetchContacts(); setIsAddDialogOpen(false); }}
      />
    </div>
  );
};

export default WhatsApp;
