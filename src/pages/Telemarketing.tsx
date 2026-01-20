import { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneMissed,
  Calendar,
  Clock,
  User,
  Search,
  RotateCcw,
  VoicemailIcon,
  XCircle,
  CheckCircle2,
  Loader2,
  History,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { LEAD_STATUS_CONFIG, type Lead } from '@/types/database';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CallLog {
  id: string;
  lead_id: string;
  agent_id: string;
  call_type: string;
  result: string;
  duration_seconds: number | null;
  notes: string | null;
  scheduled_callback_at: string | null;
  created_at: string;
}

const CALL_RESULTS = [
  { value: 'agendado', label: 'Agendado', icon: Calendar, color: 'bg-success text-white' },
  { value: 'retornar', label: 'Retornar', icon: RotateCcw, color: 'bg-warning text-white' },
  { value: 'caixa_postal', label: 'Caixa Postal', icon: VoicemailIcon, color: 'bg-info text-white' },
  { value: 'nao_atendeu', label: 'Não Atendeu', icon: PhoneMissed, color: 'bg-muted text-muted-foreground' },
  { value: 'sem_interesse', label: 'Sem Interesse', icon: XCircle, color: 'bg-destructive text-white' },
  { value: 'numero_invalido', label: 'Número Inválido', icon: PhoneOff, color: 'bg-destructive/80 text-white' },
];

export default function Telemarketing() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callHistory, setCallHistory] = useState<CallLog[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      fetchCallHistory(selectedLead.id);
    }
  }, [selectedLead]);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, course:courses(name)')
        .in('status', ['lead', 'em_atendimento'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCallHistory = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setCallHistory(data || []);
    } catch (error) {
      console.error('Error fetching call history:', error);
    }
  };

  const startCall = (lead: Lead) => {
    setSelectedLead(lead);
    setCallStartTime(new Date());
    setNotes('');
  };

  const handleTabulate = async (result: string) => {
    if (!selectedLead || !user || !callStartTime) return;

    setIsSaving(true);
    try {
      const durationSeconds = Math.floor((new Date().getTime() - callStartTime.getTime()) / 1000);

      // Log the call
      const { error: logError } = await supabase
        .from('call_logs')
        .insert({
          lead_id: selectedLead.id,
          agent_id: user.id,
          call_type: 'outbound',
          result,
          duration_seconds: durationSeconds,
          notes: notes || null,
          scheduled_callback_at: result === 'retornar' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        });

      if (logError) throw logError;

      // Update lead status if scheduled
      if (result === 'agendado') {
        await supabase
          .from('leads')
          .update({ status: 'agendado', assigned_agent_id: user.id })
          .eq('id', selectedLead.id);
      } else if (result === 'sem_interesse') {
        await supabase
          .from('leads')
          .update({ status: 'perdido' })
          .eq('id', selectedLead.id);
      } else {
        await supabase
          .from('leads')
          .update({ status: 'em_atendimento', assigned_agent_id: user.id })
          .eq('id', selectedLead.id);
      }

      toast({
        title: 'Ligação tabulada!',
        description: `${selectedLead.full_name} - ${CALL_RESULTS.find(r => r.value === result)?.label}`,
      });

      // Reset and refresh
      setSelectedLead(null);
      setCallStartTime(null);
      setNotes('');
      fetchLeads();
    } catch (error) {
      console.error('Error tabulating call:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao tabular',
        description: 'Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLeads = leads.filter(lead =>
    lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.phone.includes(searchQuery)
  );

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
          <h1 className="text-2xl font-bold text-foreground">Telemarketing</h1>
          <p className="text-muted-foreground">
            Central de ligações e tabulação
          </p>
        </div>
        <Badge className="bg-gradient-primary text-white">
          {leads.length} leads para ligar
        </Badge>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Lista de Leads */}
        <Card className="border-0 shadow-md flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Fila de Ligações
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {filteredLeads.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Phone className="mx-auto h-12 w-12 opacity-50 mb-2" />
                    <p>Nenhum lead na fila</p>
                  </div>
                ) : (
                  filteredLeads.map((lead) => {
                    const isSelected = selectedLead?.id === lead.id;
                    return (
                      <div
                        key={lead.id}
                        className={cn(
                          'p-4 rounded-lg border cursor-pointer transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        )}
                        onClick={() => startCall(lead)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-gradient-primary text-white">
                              {getInitials(lead.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{lead.full_name}</p>
                            <p className="text-sm text-muted-foreground">{lead.phone}</p>
                          </div>
                          <Badge className={`${LEAD_STATUS_CONFIG[lead.status]?.bgColor} ${LEAD_STATUS_CONFIG[lead.status]?.color} text-xs`}>
                            {LEAD_STATUS_CONFIG[lead.status]?.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de Tabulação */}
        <Card className="lg:col-span-2 border-0 shadow-md flex flex-col min-h-0">
          {selectedLead ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 ring-2 ring-primary/30">
                      <AvatarFallback className="bg-gradient-primary text-white text-lg">
                        {getInitials(selectedLead.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle>{selectedLead.full_name}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {selectedLead.phone}
                        </span>
                        {callStartTime && (
                          <span className="flex items-center gap-1 text-primary">
                            <Clock className="h-4 w-4" />
                            Em ligação...
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedLead(null);
                      setCallStartTime(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-6 space-y-6 overflow-auto">
                <Tabs defaultValue="tabulate" className="w-full">
                  <TabsList>
                    <TabsTrigger value="tabulate">Tabular</TabsTrigger>
                    <TabsTrigger value="history">Histórico</TabsTrigger>
                  </TabsList>

                  <TabsContent value="tabulate" className="space-y-6 mt-6">
                    {/* Notas */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Observações</label>
                      <Textarea
                        placeholder="Anotações sobre a ligação..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* Botões de Tabulação */}
                    <div>
                      <label className="text-sm font-medium mb-3 block">Resultado da Ligação</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {CALL_RESULTS.map((result) => (
                          <Button
                            key={result.value}
                            className={cn('h-auto py-4 flex-col gap-2', result.color)}
                            onClick={() => handleTabulate(result.value)}
                            disabled={isSaving}
                          >
                            <result.icon className="h-6 w-6" />
                            <span>{result.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="mt-6">
                    <ScrollArea className="h-[300px]">
                      {callHistory.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <History className="mx-auto h-12 w-12 opacity-50 mb-2" />
                          <p>Nenhuma ligação anterior</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {callHistory.map((log) => {
                            const resultConfig = CALL_RESULTS.find(r => r.value === log.result);
                            return (
                              <div key={log.id} className="p-4 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge className={resultConfig?.color || 'bg-muted'}>
                                    {resultConfig?.label || log.result}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                                  </span>
                                </div>
                                {log.notes && (
                                  <p className="text-sm text-muted-foreground">{log.notes}</p>
                                )}
                                {log.duration_seconds && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Duração: {Math.floor(log.duration_seconds / 60)}:{String(log.duration_seconds % 60).padStart(2, '0')}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <User className="mx-auto h-16 w-16 opacity-50 mb-4" />
                <p className="text-lg font-medium">Selecione um lead</p>
                <p className="text-sm">Clique em um lead para iniciar a ligação</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
