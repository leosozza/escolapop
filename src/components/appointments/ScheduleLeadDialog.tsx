import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const scheduleSchema = z.object({
  guardian_name: z.string().min(2, 'Nome do responsável é obrigatório').max(100),
  model_name: z.string().min(2, 'Nome do modelo é obrigatório').max(100),
  phone: z.string().min(10, 'Telefone inválido').max(20),
  service_day_id: z.string().min(1, 'Selecione o dia de atendimento'),
  scheduled_time: z.string().min(1, 'Informe o horário'),
  agent_id: z.string().min(1, 'Selecione o agente'),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

interface Agent {
  id: string;
  full_name: string;
}

interface ScheduleLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ScheduleLeadDialog({ open, onOpenChange, onSuccess }: ScheduleLeadDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [addServiceDayOpen, setAddServiceDayOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { serviceDays, refetch: refetchServiceDays } = useServiceDays();

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      guardian_name: '',
      model_name: '',
      phone: '',
      service_day_id: '',
      scheduled_time: '',
      agent_id: '',
    },
  });

  useEffect(() => {
    const fetchAgents = async () => {
      const { data: agentsData, error } = await supabase
        .from('agents')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      if (!error && agentsData) {
        setAgents(agentsData.map(a => ({ id: a.id, full_name: a.full_name })));
      }
    };

    if (open) {
      fetchAgents();
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (data: ScheduleFormData) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Get the selected service day
      const selectedDay = serviceDays.find(d => d.id === data.service_day_id);
      if (!selectedDay) throw new Error('Dia de atendimento não encontrado');

      // Get the user's profile id for agent_id in appointments
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', data.agent_id)
        .maybeSingle();

      if (!profile) throw new Error('Perfil do agente não encontrado');

      const scheduledDate = new Date(selectedDay.service_date + 'T12:00:00');

      // Create the lead with status 'agendado'
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          full_name: data.model_name,
          guardian_name: data.guardian_name,
          phone: data.phone,
          status: 'agendado',
          source: 'presencial',
          scheduled_at: scheduledDate.toISOString(),
          assigned_agent_id: data.agent_id,
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Create the appointment
      const { error: appointmentError } = await supabase.from('appointments').insert({
        lead_id: newLead.id,
        agent_id: profile.id,
        scheduled_date: selectedDay.service_date,
        scheduled_time: data.scheduled_time,
        confirmed: false,
      });

      if (appointmentError) throw appointmentError;

      toast({
        title: 'Lead agendado com sucesso!',
        description: `${data.model_name} foi adicionado à carteira comercial.`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Error scheduling lead:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao agendar',
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Agendar Novo Lead
            </DialogTitle>
            <DialogDescription>
              Cadastre um novo lead na carteira comercial com agendamento
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="guardian_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Responsável *</FormLabel>
                      <FormControl>
                        <Input placeholder="Maria Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Modelo *</FormLabel>
                      <FormControl>
                        <Input placeholder="João Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
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
                name="agent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agente Responsável *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o agente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    'Agendar Lead'
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
