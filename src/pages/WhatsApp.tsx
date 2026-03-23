import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Search,
  Plus,
  Info,
  X,
  Users,
  User,
  Calendar,
  Tag,
  Edit3,
  Save,
  Clock,
  GraduationCap,
  Award,
  FileText,
  ExternalLink,
  AlertTriangle,
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
import { useNavigate } from 'react-router-dom';

import { AddWhatsAppContactDialog } from '@/components/whatsapp/AddWhatsAppContactDialog';
import { WhatsAppMessageList } from '@/components/whatsapp/WhatsAppMessageList';
import { WhatsAppChatInput } from '@/components/whatsapp/WhatsAppChatInput';
import { WhatsAppStatusIndicator } from '@/components/whatsapp/WhatsAppStatusIndicator';
import { AddEnrollmentDialog } from '@/components/students/AddEnrollmentDialog';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
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
  _isVirtual?: boolean;
}

interface EnrollmentInfo {
  id: string;
  status: string;
  course_name: string;
  class_name: string | null;
  absences: number;
  certificate_issued: boolean;
}

interface ResponseTracking {
  first_contact_at: string;
  first_response_at: string | null;
  alert_24h: boolean;
  auto_tabulated: boolean;
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
  { value: 'matriculado', label: 'Matriculado', color: 'bg-teal-500' },
  { value: 'perdido', label: 'Perdido', color: 'bg-destructive' },
];

const ACADEMIC_STATUS_LABELS: Record<string, string> = {
  matriculado: 'Matriculado',
  em_curso: 'Em Curso',
  concluido: 'Concluído',
  ausente: 'Ausente',
  reprovado_faltas: 'Reprovado por Faltas',
  desistente: 'Desistente',
  rematricula: 'Rematrícula',
  remanejado: 'Remanejado',
  formado: 'Formado',
};

