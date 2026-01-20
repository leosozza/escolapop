import { cn } from '@/lib/utils';

export interface StatusSegment {
  key: string;
  label: string;
  count: number;
  colorClass: string;
  textClass?: string;
}

interface StatusBarProps {
  segments: StatusSegment[];
  activeSegment?: string | null;
  onSegmentClick?: (key: string | null) => void;
  className?: string;
}

export function StatusBar({ segments, activeSegment, onSegmentClick, className }: StatusBarProps) {
  const total = segments.reduce((acc, seg) => acc + seg.count, 0);

  if (total === 0) {
    return (
      <div className={cn('h-12 bg-muted rounded-lg flex items-center justify-center', className)}>
        <span className="text-muted-foreground text-sm">Nenhum lead para exibir</span>
      </div>
    );
  }

  return (
    <div className={cn('flex h-12 rounded-lg overflow-hidden shadow-sm', className)}>
      {segments.map((segment, index) => {
        const width = (segment.count / total) * 100;
        if (width === 0) return null;

        const isActive = activeSegment === segment.key;
        const isFirst = index === 0;
        const isLast = index === segments.length - 1;

        return (
          <button
            key={segment.key}
            onClick={() => onSegmentClick?.(isActive ? null : segment.key)}
            className={cn(
              'flex items-center justify-center gap-2 px-3 transition-all duration-200',
              'hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              segment.colorClass,
              segment.textClass || 'text-white',
              isActive && 'ring-2 ring-ring ring-offset-2',
              isFirst && 'rounded-l-lg',
              isLast && 'rounded-r-lg'
            )}
            style={{ width: `${Math.max(width, 8)}%` }}
          >
            <span className="font-bold text-lg">{segment.count}</span>
            {width > 15 && (
              <span className="text-xs font-medium uppercase tracking-wide hidden sm:inline">
                {segment.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
