import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CounterItem {
  label: string;
  value: number;
  color?: string;
}

interface PersonCardProps {
  name: string;
  role?: string;
  avatarUrl?: string | null;
  counters?: CounterItem[];
  status?: 'online' | 'busy' | 'away' | 'offline';
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PersonCard({
  name,
  role,
  avatarUrl,
  counters = [],
  status,
  onClick,
  className,
  size = 'md',
}: PersonCardProps) {
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'bg-success';
      case 'busy': return 'bg-destructive';
      case 'away': return 'bg-warning';
      default: return 'bg-muted-foreground';
    }
  };

  const sizeClasses = {
    sm: {
      card: 'p-3',
      avatar: 'h-10 w-10',
      name: 'text-sm',
      role: 'text-xs',
      counter: 'text-xs',
    },
    md: {
      card: 'p-4',
      avatar: 'h-12 w-12',
      name: 'text-base',
      role: 'text-sm',
      counter: 'text-sm',
    },
    lg: {
      card: 'p-5',
      avatar: 'h-14 w-14',
      name: 'text-lg',
      role: 'text-sm',
      counter: 'text-base',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-card transition-all hover:shadow-md',
        onClick && 'cursor-pointer hover:border-primary/50',
        sizes.card,
        className
      )}
      onClick={onClick}
    >
      {/* Avatar with status indicator */}
      <div className="relative">
        <Avatar className={cn(sizes.avatar, 'ring-2 ring-primary/20')}>
          <AvatarImage src={avatarUrl || undefined} alt={name} />
          <AvatarFallback className="bg-gradient-primary text-white font-semibold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
              getStatusColor()
            )}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-foreground truncate', sizes.name)}>
          {name}
        </p>
        {role && (
          <p className={cn('text-muted-foreground truncate', sizes.role)}>
            {role}
          </p>
        )}

        {/* Counters */}
        {counters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {counters.map((counter, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className={cn(
                  'font-medium',
                  sizes.counter,
                  counter.color
                )}
              >
                {counter.value} {counter.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
