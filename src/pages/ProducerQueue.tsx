import { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  DollarSign,
  FileText,
  Timer,
  MessageCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { type Lead } from '@/types/database';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WhatsAppContactPanel } from '@/components/whatsapp/WhatsAppContactPanel';

interface QueueLead extends Lead {
  checked_in_at?: string;
  wait_time?: number;
}

const LOSS_REASONS = [
  'Preço alto',
  'Sem interesse no momento',
  'Vai pensar',
  'Preferiu concorrente',
  'Não tem disponibilidade',
  'Outro',
];

export default function ProducerQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [queue, setQueue] = useState<QueueLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<QueueLead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('whatsapp');
  
  // Close dialog state
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [closeResult, setCloseResult] = useState<'fechado' | 'nao_fechado' | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [proposalNotes, setProposalNotes] = useState('');
  const [proposalValue, setProposalValue] = useState('');

  useEffect(() => {
    fetchQueue();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('producer-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `status=eq.compareceu` },
        () => fetchQueue()
      )
      .subscribe();

    // Update wait times every minute
    const interval = setInterval(() => {
      setQueue(prev => prev.map(lead => ({
        ...lead,
        wait_time: lead.checked_in_at 
          ? differenceInMinutes(new Date(), new Date(lead.checked_in_at))
          : 0
      })));
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchQueue = async () => {
    try {
      // Get leads that have checked in (compareceu status) and are assigned to current producer
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          course:courses(name),
          appointment:appointments(checked_in_at)
        `)
        .eq('status', 'compareceu')
        .order('updated_at', { ascending: true });

      if (error) throw error;

      // Calculate wait times
      const leadsWithWaitTime = (data || []).map((lead: any) => ({
        ...lead,
        checked_in_at: lead.appointment?.[0]?.checked_in_at,
        wait_time: lead.appointment?.[0]?.checked_in_at 
          ? differenceInMinutes(new Date(), new Date(lead.appointment[0].checked_in_at))
          : 0
      }));

      setQueue(leadsWithWaitTime);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startAttendance = (lead: QueueLead) => {
    setSelectedLead(lead);
  };

  const openCloseDialog = (result: 'fechado' | 'nao_fechado') => {
    setCloseResult(result);
    setIsCloseDialogOpen(true);
  };

  const handleCloseAttendance = async () => {
    if (!selectedLead || !closeResult || !user) return;

    setIsSaving(true);
    try {
      // Update lead status
      const updateData: any = {
        status: closeResult,
        notes: proposalNotes || selectedLead.notes,
      };

      if (closeResult === 'nao_fechado') {
        updateData.notes = `${selectedLead.notes || ''}\n\nMotivo da perda: ${lossReason}`.trim();
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', selectedLead.id);

      if (error) throw error;

      // Log history
      await supabase
        .from('lead_history')
        .insert({
          lead_id: selectedLead.id,
          from_status: 'compareceu',
          to_status: closeResult,
          changed_by: user.id,
          notes: closeResult === 'fechado' 
            ? `Proposta aceita. Valor: R$ ${proposalValue}` 
            : `Não fechou. Motivo: ${lossReason}`,
        });

      toast({
        title: closeResult === 'fechado' ? 'Venda realizada!' : 'Lead encerrado',
        description: `${selectedLead.full_name} - ${closeResult === 'fechado' ? 'Fechou proposta!' : 'Não fechou'}`,
      });

      // Reset state
      setSelectedLead(null);
      setIsCloseDialogOpen(false);
      setCloseResult(null);
      setLossReason('');
      setProposalNotes('');
      setProposalValue('');
      fetchQueue();
    } catch (error) {
      console.error('Error closing attendance:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao encerrar',
        description: 'Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getWaitTimeColor = (minutes: number) => {
    if (minutes > 30) return 'text-destructive';
    if (minutes > 15) return 'text-warning';
    return 'text-success';
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendimento</h1>
          <p className="text-muted-foreground">
            Gestão de comunicação e fila de atendimento
          </p>
        </div>
        {activeMainTab === 'queue' && (
          <Badge variant="outline" className="text-lg py-2 px-4">
            <Users className="h-5 w-5 mr-2" />
            {queue.length} na fila
          </Badge>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2">
            <Users className="h-4 w-4" />
            Fila de Atendimento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="flex-1 mt-4">
          <WhatsAppContactPanel />
        </TabsContent>

        <TabsContent value="queue" className="flex-1 mt-4">
          <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fila de Espera */}
        <Card className="border-0 shadow-md flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Fila de Espera
            </CardTitle>
            <CardDescription>Clientes aguardando atendimento</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {queue.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 opacity-50 mb-2" />
                    <p>Nenhum cliente na fila</p>
                    <p className="text-sm">Aguarde novos check-ins</p>
                  </div>
                ) : (
                  queue.map((lead, index) => {
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
                        onClick={() => startAttendance(lead)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-gradient-primary text-white">
                                {getInitials(lead.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="absolute -top-1 -left-1 h-6 w-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{lead.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {lead.course && typeof lead.course === 'object' && 'name' in lead.course
                                ? (lead.course as { name: string }).name
                                : 'Curso não informado'}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className={cn('flex items-center gap-1 text-sm font-medium', getWaitTimeColor(lead.wait_time || 0))}>
                              <Timer className="h-4 w-4" />
                              {lead.wait_time || 0} min
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de Atendimento */}
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
                        <span>{selectedLead.phone}</span>
                        <span className={cn('flex items-center gap-1', getWaitTimeColor(selectedLead.wait_time || 0))}>
                          <Timer className="h-4 w-4" />
                          Esperando há {selectedLead.wait_time || 0} min
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-6 space-y-6 overflow-auto">
                {/* Info do Lead */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Curso de Interesse</p>
                    <p className="font-medium">
                      {selectedLead.course && typeof selectedLead.course === 'object' && 'name' in selectedLead.course
                        ? (selectedLead.course as { name: string }).name
                        : 'Não informado'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Origem</p>
                    <p className="font-medium capitalize">{selectedLead.source}</p>
                  </div>
                </div>

                {/* Notas anteriores */}
                {selectedLead.notes && (
                  <div>
                    <p className="text-sm font-medium mb-2">Observações anteriores</p>
                    <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
                      {selectedLead.notes}
                    </p>
                  </div>
                )}

                <Separator />

                {/* Ações */}
                <div>
                  <p className="text-sm font-medium mb-4">Encerrar Atendimento</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      className="h-auto py-6 flex-col gap-2 bg-success hover:bg-success/90"
                      onClick={() => openCloseDialog('fechado')}
                    >
                      <CheckCircle2 className="h-8 w-8" />
                      <span className="text-lg font-semibold">Fechou</span>
                      <span className="text-xs opacity-80">Aceitou proposta</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto py-6 flex-col gap-2 border-destructive text-destructive hover:bg-destructive hover:text-white"
                      onClick={() => openCloseDialog('nao_fechado')}
                    >
                      <XCircle className="h-8 w-8" />
                      <span className="text-lg font-semibold">Não Fechou</span>
                      <span className="text-xs opacity-80">Recusou proposta</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="mx-auto h-16 w-16 opacity-50 mb-4" />
                <p className="text-lg font-medium">Selecione um cliente</p>
                <p className="text-sm">Clique em um cliente da fila para iniciar o atendimento</p>
              </div>
            </div>
          )}
        </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de Encerramento */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {closeResult === 'fechado' ? 'Confirmar Venda' : 'Registrar Não Fechamento'}
            </DialogTitle>
            <DialogDescription>
              {closeResult === 'fechado' 
                ? 'Informe os dados da proposta aceita'
                : 'Informe o motivo pelo qual não fechou'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {closeResult === 'fechado' ? (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Valor da Proposta</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={proposalValue}
                      onChange={(e) => setProposalValue(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Observações</label>
                  <Textarea
                    placeholder="Detalhes da proposta..."
                    value={proposalNotes}
                    onChange={(e) => setProposalNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Motivo da Perda</label>
                  <Select value={lossReason} onValueChange={setLossReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOSS_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Observações adicionais</label>
                  <Textarea
                    placeholder="Detalhes..."
                    value={proposalNotes}
                    onChange={(e) => setProposalNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCloseAttendance}
              disabled={isSaving || (closeResult === 'nao_fechado' && !lossReason)}
              className={closeResult === 'fechado' ? 'bg-success hover:bg-success/90' : ''}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {closeResult === 'fechado' ? 'Confirmar Venda' : 'Registrar Não Fechamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
