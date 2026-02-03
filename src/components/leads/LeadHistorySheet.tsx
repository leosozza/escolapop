import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, 
  Mail, 
  Calendar, 
  Clock,
  MessageCircle,
  ArrowRight,
  Edit,
  CalendarPlus,
  User,
  History,
  FileText,
  Maximize2,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { LeadStatus } from '@/types/database';
import { LEAD_STATUS_CONFIG, LEAD_SOURCE_CONFIG } from '@/types/database';

interface LeadHistoryData {
  id: string;
  from_status: LeadStatus | null;
  to_status: LeadStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
  profile?: { full_name: string } | null;
}

interface AppointmentData {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  confirmed: boolean | null;
  attended: boolean | null;
  checked_in_at: string | null;
  notes: string | null;
  created_at: string;
  agent?: { full_name: string } | null;
}

interface LeadData {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  guardian_name: string | null;
  source: string;
  status: LeadStatus;
  notes: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  course?: { name: string } | null;
}

interface LeadHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadData | null;
  onEdit?: () => void;
  onSchedule?: () => void;
}

export function LeadHistorySheet({ 
  open, 
  onOpenChange, 
  lead,
  onEdit,
  onSchedule,
}: LeadHistorySheetProps) {
  const [history, setHistory] = useState<LeadHistoryData[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (lead && open) {
      fetchData();
    }
  }, [lead, open]);

  const fetchData = async () => {
    if (!lead) return;
    setIsLoading(true);
    try {
      // Fetch history
      const { data: historyData } = await supabase
        .from('lead_history')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      // Fetch profile names for changed_by
      const historyWithProfiles = await Promise.all(
        (historyData || []).map(async (item) => {
          if (item.changed_by) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', item.changed_by)
              .single();
            return { ...item, profile };
          }
          return item;
        })
      );

      setHistory(historyWithProfiles as LeadHistoryData[]);

      // Fetch appointments
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select(`
          *,
          agent:agents(full_name)
        `)
        .eq('lead_id', lead.id)
        .order('scheduled_date', { ascending: false });

      setAppointments((appointmentsData as unknown as AppointmentData[]) || []);
    } catch (error) {
      console.error('Error fetching lead data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!lead) return null;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const statusConfig = LEAD_STATUS_CONFIG[lead.status];
  const sourceConfig = LEAD_SOURCE_CONFIG[lead.source as keyof typeof LEAD_SOURCE_CONFIG];

  const Content = () => (
    <>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-gradient-primary text-white text-lg">
              {getInitials(lead.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{lead.full_name}</h2>
            <p className="text-sm text-muted-foreground">
              Lead desde {format(new Date(lead.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            {lead.guardian_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Responsável: {lead.guardian_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusConfig.bgColor} ${statusConfig.color} px-3 py-1`}>
            {statusConfig.label}
          </Badge>
          {!isFullscreen && (
            <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(true)}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-1" />
            Editar
          </Button>
        )}
        {onSchedule && (
          <Button size="sm" onClick={onSchedule}>
            <CalendarPlus className="h-4 w-4 mr-1" />
            Agendar
          </Button>
        )}
      </div>

      {/* Contact Info */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <Phone className="h-4 w-4 text-primary" />
          <span className="text-sm">{lead.phone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Mail className="h-4 w-4 text-primary" />
            <span className="text-sm truncate">{lead.email}</span>
          </div>
        )}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-sm">{sourceConfig?.label || lead.source}</span>
        </div>
        {lead.course?.name && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm truncate">{lead.course.name}</span>
          </div>
        )}
      </div>

      <Separator className="mb-6" />

      {/* Tabs for History */}
      <Tabs defaultValue="tabulacoes" className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tabulacoes" className="gap-2">
            <History className="h-4 w-4" />
            Tabulações
          </TabsTrigger>
          <TabsTrigger value="agendamentos" className="gap-2">
            <Calendar className="h-4 w-4" />
            Agendamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tabulacoes" className="mt-4">
          <ScrollArea className={isFullscreen ? "h-[calc(100vh-400px)]" : "h-[350px]"}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma tabulação registrada
              </p>
            ) : (
              <div className="space-y-4">
                {history.map((item, index) => {
                  const fromConfig = item.from_status ? LEAD_STATUS_CONFIG[item.from_status] : null;
                  const toConfig = LEAD_STATUS_CONFIG[item.to_status];
                  
                  return (
                    <Card key={item.id} className="border-l-4" style={{ borderLeftColor: 'hsl(var(--primary))' }}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {fromConfig && (
                            <>
                              <Badge variant="outline" className={`${fromConfig.bgColor} ${fromConfig.color}`}>
                                {fromConfig.label}
                              </Badge>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </>
                          )}
                          <Badge className={`${toConfig.bgColor} ${toConfig.color}`}>
                            {toConfig.label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {item.profile?.full_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {item.profile.full_name}
                            </span>
                          )}
                        </div>
                        
                        {item.notes && (
                          <p className="text-sm mt-2 p-2 rounded bg-muted/50">
                            {item.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="agendamentos" className="mt-4">
          <ScrollArea className={isFullscreen ? "h-[calc(100vh-400px)]" : "h-[350px]"}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum agendamento registrado
              </p>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <Card key={appointment.id} className="border-l-4" style={{ 
                    borderLeftColor: appointment.attended 
                      ? 'hsl(var(--success))' 
                      : appointment.confirmed 
                        ? 'hsl(142, 76%, 36%)' 
                        : 'hsl(var(--warning))'
                  }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {format(new Date(appointment.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="text-muted-foreground">às</span>
                          <span className="font-medium">{appointment.scheduled_time}</span>
                        </div>
                        <div className="flex gap-1">
                          {appointment.confirmed && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600">
                              Confirmado
                            </Badge>
                          )}
                          {appointment.attended && (
                            <Badge className="bg-success/10 text-success">
                              Compareceu
                            </Badge>
                          )}
                          {!appointment.confirmed && !appointment.attended && (
                            <Badge variant="outline" className="bg-warning/10 text-warning">
                              Pendente
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {appointment.agent?.full_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Agente: {appointment.agent.full_name}
                        </p>
                      )}
                      
                      {appointment.checked_in_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Check-in: {format(new Date(appointment.checked_in_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      
                      {appointment.notes && (
                        <p className="text-sm mt-2 p-2 rounded bg-muted/50">
                          {appointment.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Notes */}
      {lead.notes && (
        <>
          <Separator className="my-4" />
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">
              Observações
            </h3>
            <p className="text-sm p-3 rounded-lg bg-muted/50">
              {lead.notes}
            </p>
          </div>
        </>
      )}
    </>
  );

  // Fullscreen Dialog
  if (isFullscreen) {
    return (
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>Histórico do Lead</DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            <Content />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>Histórico do Lead</SheetTitle>
          <SheetDescription>Detalhes e histórico do lead</SheetDescription>
        </SheetHeader>
        <Content />
      </SheetContent>
    </Sheet>
  );
}
