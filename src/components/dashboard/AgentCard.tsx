import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface AgentMetrics {
  agendados: number;
  confirmados: number;
  semResposta: number;
  reagendar: number;
  fechados: number;
  naoFechados: number;
}

interface AgentCardProps {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  metrics?: AgentMetrics;
  onClick?: () => void;
  className?: string;
}

export function AgentCard({ name, avatarUrl, metrics, onClick, className }: AgentCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const metricItems = metrics ? [
    { label: 'Agendados', value: metrics.agendados, colorClass: 'bg-info/10 text-info' },
    { label: 'Confirmados', value: metrics.confirmados, colorClass: 'bg-success/10 text-success' },
    { label: 'S/ Resposta', value: metrics.semResposta, colorClass: 'bg-warning/10 text-warning' },
    { label: 'Reagendar', value: metrics.reagendar, colorClass: 'bg-orange-500/10 text-orange-500' },
    { label: 'Fechados', value: metrics.fechados, colorClass: 'bg-violet-500/10 text-violet-600' },
    { label: 'N/ Fechados', value: metrics.naoFechados, colorClass: 'bg-destructive/10 text-destructive' },
  ] : [];

  return (
    <Card
      className={cn(
        'flex flex-col items-center p-3 min-w-[150px] w-[150px] cursor-pointer transition-all duration-200',
        'hover:shadow-lg hover:border-primary/50 hover:-translate-y-1',
        'bg-card border-border/50',
        className
      )}
      onClick={onClick}
    >
      {/* Foto maior - ocupa ~50% do card */}
      <Avatar className="h-16 w-16 mb-2 ring-2 ring-primary/20">
        <AvatarImage src={avatarUrl || undefined} alt={name} className="object-cover" />
        <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <h3 className="font-semibold text-xs text-center line-clamp-1 mb-1.5">{name}</h3>

      {metricItems.length > 0 && (
        <div className="w-full space-y-0.5">
          {metricItems.map((item, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center justify-between px-1.5 py-0.5 rounded text-[9px] font-medium',
                item.colorClass
              )}
            >
              <span className="uppercase tracking-wide truncate">{item.label}</span>
              <span className="font-bold ml-1">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

interface AddAgentCardProps {
  onClick?: () => void;
  className?: string;
}

export function AddAgentCard({ onClick, className }: AddAgentCardProps) {
  return (
    <Card
      className={cn(
        'flex flex-col items-center justify-center p-3 min-w-[150px] w-[150px] cursor-pointer',
        'transition-all duration-200 hover:shadow-lg hover:border-primary/50',
        'bg-muted/30 border-dashed border-2 border-muted-foreground/30',
        className
      )}
      onClick={onClick}
    >
      <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-2">
        <Plus className="h-8 w-8 text-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground font-medium">Adicionar</span>
    </Card>
  );
}