const WhatsApp = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('todas');
  const [enrollmentStatusMap, setEnrollmentStatusMap] = useState<Record<string, string[]>>({});

  // Info panel data
  const [enrollments, setEnrollments] = useState<EnrollmentInfo[]>([]);
  const [responseTracking, setResponseTracking] = useState<ResponseTracking | null>(null);

  // Notes editing
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchContacts();
    fetchInstances();

    // Realtime listener for new messages to auto-refresh contact list
    const channel = supabase
      .channel('whatsapp-contacts-refresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, () => {
        fetchContacts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (selectedContact) {
      setNotes(selectedContact.notes || '');
      setIsEditingNotes(false);
      fetchContactAcademicData(selectedContact.id);
    } else {
      setEnrollments([]);
      setResponseTracking(null);
    }
  }, [selectedContact?.id]);

  const fetchContactAcademicData = async (leadId: string) => {
    // Fetch enrollments with course and class info
    const { data: enrollmentData } = await supabase
      .from('enrollments')
      .select('id, status, course_id, class_id, certificate_issued, courses(name), classes(name)')
      .eq('lead_id', leadId);

    if (enrollmentData) {
      // Fetch absence counts
      const enrollmentInfos: EnrollmentInfo[] = [];
      for (const e of enrollmentData) {
        let absences = 0;
        if (e.class_id) {
          const { count } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', leadId)
            .eq('class_id', e.class_id)
            .eq('status', 'falta');
          absences = count || 0;
        }
        enrollmentInfos.push({
          id: e.id,
          status: e.status,
          course_name: (e as any).courses?.name || 'Sem curso',
          class_name: (e as any).classes?.name || null,
          absences,
          certificate_issued: e.certificate_issued || false,
        });
      }
      setEnrollments(enrollmentInfos);
    } else {
      setEnrollments([]);
    }

    // Fetch response tracking
    const { data: tracking } = await supabase
      .from('lead_response_tracking')
      .select('first_contact_at, first_response_at, alert_24h, auto_tabulated')
      .eq('lead_id', leadId)
      .maybeSingle();

    setResponseTracking(tracking);
  };

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
      const { data: lastMessages } = await supabase
        .from('whatsapp_messages')
        .select('phone, content, created_at, direction')
        .order('created_at', { ascending: false })
        .limit(1000);

      const messageMap = new Map<string, { content: string | null; created_at: string; direction: string; rawPhone: string }>();
      const phonesWithMessages = new Set<string>();
      const phonesWithInbound = new Set<string>();
      if (lastMessages) {
        for (const msg of lastMessages) {
          const cleanPhone = msg.phone.replace(/\D/g, '').slice(-8);
          if (!messageMap.has(cleanPhone)) {
            messageMap.set(cleanPhone, { ...msg, rawPhone: msg.phone });
            if (msg.direction === 'inbound') {
              phonesWithInbound.add(cleanPhone);
            }
          }
          phonesWithMessages.add(cleanPhone);
        }
      }

      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, full_name, guardian_name, phone, email, source, status, external_id, external_source, notes, created_at, updated_at, assigned_agent_id')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const contactsWithMessages = (leads || []).map(lead => {
        const cleanPhone = lead.phone.replace(/\D/g, '').slice(-8);
        const lastMsg = messageMap.get(cleanPhone);
        return {
          ...lead,
          last_message: lastMsg?.content || null,
          last_message_at: lastMsg?.created_at || null,
          _hasConversation: phonesWithMessages.has(cleanPhone),
          _hasNewInbound: phonesWithInbound.has(cleanPhone),
        };
      });

      contactsWithMessages.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        if (aTime && bTime) return bTime - aTime;
        if (aTime) return -1;
        if (bTime) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setContacts(contactsWithMessages as WhatsAppContact[]);

      // Fetch enrollment statuses for all leads
      const leadIds = (leads || []).map(l => l.id);
      if (leadIds.length > 0) {
        const { data: allEnrollments } = await supabase
          .from('enrollments')
          .select('lead_id, status, class_id')
          .in('lead_id', leadIds);
        
        const esMap: Record<string, string[]> = {};
        if (allEnrollments) {
          for (const e of allEnrollments) {
            if (e.lead_id) {
              if (!esMap[e.lead_id]) esMap[e.lead_id] = [];
              esMap[e.lead_id].push(e.status);
            }
          }
        }
        setEnrollmentStatusMap(esMap);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const FILTER_OPTIONS = [
    { key: 'todas', label: 'Todas', icon: MessageCircle },
    { key: 'novas', label: 'Novas', icon: MessageCircle },
    { key: 'matriculados', label: 'Matriculados', icon: GraduationCap },
    { key: 'alerta', label: 'Alerta', icon: AlertTriangle },
    { key: 'nao_matriculado', label: 'Não Matr.', icon: X },
    { key: 'concluido', label: 'Concluído', icon: Award },
    { key: 'turmas', label: 'Turmas', icon: Users },
  ];

  const filteredContacts = contacts.filter(c => {
    const hasConv = !!(c as any)._hasConversation;
    const hasNewInbound = !!(c as any)._hasNewInbound;
    const enrollStatuses = enrollmentStatusMap[c.id] || [];

    // Apply tab filter first
    if (activeFilter !== 'todas') {
      switch (activeFilter) {
        case 'novas':
          if (!hasNewInbound) return false;
          break;
        case 'matriculados':
          if (c.status !== 'matriculado' && !enrollStatuses.some(s => ['matriculado', 'em_curso', 'ativo'].includes(s))) return false;
          break;
        case 'alerta':
          if (!['lead', 'em_atendimento'].includes(c.status)) return false;
          break;
        case 'nao_matriculado':
          if (c.status !== 'perdido') return false;
          break;
        case 'concluido':
          if (!enrollStatuses.some(s => ['concluido', 'formado'].includes(s))) return false;
          break;
        case 'turmas':
          if (!enrollStatuses.length) return false;
          break;
      }
    } else {
      if (!showAllContacts && !searchQuery && !hasConv) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.guardian_name?.toLowerCase().includes(q) ||
        c.external_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

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

  const getWaitTimeIndicator = () => {
    if (!responseTracking || responseTracking.first_response_at) return null;
    const hours = differenceInHours(new Date(), new Date(responseTracking.first_contact_at));
    if (hours >= 48) return { label: '48h+ sem resposta', color: 'text-destructive', bg: 'bg-destructive/10', icon: '🔴' };
    if (hours >= 24) return { label: '24h+ sem resposta', color: 'text-orange-600', bg: 'bg-orange-50', icon: '🟡' };
    if (hours >= 12) return { label: `${hours}h sem resposta`, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '⏳' };
    return null;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-muted/30">
      {/* ─── Sidebar: Contact List ─── */}
      <div className="w-[340px] flex flex-col border-r bg-background">
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

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1">
            {FILTER_OPTIONS.map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={activeFilter === f.key ? 'default' : 'outline'}
                className="h-7 text-[11px] px-2 gap-1"
                onClick={() => setActiveFilter(f.key)}
              >
                <f.icon className="h-3 w-3" />
                {f.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contato..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              size="sm"
              variant={showAllContacts ? 'secondary' : 'ghost'}
              className="h-9 px-2 shrink-0"
              onClick={() => setShowAllContacts(!showAllContacts)}
              title={showAllContacts ? 'Mostrando todos' : 'Mostrar todos os contatos'}
            >
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </div>

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
              <div className="flex-1 min-h-0">
                <WhatsAppMessageList
                  phone={selectedContact.phone}
                  leadId={selectedContact.id}
                  key={`msg-${selectedContact.id}-${refreshKey}`}
                />
              </div>
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
              <div className="w-[340px] border-l bg-background flex flex-col shrink-0">
                <div className="p-4 border-b flex items-center justify-between">
                  <span className="font-semibold text-sm">Info do contato</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowInfoPanel(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
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

                    {/* Wait Time Indicator */}
                    {(() => {
                      const indicator = getWaitTimeIndicator();
                      if (!indicator) return null;
                      return (
                        <div className={cn('flex items-center gap-2 rounded-lg p-3 text-sm font-medium', indicator.bg, indicator.color)}>
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{indicator.icon} {indicator.label}</span>
                        </div>
                      );
                    })()}

                    <Separator />

                    {/* Quick Actions */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">⚡ Ações Rápidas</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs justify-start"
                          onClick={() => setEnrollmentDialogOpen(true)}
                        >
                          <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                          Matricular
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs justify-start"
                          onClick={() => navigate('/certificates')}
                        >
                          <Award className="h-3.5 w-3.5 mr-1.5" />
                          Certificado
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs justify-start col-span-2"
                          onClick={() => navigate(`/students/${selectedContact.id}`)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          Ficha Completa
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Lead Tabulation */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">📋 Tabulação</p>
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

                    {/* Academic Data */}
                    {enrollments.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">🎓 Dados Acadêmicos</p>
                          <div className="space-y-3">
                            {enrollments.map(e => (
                              <div key={e.id} className="rounded-lg border p-3 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium">{e.course_name}</p>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {ACADEMIC_STATUS_LABELS[e.status] || e.status}
                                  </Badge>
                                </div>
                                {e.class_name && (
                                  <p className="text-xs text-muted-foreground">Turma: {e.class_name}</p>
                                )}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>Faltas: <span className={cn(e.absences >= 3 ? 'text-destructive font-semibold' : '')}>{e.absences}</span></span>
                                  {e.certificate_issued && (
                                    <span className="flex items-center gap-1 text-green-600">
                                      <Award className="h-3 w-3" /> Certificado emitido
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />

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

      {selectedContact && (
        <AddEnrollmentDialog
          open={enrollmentDialogOpen}
          onOpenChange={setEnrollmentDialogOpen}
          onSuccess={() => {
            setEnrollmentDialogOpen(false);
            fetchContactAcademicData(selectedContact.id);
            handleStatusChange(selectedContact.id, 'matriculado');
            toast.success('Matrícula realizada com sucesso!');
          }}
          preSelectedLeadId={selectedContact.id}
        />
      )}
    </div>
  );
};

export default WhatsApp;
