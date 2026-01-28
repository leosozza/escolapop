import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Plus, Pencil } from 'lucide-react';

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
  onEdit?: () => void;
  className?: string;
}

export function AgentCard({ name, avatarUrl, metrics, onClick, onEdit, className }: AgentCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const metricItems = metrics ? [
    { label: 'Agendados', value: metrics.agendados },
    { label: 'Confirmados', value: metrics.confirmados },
    { label: 'S/ Resposta', value: metrics.semResposta },
    { label: 'Reagendar', value: metrics.reagendar },
    { label: 'Fechados', value: metrics.fechados },
    { label: 'N/ Fechados', value: metrics.naoFechados },
  ] : [];

  return (
    <Card
      className={cn(
        'flex flex-col min-w-[160px] w-[160px] cursor-pointer transition-all duration-200 overflow-hidden',
        'hover:shadow-lg hover:border-primary/50 hover:-translate-y-1',
        'bg-card border-border/50',
        className
      )}
      onClick={onClick}
    >
      {/* Square photo - full width at top */}
      <div className="relative w-full aspect-square bg-muted">
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <span className="text-3xl font-bold text-primary">
              {getInitials(name)}
            </span>
          </div>
        )}
        {/* Edit button overlay */}
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="p-3">
        <h3 className="font-bold text-sm text-center line-clamp-1 mb-2">{name}</h3>

        {metricItems.length > 0 && (
          <div className="w-full space-y-0.5">
            {metricItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-1.5 py-0.5 text-[9px] font-medium"
              >
                <span className="uppercase tracking-wide text-muted-foreground">{item.label}</span>
                <span className="font-bold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
        'flex flex-col min-w-[160px] w-[160px] cursor-pointer overflow-hidden',
        'transition-all duration-200 hover:shadow-lg hover:border-primary/50',
        'bg-muted/30 border-dashed border-2 border-muted-foreground/30',
        className
      )}
      onClick={onClick}
    >
      {/* Square placeholder at top */}
      <div className="w-full aspect-square bg-muted/30 flex items-center justify-center">
        <Plus className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="p-3">
        <span className="text-sm text-muted-foreground font-medium block text-center">Adicionar</span>
      </div>
    </Card>
  );
}
