import { AlertTriangle, Clock, MessageCircle, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  type: 'overdue' | 'no_response' | 'pending_confirmation' | 'at_risk';
  title: string;
  description: string;
  leadName: string;
  timeAgo: string;
  priority: 'high' | 'medium' | 'low';
}

interface OperationalAlertsProps {
  alerts: Alert[];
  onAlertClick?: (alert: Alert) => void;
  className?: string;
}

export function OperationalAlerts({ alerts, onAlertClick, className }: OperationalAlertsProps) {
  const getAlertConfig = (type: Alert['type']) => {
    switch (type) {
      case 'overdue':
        return {
          icon: Clock,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/30',
        };
      case 'no_response':
        return {
          icon: MessageCircle,
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          borderColor: 'border-warning/30',
        };
      case 'pending_confirmation':
        return {
          icon: Calendar,
          color: 'text-info',
          bgColor: 'bg-info/10',
          borderColor: 'border-info/30',
        };
      case 'at_risk':
        return {
          icon: AlertTriangle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/30',
        };
      default:
        return {
          icon: AlertTriangle,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/10',
          borderColor: 'border-border',
        };
    }
  };

  const getPriorityBadge = (priority: Alert['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-destructive/10 text-destructive text-xs">Urgente</Badge>;
      case 'medium':
        return <Badge className="bg-warning/10 text-warning text-xs">Atenção</Badge>;
      case 'low':
        return <Badge className="bg-info/10 text-info text-xs">Baixa</Badge>;
    }
  };

  return (
    <Card className={cn('border-0 shadow-md', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Alertas Operacionais
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="mx-auto h-8 w-8 opacity-50 mb-2" />
            <p className="text-sm">Nenhum alerta no momento</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => {
                const config = getAlertConfig(alert.type);
                const Icon = config.icon;

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm',
                      config.bgColor,
                      config.borderColor
                    )}
                    onClick={() => onAlertClick?.(alert)}
                  >
                    <div className={cn('p-2 rounded-lg', config.bgColor)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm text-foreground truncate">
                          {alert.leadName}
                        </p>
                        {getPriorityBadge(alert.priority)}
                      </div>
                      <p className="text-sm text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {alert.timeAgo}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
