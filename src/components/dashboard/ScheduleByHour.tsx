import { Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { COMMERCIAL_HOURS } from '@/lib/commercial-schedule-config';

interface ScheduleSlot {
  hour: string;
  count: number;
  leads: { id: string; name: string; status: 'agendado' | 'confirmado' }[];
}

interface ScheduleByHourProps {
  slots: ScheduleSlot[];
  className?: string;
}

export function ScheduleByHour({ slots, className }: ScheduleByHourProps) {
  const maxCount = Math.max(...slots.map(s => s.count), 1);

  return (
    <Card className={cn('border-0 shadow-md', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-primary" />
          Agendamentos por Hora
          <Badge variant="secondary" className="ml-auto">
            {slots.reduce((acc, s) => acc + s.count, 0)} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {slots.length === 0 || slots.every(s => s.count === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="mx-auto h-8 w-8 opacity-50 mb-2" />
            <p className="text-sm">Nenhum agendamento para hoje</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {slots.map((slot) => {
                const barWidth = (slot.count / maxCount) * 100;
                const confirmedCount = slot.leads.filter(l => l.status === 'confirmado').length;
                const pendingCount = slot.leads.filter(l => l.status === 'agendado').length;

                return (
                  <div key={slot.hour} className="group">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium w-14 text-muted-foreground">
                        {slot.hour}
                      </span>
                      <div className="flex-1 relative h-8 bg-muted/30 rounded-lg overflow-hidden">
                        {/* Confirmed bar */}
                        <div
                          className="absolute left-0 top-0 h-full bg-success/80 transition-all duration-300"
                          style={{ width: `${(confirmedCount / maxCount) * 100}%` }}
                        />
                        {/* Pending bar (stacked after confirmed) */}
                        <div
                          className="absolute top-0 h-full bg-warning/80 transition-all duration-300"
                          style={{ 
                            left: `${(confirmedCount / maxCount) * 100}%`,
                            width: `${(pendingCount / maxCount) * 100}%` 
                          }}
                        />
                        {/* Count label */}
                        {slot.count > 0 && (
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-xs font-semibold text-white drop-shadow-sm">
                              {slot.count} {slot.count === 1 ? 'agendamento' : 'agendamentos'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 w-16 justify-end">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold">{slot.count}</span>
                      </div>
                    </div>
                    {/* Expanded names on hover */}
                    {slot.leads.length > 0 && (
                      <div className="ml-[68px] flex flex-wrap gap-1 mt-1">
                        {slot.leads.slice(0, 4).map((lead) => (
                          <Badge 
                            key={lead.id} 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              lead.status === 'confirmado' 
                                ? 'border-success/50 text-success bg-success/5' 
                                : 'border-warning/50 text-warning bg-warning/5'
                            )}
                          >
                            {lead.name.split(' ')[0]}
                          </Badge>
                        ))}
                        {slot.leads.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{slot.leads.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-success/80" />
            <span className="text-xs text-muted-foreground">Confirmado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-warning/80" />
            <span className="text-xs text-muted-foreground">Pendente</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
