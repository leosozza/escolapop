import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Users,
  CheckCircle2,
  Calendar,
  MessageCircleWarning,
  Clock,
  XCircle,
  HelpCircle,
} from 'lucide-react';

interface SummaryItem {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
}

interface SummaryPanelProps {
  totals: {
    total: number;
    confirmados: number;
    agendados: number;
    semResposta: number;
    atrasados: number;
    declinou: number;
    limbo: number;
  };
  className?: string;
}

export function SummaryPanel({ totals, className }: SummaryPanelProps) {
  const items: SummaryItem[] = [
    { label: 'Total', value: totals.total, icon: Users, colorClass: 'text-primary' },
    { label: 'Confirmados', value: totals.confirmados, icon: CheckCircle2, colorClass: 'text-success' },
    { label: 'Agendados', value: totals.agendados, icon: Calendar, colorClass: 'text-info' },
    { label: 'Sem Resposta', value: totals.semResposta, icon: MessageCircleWarning, colorClass: 'text-warning' },
    { label: 'Atrasados', value: totals.atrasados, icon: Clock, colorClass: 'text-destructive' },
    { label: 'Declinou', value: totals.declinou, icon: XCircle, colorClass: 'text-destructive' },
    { label: 'Limbo', value: totals.limbo, icon: HelpCircle, colorClass: 'text-muted-foreground' },
  ];

  return (
    <Card
      className={cn(
        'bg-slate-800 dark:bg-slate-900 text-white p-4 rounded-xl border-0',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Resumo do Período</h3>
        <span className="text-sm text-slate-400">Visão Geral</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-2 bg-slate-700/50 rounded-lg p-3"
            >
              <Icon className={cn('h-5 w-5 flex-shrink-0', item.colorClass)} />
              <div className="flex flex-col">
                <span className="text-xl font-bold">{item.value}</span>
                <span className="text-xs text-slate-400 uppercase tracking-wide">
                  {item.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
