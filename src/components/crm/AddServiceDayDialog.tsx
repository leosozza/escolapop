import { useState } from 'react';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getWeekdayName, formatServiceDay, DEFAULT_MAX_PER_HOUR } from '@/lib/commercial-schedule-config';

interface AddServiceDayDialogProps {
  onSuccess: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** If true, the dialog manages its own open state via DialogTrigger */
  standalone?: boolean;
}

export function AddServiceDayDialog({ 
  onSuccess, 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  standalone = false,
}: AddServiceDayDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [maxPerHour, setMaxPerHour] = useState(DEFAULT_MAX_PER_HOUR);
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();

  // Use controlled or internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const handleSubmit = async () => {
    if (!selectedDate) {
      toast({
        variant: 'destructive',
        title: 'Data obrigatória',
        description: 'Selecione uma data para o dia de atendimento.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const serviceDateStr = format(selectedDate, 'yyyy-MM-dd');
      const weekdayName = getWeekdayName(selectedDate);

      const { error } = await supabase
        .from('service_days')
        .insert({
          service_date: serviceDateStr,
          weekday_name: weekdayName,
          max_per_hour: maxPerHour,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            variant: 'destructive',
            title: 'Data já existe',
            description: 'Este dia de atendimento já foi criado.',
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Dia de atendimento criado!',
        description: formatServiceDay(selectedDate),
      });

      setOpen(false);
      setSelectedDate(undefined);
      setMaxPerHour(DEFAULT_MAX_PER_HOUR);
      onSuccess();
    } catch (error) {
      console.error('Error creating service day:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar dia de atendimento',
        description: 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dialogContent = (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Criar Dia de Atendimento</DialogTitle>
        <DialogDescription>
          Adicione uma nova data disponível para agendamentos comerciais.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Data *</Label>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < today}
              locale={ptBR}
              className="rounded-md border"
            />
          </div>
        </div>

        {selectedDate && (
          <div className="p-3 bg-muted rounded-lg text-center">
            <span className="font-medium">{formatServiceDay(selectedDate)}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="maxPerHour">Limite por horário</Label>
          <Input
            id="maxPerHour"
            type="number"
            min={1}
            max={50}
            value={maxPerHour}
            onChange={(e) => setMaxPerHour(parseInt(e.target.value) || DEFAULT_MAX_PER_HOUR)}
          />
          <p className="text-xs text-muted-foreground">
            Quantidade máxima de agendamentos por horário (padrão: 15)
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading || !selectedDate}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  // Standalone mode with trigger
  if (standalone) {
    return (
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Criar Dia de Atendimento
          </Button>
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  // Controlled mode without trigger
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {dialogContent}
    </Dialog>
  );
}
