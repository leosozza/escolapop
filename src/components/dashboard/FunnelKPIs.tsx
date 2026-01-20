import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FunnelStep {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  percentage?: number;
}

interface FunnelKPIsProps {
  steps: FunnelStep[];
  className?: string;
}

export function FunnelKPIs({ steps, className }: FunnelKPIsProps) {
  return (
    <div className={cn('grid gap-4', className)} style={{ 
      gridTemplateColumns: `repeat(${Math.min(steps.length, 8)}, minmax(0, 1fr))` 
    }}>
      {steps.map((step, index) => (
        <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-3 rounded-xl', step.bgColor)}>
                <step.icon className={cn('h-6 w-6', step.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-3xl font-bold text-foreground">{step.value}</p>
                <p className="text-xs text-muted-foreground truncate">{step.label}</p>
                {step.percentage !== undefined && (
                  <p className={cn('text-xs font-medium mt-1', step.color)}>
                    {step.percentage.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
