import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Clock,
  Send,
  Phone,
  Mail,
  MessageCircle,
  User,
  CheckCircle2,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { LEAD_STATUS_CONFIG, type Lead } from '@/types/database';
import { cn } from '@/lib/utils';
import { useServiceDays } from '@/hooks/useServiceDays';
import { AddServiceDayDialog } from '@/components/crm/AddServiceDayDialog';
import { ServiceDayTimeSelect } from '@/components/scheduling/ServiceDayTimeSelect';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'agent' | 'system' | 'lead';
  timestamp: Date;
}

interface LeadWithDetails extends Lead {
  hasNewMessage?: boolean;
}

export default function AgentPortfolio() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  // Search and selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Portfolio state
  const [portfolio, setPortfolio] = useState<LeadWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Scheduling state
  const [schedulingLead, setSchedulingLead] = useState<Lead | null>(null);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [addServiceDayOpen, setAddServiceDayOpen] = useState(false);
  
  const { serviceDays, refetch: refetchServiceDays } = useServiceDays();
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchPortfolio();
    }
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchPortfolio = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, course:courses(name)')
        .eq('assigned_agent_id', user.id)
        .in('status', ['em_atendimento', 'agendado', 'confirmado'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setPortfolio((data as LeadWithDetails[]) || []);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, course:courses(name)')
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults((data as Lead[]) || []);
    } catch (error) {
      console.error('Error searching leads:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectLeadForScheduling = (lead: Lead) => {
    setSchedulingLead(lead);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSchedule = async () => {
    if (!schedulingLead || !selectedDayId || !scheduledTime || !user) return;

    // Get the selected service day
    const selectedDay = serviceDays.find(d => d.id === selectedDayId);
    if (!selectedDay) return;

    setIsScheduling(true);
    try {
      const { data: agentProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!agentProfile) throw new Error('Perfil não encontrado');

      const scheduledDate = new Date(selectedDay.service_date + 'T12:00:00');

      // Create appointment
      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          lead_id: schedulingLead.id,
          agent_id: agentProfile.id,
          scheduled_date: selectedDay.service_date,
          scheduled_time: scheduledTime,
          confirmed: false,
        });

      if (appointmentError) throw appointmentError;

      // Update lead status and assign agent
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'agendado',
          assigned_agent_id: user.id,
          scheduled_at: scheduledDate.toISOString(),
        })
        .eq('id', schedulingLead.id);

      if (leadError) throw leadError;

      toast({
        title: 'Agendamento criado!',
        description: `${schedulingLead.full_name} agendado para ${selectedDay.label} às ${scheduledTime}`,
      });

      // Add system message
      const systemMessage: ChatMessage = {
        id: `sys-${Date.now()}`,
        content: `📅 Agendamento criado para ${selectedDay.label} às ${scheduledTime}. Mensagem automática enviada.`,
        sender: 'system',
        timestamp: new Date(),
      };

      // Reset and refresh
      setSchedulingLead(null);
      setSelectedDayId('');
      setScheduledTime('');
      fetchPortfolio();
      
      // If this lead is selected, add the message
      if (selectedLead?.id === schedulingLead.id) {
        setMessages(prev => [...prev, systemMessage]);
      }

    } catch (error) {
      console.error('Error scheduling:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao agendar',
        description: 'Tente novamente.',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const selectLeadFromPortfolio = (lead: LeadWithDetails) => {
    setSelectedLead(lead);
    // Simulate loading chat history
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        content: `Olá ${lead.full_name.split(' ')[0]}! Bem-vindo(a) à SAF School. Vi que você tem interesse em nossos cursos. Posso ajudar?`,
        sender: 'system',
        timestamp: new Date(lead.created_at),
      },
    ];
    setMessages(mockMessages);
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedLead) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: newMessage,
      sender: 'agent',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    // Simulate auto-reply after 2 seconds (for demo)
    // In production, this would be replaced with actual WhatsApp API integration
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carteira do Agente</h1>
          <p className="text-muted-foreground">
            Ingestão, agendamento e relacionamento
          </p>
        </div>
        <Badge className="bg-gradient-primary text-white">
          {portfolio.length} leads na carteira
        </Badge>
      </div>

      {/* Search and Scheduling Area */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Novo Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Search */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar lead por nome, telefone ou email..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                )}
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                  {searchResults.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-3 hover:bg-muted/50 cursor-pointer flex items-center justify-between"
                      onClick={() => selectLeadForScheduling(lead)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(lead.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{lead.full_name}</p>
                          <p className="text-xs text-muted-foreground">{lead.phone}</p>
                        </div>
                      </div>
                      <Badge className={`${LEAD_STATUS_CONFIG[lead.status as keyof typeof LEAD_STATUS_CONFIG]?.bgColor} ${LEAD_STATUS_CONFIG[lead.status as keyof typeof LEAD_STATUS_CONFIG]?.color}`}>
                        {LEAD_STATUS_CONFIG[lead.status as keyof typeof LEAD_STATUS_CONFIG]?.label}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Lead */}
              {schedulingLead && (
                <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                        <AvatarFallback className="bg-primary text-white">
                          {getInitials(schedulingLead.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{schedulingLead.full_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {schedulingLead.phone}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setSchedulingLead(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Scheduling Form */}
            <div className="space-y-3">
              <ServiceDayTimeSelect
                selectedDayId={selectedDayId}
                selectedTime={scheduledTime}
                onDayChange={setSelectedDayId}
                onTimeChange={setScheduledTime}
                onAddServiceDay={() => setAddServiceDayOpen(true)}
                disabled={!schedulingLead}
              />

              <Button
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={!schedulingLead || !selectedDayId || !scheduledTime || isScheduling}
                onClick={handleSchedule}
              >
                {isScheduling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Salvar Agendamento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddServiceDayDialog
        open={addServiceDayOpen}
        onOpenChange={setAddServiceDayOpen}
        onSuccess={() => {
          refetchServiceDays();
          setAddServiceDayOpen(false);
        }}
      />

      {/* Split View: Portfolio + Chat */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Portfolio List */}
        <Card className="border-0 shadow-md flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Minha Carteira
            </CardTitle>
            <CardDescription>Leads em atendimento</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {portfolio.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <User className="mx-auto h-12 w-12 opacity-50 mb-2" />
                    <p>Nenhum lead na carteira</p>
                    <p className="text-sm">Busque e agende leads para começar</p>
                  </div>
                ) : (
                  portfolio.map((lead) => {
                    const statusConfig = LEAD_STATUS_CONFIG[lead.status as keyof typeof LEAD_STATUS_CONFIG];
                    const isSelected = selectedLead?.id === lead.id;

                    return (
                      <div
                        key={lead.id}
                        className={cn(
                          'p-4 rounded-lg border cursor-pointer transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30 hover:bg-muted/30'
                        )}
                        onClick={() => selectLeadFromPortfolio(lead)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-gradient-primary text-white">
                                {getInitials(lead.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            {lead.hasNewMessage && (
                              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-pulse" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{lead.full_name}</p>
                              <Badge className={`${statusConfig?.bgColor} ${statusConfig?.color} text-xs`}>
                                {statusConfig?.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{lead.phone}</p>
                          </div>
                          <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Window */}
        <Card className="border-0 shadow-md flex flex-col min-h-0">
          {selectedLead ? (
            <>
              {/* Chat Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-gradient-primary text-white">
                      {getInitials(selectedLead.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{selectedLead.full_name}</CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedLead.phone}
                      </span>
                      {selectedLead.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {selectedLead.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-0 min-h-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex',
                          message.sender === 'agent' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-lg p-3',
                            message.sender === 'agent'
                              ? 'bg-primary text-primary-foreground'
                              : message.sender === 'system'
                              ? 'bg-muted/50 text-muted-foreground text-sm italic'
                              : 'bg-muted'
                          )}
                        >
                          <p>{message.content}</p>
                          <p className={cn(
                            'text-xs mt-1',
                            message.sender === 'agent' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          )}>
                            {format(message.timestamp, 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[44px] max-h-32 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button
                    className="bg-gradient-primary hover:opacity-90"
                    size="icon"
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="mx-auto h-12 w-12 opacity-50 mb-4" />
                <p className="font-medium">Selecione um lead</p>
                <p className="text-sm">Clique em um lead da carteira para ver o chat</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
