import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CalendarIcon, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const scheduleSchema = z.object({
  guardian_name: z.string().min(2, 'Nome do responsável é obrigatório').max(100),
  model_name: z.string().min(2, 'Nome do modelo é obrigatório').max(100),
  phone: z.string().min(10, 'Telefone inválido').max(20),
  scheduled_date: z.date({ required_error: 'Selecione uma data' }),
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
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      guardian_name: '',
      model_name: '',
      phone: '',
      scheduled_time: '',
      agent_id: '',
    },
  });

  useEffect(() => {
    const fetchAgents = async () => {
      // Fetch agents from the dedicated agents table
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
      // Get the user's profile id for agent_id in appointments
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', data.agent_id)
        .maybeSingle();

      if (!profile) throw new Error('Perfil do agente não encontrado');

      // Create the lead with status 'agendado'
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          full_name: data.model_name,
          guardian_name: data.guardian_name,
          phone: data.phone,
          status: 'agendado',
          source: 'presencial',
          scheduled_at: data.scheduled_date.toISOString(),
          assigned_agent_id: data.agent_id,
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Create the appointment
      const { error: appointmentError } = await supabase.from('appointments').insert({
        lead_id: newLead.id,
        agent_id: profile.id,
        scheduled_date: format(data.scheduled_date, 'yyyy-MM-dd'),
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

  return (
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data do Agendamento *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              <span>Selecione</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          locale={ptBR}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
  );
}
