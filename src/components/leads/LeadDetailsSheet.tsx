import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  User, 
  Clock,
  MessageCircle,
  ArrowRight,
  Edit,
  CalendarPlus,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import type { Lead, LeadHistory, LeadStatus } from '@/types/database';
import { LEAD_STATUS_CONFIG, LEAD_SOURCE_CONFIG } from '@/types/database';

interface LeadDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onEdit: () => void;
  onSchedule: () => void;
}

export function LeadDetailsSheet({ 
  open, 
  onOpenChange, 
  lead,
  onEdit,
  onSchedule,
}: LeadDetailsSheetProps) {
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (lead && open) {
      fetchHistory();
    }
  }, [lead, open]);

  const fetchHistory = async () => {
    if (!lead) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('lead_history')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory((data as LeadHistory[]) || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!lead) return null;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const statusConfig = LEAD_STATUS_CONFIG[lead.status];
  const sourceConfig = LEAD_SOURCE_CONFIG[lead.source];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-gradient-primary text-white text-lg">
                {getInitials(lead.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-xl">{lead.full_name}</SheetTitle>
              <SheetDescription>
                Lead cadastrado em {format(new Date(lead.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          {/* Status and Actions */}
          <div className="flex items-center justify-between mb-6">
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} px-3 py-1`}>
              {statusConfig.label}
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button size="sm" onClick={onSchedule}>
                <CalendarPlus className="h-4 w-4 mr-1" />
                Agendar
              </Button>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4 mb-6">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Informações de Contato
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-primary" />
                <span>{lead.phone}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>{lead.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span>{sourceConfig.label}</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Course Interest */}
          {lead.course && (
            <>
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Interesse
                </h3>
                <div className="p-4 rounded-lg border bg-card">
                  <p className="font-medium">{(lead.course as { name: string }).name}</p>
                </div>
              </div>
              <Separator className="my-6" />
            </>
          )}

          {/* Campaign Info */}
          {(lead.campaign || lead.ad_set || lead.ad_name) && (
            <>
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Campanha
                </h3>
                <div className="space-y-2 text-sm">
                  {lead.campaign && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Campanha</span>
                      <span className="font-medium">{lead.campaign}</span>
                    </div>
                  )}
                  {lead.ad_set && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conjunto</span>
                      <span className="font-medium">{lead.ad_set}</span>
                    </div>
                  )}
                  {lead.ad_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Anúncio</span>
                      <span className="font-medium">{lead.ad_name}</span>
                    </div>
                  )}
                </div>
              </div>
              <Separator className="my-6" />
            </>
          )}

          {/* Notes */}
          {lead.notes && (
            <>
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Observações
                </h3>
                <p className="text-sm p-4 rounded-lg bg-muted/50">
                  {lead.notes}
                </p>
              </div>
              <Separator className="my-6" />
            </>
          )}

          {/* Timeline */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Histórico
            </h3>
            
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma movimentação registrada
              </p>
            ) : (
              <div className="space-y-4">
                {history.map((item, index) => {
                  const fromConfig = item.from_status ? LEAD_STATUS_CONFIG[item.from_status] : null;
                  const toConfig = LEAD_STATUS_CONFIG[item.to_status];
                  
                  return (
                    <div key={item.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        {index < history.length - 1 && (
                          <div className="flex-1 w-0.5 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 text-sm">
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
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {item.notes && (
                          <p className="text-sm mt-2 p-2 rounded bg-muted/50">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
