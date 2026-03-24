import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageCircle,
  Search,
  Plus,
  Info,
  X,
  Users,
  User,
  UserPlus,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Tag,
  Edit3,
  Save,
  Clock,
  GraduationCap,
  Award,
  FileText,
  ExternalLink,
  AlertTriangle,
  XCircle,
  Star,
  Timer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { RegisterLeadDialog } from '@/components/whatsapp/RegisterLeadDialog';
import { RegisterSiblingDialog } from '@/components/whatsapp/RegisterSiblingDialog';
import { WhatsAppMessageList } from '@/components/whatsapp/WhatsAppMessageList';
import { WhatsAppChatInput } from '@/components/whatsapp/WhatsAppChatInput';
import { WhatsAppStatusIndicator } from '@/components/whatsapp/WhatsAppStatusIndicator';
import { AddEnrollmentDialog } from '@/components/students/AddEnrollmentDialog';
import { format, isToday, isYesterday, differenceInHours } from 'date-fns';
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
  assigned_agent_name?: string | null;
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof MessageCircle }> = {
  lead: { label: 'Lead', color: 'bg-blue-500', bg: 'bg-blue-100 text-blue-700', icon: UserPlus },
  em_atendimento: { label: 'Atendendo', color: 'bg-yellow-500', bg: 'bg-yellow-100 text-yellow-700', icon: MessageCircle },
  agendado: { label: 'Agendado', color: 'bg-purple-500', bg: 'bg-purple-100 text-purple-700', icon: Calendar },
  confirmado: { label: 'Confirmado', color: 'bg-green-500', bg: 'bg-green-100 text-green-700', icon: CalendarCheck },
  compareceu: { label: 'Compareceu', color: 'bg-emerald-600', bg: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  proposta: { label: 'Proposta', color: 'bg-orange-500', bg: 'bg-orange-100 text-orange-700', icon: FileText },
  matriculado: { label: 'Matriculado', color: 'bg-teal-500', bg: 'bg-teal-100 text-teal-700', icon: GraduationCap },
  perdido: { label: 'Perdido', color: 'bg-destructive', bg: 'bg-red-100 text-red-700', icon: XCircle },
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
  const [instances, setInstances] = useState<{ id: string; name: string; status: string; phone_number: string | null }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const [registerLeadDialogOpen, setRegisterLeadDialogOpen] = useState(false);
  const [siblingDialogOpen, setSiblingDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('todas');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [enrollmentStatusMap, setEnrollmentStatusMap] = useState<Record<string, string[]>>({});
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editDetails, setEditDetails] = useState({ full_name: '', guardian_name: '', external_id: '', maxsystem_contract_number: '', maxsystem_record_id: '' });

  // Info panel data
  const [enrollments, setEnrollments] = useState<EnrollmentInfo[]>([]);
  const [responseTracking, setResponseTracking] = useState<ResponseTracking | null>(null);

  // Notes editing
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Read tracking via localStorage
  const getReadTimestamps = (): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem('whatsapp_read_at') || '{}');
    } catch { return {}; }
  };

  const markAsRead = (phoneKey: string) => {
    const timestamps = getReadTimestamps();
    timestamps[phoneKey] = new Date().toISOString();
    localStorage.setItem('whatsapp_read_at', JSON.stringify(timestamps));
    // Update unread count in contacts list
    setContacts(prev => prev.map(c => {
      const cp = c.phone.replace(/\D/g, '').slice(-8);
      if (cp === phoneKey) return { ...c, unread_count: 0 };
      return c;
    }));
  };

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

  // Re-fetch contacts when instance changes
  useEffect(() => {
    if (selectedInstanceId) {
      fetchContacts();
    }
  }, [selectedInstanceId]);

  useEffect(() => {
    if (selectedContact) {
      // Mark conversation as read
      const phoneKey = selectedContact.phone.replace(/\D/g, '').slice(-8);
      markAsRead(phoneKey);

      setNotes(selectedContact.notes || '');
      setIsEditingNotes(false);
      if (!selectedContact._isVirtual) {
        fetchContactAcademicData(selectedContact.id);
      } else {
        setEnrollments([]);
        setResponseTracking(null);
      }
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
      .select('id, name, status, phone_number')
      .order('name');

    if (data && data.length > 0) {
      setInstances(data);
      const connected = data.find(d => d.status === 'connected');
      setSelectedInstanceId(connected?.id || data[0].id);
    } else {
      setInstances([]);
      setSelectedInstanceId(undefined);
    }
  };

  const fetchContacts = async () => {
    try {
      let msgQuery = supabase
        .from('whatsapp_messages')
        .select('phone, content, created_at, direction')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (selectedInstanceId) {
        msgQuery = msgQuery.eq('instance_id', selectedInstanceId);
      }

      const { data: lastMessages } = await msgQuery;

      const messageMap = new Map<string, { content: string | null; created_at: string; direction: string; rawPhone: string }>();
      const phonesWithMessages = new Set<string>();
      const phonesWithInbound = new Set<string>();
      const unreadCounts = new Map<string, number>();
      const readTimestamps = getReadTimestamps();
      const selectedPhoneKey = selectedContact?.phone.replace(/\D/g, '').slice(-8);

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

          // Count unread inbound messages (after last read timestamp)
          if (msg.direction === 'inbound') {
            const lastRead = readTimestamps[cleanPhone];
            const isCurrentlyOpen = cleanPhone === selectedPhoneKey;
            if (!isCurrentlyOpen && (!lastRead || new Date(msg.created_at) > new Date(lastRead))) {
              unreadCounts.set(cleanPhone, (unreadCounts.get(cleanPhone) || 0) + 1);
            }
          }
        }
      }

      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, full_name, guardian_name, phone, email, source, status, external_id, external_source, notes, created_at, updated_at, assigned_agent_id, maxsystem_contract_number, maxsystem_record_id')
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
          unread_count: unreadCounts.get(cleanPhone) || 0,
          _hasConversation: phonesWithMessages.has(cleanPhone),
          _hasNewInbound: phonesWithInbound.has(cleanPhone),
          _isVirtual: false,
        };
      });

      // Find phones with messages that don't match any lead
      const leadPhones = new Set((leads || []).map(l => l.phone.replace(/\D/g, '').slice(-8)));
      const virtualContacts: WhatsAppContact[] = [];
      const seenVirtualPhones = new Set<string>();

      for (const [cleanPhone, msgData] of Array.from(messageMap.entries())) {
        if (!leadPhones.has(cleanPhone) && !seenVirtualPhones.has(cleanPhone)) {
          seenVirtualPhones.add(cleanPhone);
          virtualContacts.push({
            id: `virtual-${msgData.rawPhone}`,
            full_name: msgData.rawPhone,
            guardian_name: null,
            phone: msgData.rawPhone,
            email: null,
            source: 'whatsapp' as any,
            status: 'lead' as LeadStatus,
            external_id: null,
            external_source: null,
            notes: null,
            created_at: msgData.created_at,
            updated_at: msgData.created_at,
            assigned_agent_id: null,
            last_message: msgData.content,
            last_message_at: msgData.created_at,
            unread_count: unreadCounts.get(cleanPhone) || 0,
            _isVirtual: true,
            _hasConversation: true,
            _hasNewInbound: phonesWithInbound.has(cleanPhone),
          } as any);
        }
      }

      const allContacts = [...contactsWithMessages, ...virtualContacts];

      allContacts.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        if (aTime && bTime) return bTime - aTime;
        if (aTime) return -1;
        if (bTime) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setContacts(allContacts as WhatsAppContact[]);

      // Fetch enrollment statuses for all leads (non-virtual only)
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

  // Real-time timer tick (every 60s)
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredContacts = useMemo(() => {
    let result = contacts.filter(c => {
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

    // If searching by phone number and no results found, create virtual contact
    const cleanSearch = searchQuery.replace(/\D/g, '');
    if (result.length === 0 && cleanSearch.length >= 8) {
      result = [{
        id: `search-${cleanSearch}`,
        full_name: cleanSearch,
        guardian_name: null,
        phone: cleanSearch,
        email: null,
        source: 'whatsapp' as any,
        status: 'lead' as LeadStatus,
        external_id: null,
        external_source: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assigned_agent_id: null,
        last_message: null,
        last_message_at: null,
        unread_count: 0,
        _isVirtual: true,
      }];
    }

    return result;
  }, [contacts, activeFilter, searchQuery, showAllContacts, enrollmentStatusMap]);

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

  const handleStartEditDetails = () => {
    if (!selectedContact) return;
    setEditDetails({
      full_name: selectedContact.full_name || '',
      guardian_name: selectedContact.guardian_name || '',
      external_id: selectedContact.external_id || '',
      maxsystem_contract_number: (selectedContact as any).maxsystem_contract_number || '',
      maxsystem_record_id: (selectedContact as any).maxsystem_record_id || '',
    });
    setIsEditingDetails(true);
  };

  const handleSaveDetails = async () => {
    if (!selectedContact) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          full_name: editDetails.full_name.trim(),
          guardian_name: editDetails.guardian_name.trim() || null,
          external_id: editDetails.external_id.trim() || null,
          external_source: editDetails.external_id.trim() ? 'bitrix' : null,
          maxsystem_contract_number: editDetails.maxsystem_contract_number.trim() || null,
          maxsystem_record_id: editDetails.maxsystem_record_id.trim() || null,
        } as any)
        .eq('id', selectedContact.id);
      if (error) throw error;
      toast.success('Dados atualizados');
      setIsEditingDetails(false);
      const updatedContact = {
        ...selectedContact,
        full_name: editDetails.full_name.trim(),
        guardian_name: editDetails.guardian_name.trim() || null,
        external_id: editDetails.external_id.trim() || null,
        maxsystem_contract_number: editDetails.maxsystem_contract_number.trim() || null,
        maxsystem_record_id: editDetails.maxsystem_record_id.trim() || null,
      };
      setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, ...updatedContact } : c));
      setSelectedContact(updatedContact as any);
    } catch {
      toast.error('Erro ao salvar dados');
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
    <div className="h-full flex bg-muted/30">
      {/* ─── Sidebar: Contact List ─── */}
      <div className="w-[420px] flex flex-col border-r bg-background shrink-0">
        <div className="p-2 border-b space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-xs">WhatsApp</span>
              <WhatsAppStatusIndicator />
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={showAllContacts ? 'secondary' : 'ghost'}
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => setShowAllContacts(!showAllContacts)}
                title={showAllContacts ? 'Mostrando todos' : 'Mostrar todos os contatos'}
              >
                <Users className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {instances.length > 0 && (
            <Select value={selectedInstanceId} onValueChange={(v) => { setSelectedInstanceId(v); setSelectedContact(null); }}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecionar instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map(inst => (
                  <SelectItem key={inst.id} value={inst.id}>
                    <div className="flex items-center gap-2">
                      <div className={cn('h-2.5 w-2.5 rounded-full', inst.status === 'connected' ? 'bg-green-500' : inst.status === 'connecting' ? 'bg-yellow-500' : 'bg-muted-foreground')} />
                      <span className="font-medium">{inst.name}</span>
                      {inst.phone_number && (
                        <span className="text-muted-foreground">({inst.phone_number})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Filter chips - collapsible */}
          {(() => {
            const visible = FILTER_OPTIONS.slice(0, 4);
            const extra = FILTER_OPTIONS.slice(4);
            const isActiveInExtra = extra.some(f => f.key === activeFilter);
            return (
              <div className="space-y-1">
                <div className="flex gap-1 flex-wrap items-center">
                  {visible.map(f => (
                    <Button
                      key={f.key}
                      size="sm"
                      variant={activeFilter === f.key ? 'default' : 'outline'}
                      className="h-6 text-[10px] px-1.5 gap-0.5"
                      onClick={() => setActiveFilter(f.key)}
                    >
                      <f.icon className="h-3 w-3" />
                      {f.label}
                    </Button>
                  ))}
                  {extra.length > 0 && (
                    <Button
                      size="sm"
                      variant={isActiveInExtra && !filtersExpanded ? 'default' : 'outline'}
                      className="h-6 text-[10px] px-1.5 gap-0.5"
                      onClick={() => setFiltersExpanded(!filtersExpanded)}
                    >
                      {filtersExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Mais
                    </Button>
                  )}
                </div>
                {filtersExpanded && extra.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {extra.map(f => (
                      <Button
                        key={f.key}
                        size="sm"
                        variant={activeFilter === f.key ? 'default' : 'outline'}
                        className="h-6 text-[10px] px-1.5 gap-0.5"
                        onClick={() => setActiveFilter(f.key)}
                      >
                        <f.icon className="h-3 w-3" />
                        {f.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-7 text-xs"
            />
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
              filteredContacts.map(contact => {
                const statusCfg = STATUS_CONFIG[contact.status];
                const StatusIcon = statusCfg?.icon || User;
                const contactEnrollStatuses = enrollmentStatusMap[contact.id] || [];
                const isEnrolled = contactEnrollStatuses.some(s => ['matriculado', 'em_curso', 'ativo'].includes(s));
                const isCompleted = contactEnrollStatuses.some(s => ['concluido', 'formado'].includes(s));
                
                // Determine avatar icon/color based on status
                let avatarBg = statusCfg?.color || 'bg-muted';
                let AvatarIcon = StatusIcon;
                if (contact._isVirtual) { avatarBg = 'bg-green-500'; AvatarIcon = Star; }
                else if (isCompleted) { avatarBg = 'bg-amber-500'; AvatarIcon = Award; }
                else if (isEnrolled) { avatarBg = 'bg-teal-500'; AvatarIcon = GraduationCap; }

                // Wait time for this contact
                const contactCreated = new Date(contact.created_at);
                const waitHours = differenceInHours(new Date(nowTick), contactCreated);
                const showWaitBadge = !contact._isVirtual && ['lead', 'em_atendimento'].includes(contact.status) && waitHours >= 12;
                const hasUnread = (contact.unread_count || 0) > 0;

                return (
                  <div
                    key={contact.id}
                    className={cn(
                      'flex items-start gap-3 px-3 py-3 cursor-pointer transition-colors hover:bg-muted/50 rounded-lg mx-1',
                      selectedContact?.id === contact.id && 'bg-muted'
                    )}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="relative shrink-0 mt-0.5">
                      <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-white', avatarBg)}>
                        <AvatarIcon className="h-4.5 w-4.5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {/* Row 1: Name + time */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <p className={cn('font-medium text-sm truncate', hasUnread && 'font-bold text-foreground')}>
                            {contact._isVirtual ? formatPhone(contact.phone) : contact.full_name}
                          </p>
                          {contact._isVirtual && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-green-100 text-green-700 shrink-0 whitespace-nowrap">
                              {contact.id.startsWith('search-') ? 'Iniciar conversa' : 'Novo'}
                            </Badge>
                          )}
                        </div>
                        <span className={cn('text-xs whitespace-nowrap shrink-0 ml-2', hasUnread ? 'text-green-600 font-semibold' : 'text-muted-foreground')}>
                          {contact.last_message_at ? (() => {
                            const d = new Date(contact.last_message_at);
                            if (isToday(d)) return format(d, 'HH:mm');
                            if (isYesterday(d)) return 'Ontem';
                            return format(d, 'dd/MM/yyyy');
                          })() : ''}
                        </span>
                      </div>
                      {/* Row 2: Phone + status + agent (left) | unread badge (right) */}
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="flex-1 min-w-0">
                          {!contact._isVirtual && (
                            <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                          )}
                          {!contact._isVirtual && (
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {statusCfg && (
                                <span className={cn('inline-block text-[9px] px-1.5 py-0.5 rounded', statusCfg.bg)}>
                                  {statusCfg.label}
                                </span>
                              )}
                              {showWaitBadge && (
                                <span className={cn(
                                  'inline-block text-[9px] px-1.5 py-0.5 rounded text-white',
                                  waitHours >= 48 ? 'bg-destructive' : waitHours >= 24 ? 'bg-orange-500' : 'bg-yellow-500'
                                )}>
                                  {waitHours}h
                                </span>
                              )}
                            </div>
                          )}
                          {contact.last_message && (
                            <p className={cn('text-xs line-clamp-1 break-words mt-0.5', hasUnread ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                              {contact.last_message}
                            </p>
                          )}
                          {!contact._isVirtual && contact.assigned_agent_name && (
                            <p className="text-[10px] text-purple-500 truncate">Agente: {contact.assigned_agent_name}</p>
                          )}
                          {!contact._isVirtual && contact.guardian_name && (
                            <p className="text-[10px] text-muted-foreground truncate">Resp: {contact.guardian_name}</p>
                          )}
                        </div>
                        {hasUnread && (
                          <Badge variant="default" className="ml-2 h-5 min-w-5 shrink-0 flex items-center justify-center text-xs">
                            {contact.unread_count! > 99 ? '99+' : contact.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
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
              {(() => {
                const sc = STATUS_CONFIG[selectedContact.status];
                const Icon = sc?.icon || User;
                return (
                  <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-white', sc?.color || 'bg-muted')}>
                    <Icon className="h-5 w-5" />
                  </div>
                );
              })()}
              <div>
                <p className="font-semibold text-sm">{selectedContact._isVirtual ? formatPhone(selectedContact.phone) : selectedContact.full_name}</p>
                <p className="text-xs text-muted-foreground">{formatPhone(selectedContact.phone)}</p>
                {!selectedContact._isVirtual && selectedContact.guardian_name && (
                  <p className="text-[10px] text-muted-foreground">Resp: {selectedContact.guardian_name}</p>
                )}
              </div>
              {selectedContact._isVirtual ? (
                <Badge variant="secondary" className="text-[10px] ml-2 bg-green-100 text-green-700">Novo</Badge>
              ) : (
                <Badge className={cn('text-[10px] text-white ml-2', STATUS_CONFIG[selectedContact.status]?.color)}>
                  {STATUS_CONFIG[selectedContact.status]?.label || selectedContact.status}
                </Badge>
              )}
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
                  leadId={selectedContact._isVirtual ? undefined : selectedContact.id}
                  key={`msg-${selectedContact.id}-${refreshKey}`}
                />
              </div>
              <div className="p-3 bg-background border-t">
                <WhatsAppChatInput
                  phone={selectedContact.phone}
                  leadId={selectedContact._isVirtual ? undefined : selectedContact.id}
                  instanceId={selectedInstanceId}
                  onMessageSent={() => setRefreshKey(k => k + 1)}
                  leadName={selectedContact.full_name}
                />
              </div>
            </div>

            {/* ─── Info Panel ─── */}
            {showInfoPanel && (
              <div className="w-[380px] border-l bg-background flex flex-col shrink-0">
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
                      {(() => {
                        const sc = STATUS_CONFIG[selectedContact.status];
                        const Icon = sc?.icon || User;
                        return (
                          <div className={cn('h-20 w-20 rounded-full flex items-center justify-center text-white', sc?.color || 'bg-muted')}>
                            <Icon className="h-8 w-8" />
                          </div>
                        );
                      })()}
                      <div>
                        <p className="font-semibold">{selectedContact._isVirtual ? formatPhone(selectedContact.phone) : selectedContact.full_name}</p>
                        <p className="text-sm text-muted-foreground">{formatPhone(selectedContact.phone)}</p>
                        {selectedContact._isVirtual && (
                          <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 mt-1">Contato novo</Badge>
                        )}
                      </div>
                    </div>

                    {/* Register as Lead (virtual contacts only) */}
                    {selectedContact._isVirtual && (
                      <>
                        <div className="rounded-lg border border-dashed border-green-300 bg-green-50 p-3">
                          <p className="text-xs text-muted-foreground mb-2">Este contato ainda não está cadastrado.</p>
                          <Button
                            size="sm"
                            className="w-full h-8 text-xs"
                            onClick={() => setRegisterLeadDialogOpen(true)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Cadastrar como Lead
                          </Button>
                        </div>
                        <Separator />
                      </>
                    )}


                    {!selectedContact._isVirtual && (() => {
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

                    {!selectedContact._isVirtual && <>
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
                          className="h-9 text-xs justify-start"
                          onClick={() => setSiblingDialogOpen(true)}
                        >
                          <Users className="h-3.5 w-3.5 mr-1.5" />
                          Novo Irmão
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

                    {/* Contact Info - Editable */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">📇 Dados do Contato</p>
                        {!isEditingDetails ? (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleStartEditDetails}>
                            <Edit3 className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                        ) : (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsEditingDetails(false)}>
                              Cancelar
                            </Button>
                            <Button size="sm" className="h-6 text-xs" onClick={handleSaveDetails} disabled={isSaving}>
                              <Save className="h-3 w-3 mr-1" /> Salvar
                            </Button>
                          </div>
                        )}
                      </div>
                      {isEditingDetails ? (
                        <div className="space-y-2.5">
                          <div>
                            <Label className="text-xs">Nome do Modelo</Label>
                            <Input className="h-8 text-sm" value={editDetails.full_name} onChange={e => setEditDetails(p => ({ ...p, full_name: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-xs">Responsável</Label>
                            <Input className="h-8 text-sm" value={editDetails.guardian_name} onChange={e => setEditDetails(p => ({ ...p, guardian_name: e.target.value }))} placeholder="Nome do responsável" />
                          </div>
                          <div>
                            <Label className="text-xs">ID Bitrix</Label>
                            <Input className="h-8 text-sm" value={editDetails.external_id} onChange={e => setEditDetails(p => ({ ...p, external_id: e.target.value }))} placeholder="ID externo" />
                          </div>
                          <div>
                            <Label className="text-xs">Nº Contrato MaxSystem</Label>
                            <Input className="h-8 text-sm" value={editDetails.maxsystem_contract_number} onChange={e => setEditDetails(p => ({ ...p, maxsystem_contract_number: e.target.value }))} placeholder="Nº do contrato" />
                          </div>
                          <div>
                            <Label className="text-xs">ID Ficha MaxSystem</Label>
                            <Input className="h-8 text-sm" value={editDetails.maxsystem_record_id} onChange={e => setEditDetails(p => ({ ...p, maxsystem_record_id: e.target.value }))} placeholder="ID da ficha" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Responsável</span><span>{selectedContact.guardian_name || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">ID Bitrix</span><span>{selectedContact.external_id || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Contrato MaxSystem</span><span>{(selectedContact as any).maxsystem_contract_number || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Ficha MaxSystem</span><span>{(selectedContact as any).maxsystem_record_id || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Origem</span><span className="capitalize">{selectedContact.source}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Cadastrado em</span><span>{format(new Date(selectedContact.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span></div>
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
                    </>}
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

      {selectedContact?._isVirtual && (
        <RegisterLeadDialog
          open={registerLeadDialogOpen}
          onOpenChange={setRegisterLeadDialogOpen}
          phone={selectedContact.phone}
          onSuccess={async (leadId) => {
            await fetchContacts();
            setSelectedContact(prev => prev ? { ...prev, id: leadId, _isVirtual: false } as any : null);
          }}
        />
      )}

      {selectedContact && !selectedContact._isVirtual && (
        <RegisterSiblingDialog
          open={siblingDialogOpen}
          onOpenChange={setSiblingDialogOpen}
          guardianName={selectedContact.guardian_name || selectedContact.full_name}
          guardianPhone={selectedContact.phone}
          onSiblingCreated={async (leadId) => {
            await fetchContacts();
            setEnrollmentDialogOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default WhatsApp;
