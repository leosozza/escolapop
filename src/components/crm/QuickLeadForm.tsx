import { useState, useEffect, useRef } from 'react';
import { CalendarClock, Loader2, AlertTriangle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useServiceDays, ServiceDay } from '@/hooks/useServiceDays';
import { useAppointmentCounts } from '@/hooks/useAppointmentCounts';
import { AddServiceDayDialog } from './AddServiceDayDialog';
import { COMMERCIAL_HOURS } from '@/lib/commercial-schedule-config';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface Agent {
  id: string;
  full_name: string;
}

interface QuickLeadFormProps {
  onSuccess: () => void;
}

export function QuickLeadForm({ onSuccess }: QuickLeadFormProps) {
  const [guardianName, setGuardianName] = useState('');
  const [modelName, setModelName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDayId, setSelectedDayId] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const guardianRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  // Fetch active agents
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  const { serviceDays, isLoading: loadingDays, refetch: refetchDays } = useServiceDays();
  
  const selectedDay = serviceDays.find(d => d.id === selectedDayId);
  const { hourCounts, isLoading: loadingCounts } = useAppointmentCounts(
    selectedDay?.service_date || null,
    selectedDay?.max_per_hour
  );

  // Focus first field on mount
  useEffect(() => {
    guardianRef.current?.focus();
  }, []);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const validateForm = () => {
    if (guardianName.trim().length < 2) {
      toast({
        variant: 'destructive',
        title: 'Nome do responsável inválido',
        description: 'Mínimo de 2 caracteres.',
      });
      return false;
    }
    if (modelName.trim().length < 2) {
      toast({
        variant: 'destructive',
        title: 'Nome do modelo inválido',
        description: 'Mínimo de 2 caracteres.',
      });
      return false;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast({
        variant: 'destructive',
        title: 'Telefone inválido',
        description: 'Mínimo de 10 dígitos.',
      });
      return false;
    }
    if (!selectedDayId) {
      toast({
        variant: 'destructive',
        title: 'Dia obrigatório',
        description: 'Selecione um dia de atendimento.',
      });
      return false;
    }
    if (!selectedTime) {
      toast({
        variant: 'destructive',
        title: 'Horário obrigatório',
        description: 'Selecione um horário.',
      });
      return false;
    }
    if (!selectedAgentId) {
      toast({
        variant: 'destructive',
        title: 'Agente obrigatório',
        description: 'Selecione o agente de relacionamento.',
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !selectedDay || !profile) return;

    setIsSubmitting(true);
    try {
      // Create lead with status 'agendado' and assigned agent
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert({
          guardian_name: guardianName.trim(),
          full_name: modelName.trim(),
          phone: phone.replace(/\D/g, ''),
          status: 'agendado',
          source: 'presencial',
          scheduled_at: `${selectedDay.service_date}T${selectedTime}:00`,
          assigned_agent_id: selectedAgentId,
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Create appointment linked to lead with same agent
      const { error: aptError } = await supabase
        .from('appointments')
        .insert({
          lead_id: leadData.id,
          agent_id: selectedAgentId,
          scheduled_date: selectedDay.service_date,
          scheduled_time: selectedTime,
          confirmed: false,
        });

      if (aptError) throw aptError;

      toast({
        title: 'Lead agendado com sucesso!',
        description: `${modelName} - ${selectedDay.label} às ${selectedTime}`,
      });

      // Reset form
      setGuardianName('');
      setModelName('');
      setPhone('');
      setSelectedDayId('');
      setSelectedTime('');
      setSelectedAgentId('');
      guardianRef.current?.focus();

      onSuccess();
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao agendar lead',
        description: 'Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedHourInfo = hourCounts.find(h => h.hour === selectedTime);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Novo Agendamento Rápido
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-6">
          {/* Nome do Responsável */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="guardian">Nome do Responsável *</Label>
            <Input
              ref={guardianRef}
              id="guardian"
              placeholder="Nome completo"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
            />
          </div>

          {/* Nome do Modelo */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="model">Nome do Modelo *</Label>
            <Input
              id="model"
              placeholder="Nome do agendado"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={16}
            />
          </div>

          {/* Dia de Atendimento */}
          <div className="space-y-2 md:col-span-2">
            <Label>Dia de Atendimento *</Label>
            <Select 
              value={selectedDayId} 
              onValueChange={(v) => {
                setSelectedDayId(v);
                setSelectedTime(''); // Reset time when day changes
              }}
              disabled={loadingDays}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingDays ? 'Carregando...' : 'Selecione o dia'} />
              </SelectTrigger>
              <SelectContent>
                {serviceDays.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
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
          </div>

          {/* Horário */}
          <div className="space-y-2 md:col-span-2">
            <Label>Horário *</Label>
            <Select
              value={selectedTime}
              onValueChange={setSelectedTime}
              disabled={!selectedDayId || loadingCounts}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingCounts ? 'Carregando...' : 'Selecione o horário'} />
              </SelectTrigger>
              <SelectContent>
                {hourCounts.map((hourInfo) => (
                  <SelectItem
                    key={hourInfo.hour}
                    value={hourInfo.hour}
                    className={cn(
                      hourInfo.isFull && 'text-destructive',
                      hourInfo.isWarning && 'text-warning'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {hourInfo.hour}
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs',
                          hourInfo.isFull && 'bg-destructive/20 text-destructive',
                          hourInfo.isWarning && 'bg-warning/20 text-warning'
                        )}
                      >
                        {hourInfo.count}/{selectedDay?.max_per_hour || 15}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agente de Relacionamento */}
          <div className="space-y-2 md:col-span-2">
            <Label>Agente de Relacionamento *</Label>
            <Select
              value={selectedAgentId}
              onValueChange={setSelectedAgentId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum agente cadastrado
                  </div>
                ) : (
                  agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {agent.full_name}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="space-y-2 md:col-span-2 flex items-end gap-2">
            <AddServiceDayDialog onSuccess={refetchDays} />
            <Button
              className="flex-1 bg-gradient-primary hover:opacity-90"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agendar Lead
            </Button>
          </div>
        </div>

        {/* Warning for full slot */}
        {selectedHourInfo?.isFull && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Este horário está lotado! Confirme antes de continuar.
            </span>
          </div>
        )}

        {/* Warning for almost full slot */}
        {selectedHourInfo?.isWarning && !selectedHourInfo?.isFull && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-warning/10 text-warning rounded-lg">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Horário quase lotado ({selectedHourInfo.count}/{selectedDay?.max_per_hour || 15})
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
