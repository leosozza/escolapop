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
        'flex flex-col items-center p-4 min-w-[160px] w-[160px] cursor-pointer transition-all duration-200',
        'hover:shadow-lg hover:border-primary/50 hover:-translate-y-1',
        'bg-card border-border/50',
        className
      )}
      onClick={onClick}
    >
      <Avatar className="h-24 w-24 mb-3 ring-2 ring-primary/20">
        <AvatarImage src={avatarUrl || undefined} alt={name} className="object-cover" />
        <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <h3 className="font-semibold text-sm text-center mb-3 line-clamp-2">{name}</h3>

      <div className="w-full space-y-1.5">
        {counters.map((counter, index) => (
          <div
            key={index}
            className={cn(
              'flex items-center justify-between px-2 py-1 rounded text-xs font-medium',
              counter.colorClass
            )}
          >
            <span className="uppercase tracking-wide">{counter.label}</span>
            <span className="font-bold">{counter.value}</span>
          </div>
        ))}
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
        'flex flex-col items-center justify-center p-4 min-w-[160px] w-[160px] cursor-pointer',
        'transition-all duration-200 hover:shadow-lg hover:border-primary/50',
        'bg-muted/30 border-dashed border-2 border-muted-foreground/30',
        className
      )}
      onClick={onClick}
    >
      <div className="h-24 w-24 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <Plus className="h-10 w-10 text-muted-foreground" />
      </div>
      <span className="text-sm text-muted-foreground font-medium">Adicionar</span>
    </Card>
  );
}
