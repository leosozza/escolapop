import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface CounterItem {
  label: string;
  value: number;
  colorClass: string;
}

interface AgentCardProps {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  counters: CounterItem[];
  onClick?: () => void;
  className?: string;
}

export function AgentCard({ name, avatarUrl, counters, onClick, className }: AgentCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card
      className={cn(
        'flex flex-col items-center p-3 min-w-[140px] w-[140px] cursor-pointer transition-all duration-200',
        'hover:shadow-lg hover:border-primary/50 hover:-translate-y-1',
        'bg-card border-border/50',
        className
      )}
      onClick={onClick}
    >
      {/* Foto maior - ocupa ~50% do card */}
      <Avatar className="h-20 w-20 mb-2 ring-2 ring-primary/20">
        <AvatarImage src={avatarUrl || undefined} alt={name} className="object-cover" />
        <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <h3 className="font-semibold text-xs text-center line-clamp-2 mb-1">{name}</h3>

      {counters.length > 0 && (
        <div className="w-full space-y-1">
          {counters.map((counter, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-medium',
                counter.colorClass
              )}
            >
              <span className="uppercase tracking-wide">{counter.label}</span>
              <span className="font-bold">{counter.value}</span>
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
        'flex flex-col items-center justify-center p-3 min-w-[140px] w-[140px] cursor-pointer',
        'transition-all duration-200 hover:shadow-lg hover:border-primary/50',
        'bg-muted/30 border-dashed border-2 border-muted-foreground/30',
        className
      )}
      onClick={onClick}
    >
      <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-2">
        <Plus className="h-8 w-8 text-muted-foreground" />
      </div>
      <span className="text-xs text-muted-foreground font-medium">Adicionar</span>
    </Card>
  );
}
