import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Users,
  CheckCircle2,
  Calendar,
  MessageCircleWarning,
  Clock,
  RefreshCw,
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
    reagendar: number;
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
    { label: 'Reagendar', value: totals.reagendar, icon: RefreshCw, colorClass: 'text-orange-500' },
    { label: 'Declinou', value: totals.declinou, icon: XCircle, colorClass: 'text-destructive' },
    { label: 'Limbo', value: totals.limbo, icon: HelpCircle, colorClass: 'text-muted-foreground' },
  ];

  return (
    <Card
      className={cn(
        'bg-slate-800 dark:bg-slate-900 text-white p-3 rounded-xl border-0',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm">Resumo da Carteira Comercial</h3>
        <span className="text-xs text-slate-400">Leads em Atendimento</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-1.5 bg-slate-700/50 rounded-md px-2.5 py-1.5"
            >
              <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', item.colorClass)} />
              <span className="text-base font-bold">{item.value}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
