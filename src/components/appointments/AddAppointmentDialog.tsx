import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useServiceDays } from '@/hooks/useServiceDays';
import { AddServiceDayDialog } from '@/components/crm/AddServiceDayDialog';
import { ServiceDayTimeSelect } from '@/components/scheduling/ServiceDayTimeSelect';

const appointmentSchema = z.object({
  lead_id: z.string().min(1, 'Selecione um lead'),
  service_day_id: z.string().min(1, 'Selecione o dia de atendimento'),
  scheduled_time: z.string().min(1, 'Informe o horário'),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface Lead {
  id: string;
  full_name: string;
  phone: string;
}

interface AddAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddAppointmentDialog({ open, onOpenChange, onSuccess }: AddAppointmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [addServiceDayOpen, setAddServiceDayOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { serviceDays, refetch: refetchServiceDays } = useServiceDays();

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      lead_id: '',
      service_day_id: '',
      scheduled_time: '',
      notes: '',
    },
  });

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, full_name, phone')
        .in('status', ['lead', 'em_atendimento', 'agendado'])
        .order('full_name');
      if (data) setLeads(data);
    };
    if (open) fetchLeads();
  }, [open]);

  const onSubmit = async (data: AppointmentFormData) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Get the selected service day
      const selectedDay = serviceDays.find(d => d.id === data.service_day_id);
      if (!selectedDay) throw new Error('Dia de atendimento não encontrado');

      // Get the user's profile id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) throw new Error('Perfil não encontrado');

      const scheduledDate = new Date(selectedDay.service_date + 'T12:00:00');

      const { error } = await supabase.from('appointments').insert({
        lead_id: data.lead_id,
        agent_id: profile.id,
        scheduled_date: selectedDay.service_date,
        scheduled_time: data.scheduled_time,
        notes: data.notes || null,
        confirmed: false,
      });

      if (error) throw error;

      // Update lead status to 'agendado'
      await supabase
        .from('leads')
        .update({ status: 'agendado', scheduled_at: scheduledDate.toISOString() })
        .eq('id', data.lead_id);

      toast({
        title: 'Agendamento criado!',
        description: 'O lead foi agendado com sucesso.',
      });

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Error creating appointment:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar agendamento',
        description: (error as Error).message || 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleServiceDaySuccess = () => {
    refetchServiceDays();
    setAddServiceDayOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>
              Agende um atendimento com um lead
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="lead_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o lead" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.full_name} - {lead.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Service Day and Time Select */}
              <ServiceDayTimeSelect
                selectedDayId={form.watch('service_day_id')}
                selectedTime={form.watch('scheduled_time')}
                onDayChange={(value) => form.setValue('service_day_id', value)}
                onTimeChange={(value) => form.setValue('scheduled_time', value)}
                onAddServiceDay={() => setAddServiceDayOpen(true)}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Anotações sobre o agendamento..." 
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-primary hover:opacity-90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Agendar'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AddServiceDayDialog
        open={addServiceDayOpen}
        onOpenChange={setAddServiceDayOpen}
        onSuccess={handleServiceDaySuccess}
      />
    </>
  );
}
