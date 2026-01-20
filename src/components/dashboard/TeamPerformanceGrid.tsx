import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PersonCard } from './PersonCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string | null;
  counters: { label: string; value: number; color?: string }[];
  status?: 'online' | 'busy' | 'away' | 'offline';
}

interface TeamPerformanceGridProps {
  title: string;
  icon: LucideIcon;
  members: TeamMember[];
  onMemberClick?: (member: TeamMember) => void;
  emptyMessage?: string;
  className?: string;
}

export function TeamPerformanceGrid({
  title,
  icon: Icon,
  members,
  onMemberClick,
  emptyMessage = 'Nenhum membro encontrado',
  className,
}: TeamPerformanceGridProps) {
  return (
    <Card className={cn('border-0 shadow-md', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-primary" />
          {title}
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {members.length} membros
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon className="mx-auto h-8 w-8 opacity-50 mb-2" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {members.map((member) => (
                <PersonCard
                  key={member.id}
                  name={member.name}
                  role={member.role}
                  avatarUrl={member.avatarUrl}
                  counters={member.counters}
                  status={member.status}
                  onClick={() => onMemberClick?.(member)}
                  size="sm"
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
