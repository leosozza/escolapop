import { useServiceDays } from '@/hooks/useServiceDays';
import { useAppointmentCounts } from '@/hooks/useAppointmentCounts';
import { COMMERCIAL_HOURS } from '@/lib/commercial-schedule-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarDays, Clock, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ServiceDayTimeSelectProps {
  selectedDayId: string;
  selectedTime: string;
  onDayChange: (dayId: string) => void;
  onTimeChange: (time: string) => void;
  onAddServiceDay?: () => void;
  disabled?: boolean;
  showLabels?: boolean;
  compact?: boolean;
}

export function ServiceDayTimeSelect({
  selectedDayId,
  selectedTime,
  onDayChange,
  onTimeChange,
  onAddServiceDay,
  disabled = false,
  showLabels = true,
  compact = false,
}: ServiceDayTimeSelectProps) {
  const { serviceDays, isLoading: loadingDays } = useServiceDays();
  const selectedDay = serviceDays.find(d => d.id === selectedDayId);
  const { hourCounts, maxPerHour, isLoading: loadingCounts } = useAppointmentCounts(
    selectedDay?.service_date || null,
    selectedDay?.max_per_hour
  );

  const getHourStatus = (hour: string) => {
    const hourData = hourCounts.find(h => h.hour === hour);
    if (!hourData) return { count: 0, isFull: false, isWarning: false };
    return hourData;
  };

  return (
    <div className={cn('grid gap-4', compact ? 'grid-cols-2' : 'md:grid-cols-2')}>
      {/* Service Day Select */}
      <div className="space-y-2">
        {showLabels && (
          <Label className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-primary" />
            Dia de Atendimento *
          </Label>
        )}
        <div className="flex gap-2">
          <Select
            value={selectedDayId}
            onValueChange={onDayChange}
            disabled={disabled || loadingDays}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={loadingDays ? 'Carregando...' : 'Selecione o dia'} />
            </SelectTrigger>
            <SelectContent>
              {serviceDays.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  <AlertCircle className="mx-auto h-5 w-5 mb-1 opacity-50" />
                  Nenhum dia disponível
                </div>
              ) : (
                serviceDays.map((day) => (
                  <SelectItem key={day.id} value={day.id}>
                    {day.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {onAddServiceDay && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onAddServiceDay}
              disabled={disabled}
              title="Criar dia de atendimento"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Time Select */}
      <div className="space-y-2">
        {showLabels && (
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-primary" />
            Horário *
          </Label>
        )}
        <Select
          value={selectedTime}
          onValueChange={onTimeChange}
          disabled={disabled || !selectedDayId || loadingCounts}
        >
          <SelectTrigger>
            <SelectValue placeholder={!selectedDayId ? 'Selecione o dia primeiro' : 'Selecione o horário'} />
          </SelectTrigger>
          <SelectContent>
            {COMMERCIAL_HOURS.map((hour) => {
              const status = getHourStatus(hour);
              return (
                <SelectItem
                  key={hour}
                  value={hour}
                  className={cn(
                    status.isFull && 'text-destructive',
                    status.isWarning && !status.isFull && 'text-warning'
                  )}
                >
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span>{hour}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs ml-2',
                        status.isFull && 'border-destructive text-destructive bg-destructive/10',
                        status.isWarning && !status.isFull && 'border-warning text-warning bg-warning/10',
                        !status.isFull && !status.isWarning && 'border-muted-foreground/30'
                      )}
                    >
                      {status.count}/{maxPerHour}
                    </Badge>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedTime && selectedDayId && (
          <div className="mt-1">
            {(() => {
              const status = getHourStatus(selectedTime);
              if (status.isFull) {
                return (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Horário lotado! Confirme antes de continuar.
                  </p>
                );
              }
              if (status.isWarning) {
                return (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Horário quase cheio ({status.count}/{maxPerHour})
                  </p>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
