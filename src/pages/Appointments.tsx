import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { format, addDays, isSameDay, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AddAppointmentDialog } from '@/components/appointments/AddAppointmentDialog';
import { ScheduleLeadDialog } from '@/components/appointments/ScheduleLeadDialog';
import { AppointmentCard } from '@/components/appointments/AppointmentCard';
import { ScheduleByHour } from '@/components/dashboard/ScheduleByHour';
import { useServiceDays } from '@/hooks/useServiceDays';
import { COMMERCIAL_HOURS } from '@/lib/commercial-schedule-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AppointmentWithDetails {
  id: string;
  lead_id: string;
  agent_id: string;
  scheduled_date: string;
  scheduled_time: string;
  confirmed: boolean;
  attended: boolean | null;
  notes: string | null;
  created_at: string;
  lead: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
  };
  agent: {
    id: string;
    full_name: string;
  };
}

interface ScheduleSlot {
  hour: string;
  count: number;
  leads: { id: string; name: string; status: 'agendado' | 'confirmado' }[];
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceDayId, setSelectedServiceDayId] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isScheduleLeadOpen, setIsScheduleLeadOpen] = useState(false);
  const { toast } = useToast();
  const { serviceDays, isLoading: loadingDays } = useServiceDays();

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          lead:leads(id, full_name, phone, email)
        `)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      
      // Fetch agent info separately since FK might not exist
      const appointmentsWithAgent = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: agent } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', apt.agent_id)
            .maybeSingle();
          
          return {
            ...apt,
            agent: agent || { id: apt.agent_id, full_name: 'Agente' }
          };
        })
      );
      
      setAppointments((appointmentsWithAgent as unknown as AppointmentWithDetails[]) || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar agendamentos',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Set default selected service day to first available or today
  useEffect(() => {
    if (serviceDays.length > 0 && !selectedServiceDayId) {
      // Try to find today's service day
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayService = serviceDays.find(d => d.service_date === today);
      if (todayService) {
        setSelectedServiceDayId(todayService.id);
      } else {
        // Default to first available
        setSelectedServiceDayId(serviceDays[0].id);
      }
    }
  }, [serviceDays, selectedServiceDayId]);

  const selectedServiceDay = serviceDays.find(d => d.id === selectedServiceDayId);
  const selectedDate = selectedServiceDay 
    ? new Date(selectedServiceDay.service_date + 'T12:00:00') 
    : new Date();

  const handleConfirm = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ confirmed: true })
        .eq('id', id);

      if (error) throw error;
      
      setAppointments(appointments.map(apt => 
        apt.id === id ? { ...apt, confirmed: true } : apt
      ));
      
      toast({ title: 'Agendamento confirmado!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao confirmar' });
    }
  };

  const handleAttended = async (id: string, attended: boolean) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ attended })
        .eq('id', id);

      if (error) throw error;
      
      setAppointments(appointments.map(apt => 
        apt.id === id ? { ...apt, attended } : apt
      ));
      
      toast({ 
        title: attended ? 'Presença registrada!' : 'Falta registrada',
        variant: attended ? 'default' : 'destructive'
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao registrar' });
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = apt.lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.lead.phone.includes(searchQuery);
    
    // Filter by selected service day
    const matchesDate = selectedServiceDay 
      ? apt.scheduled_date === selectedServiceDay.service_date
      : isSameDay(parseISO(apt.scheduled_date), new Date());
    
    return matchesSearch && matchesDate;
  });

  // Schedule by hour slots for selected date using COMMERCIAL_HOURS
  const scheduleSlots: ScheduleSlot[] = useMemo(() => {
    const dayAppointments = appointments.filter(apt => {
      if (selectedServiceDay) {
        return apt.scheduled_date === selectedServiceDay.service_date;
      }
      return isSameDay(parseISO(apt.scheduled_date), selectedDate);
    });

    return COMMERCIAL_HOURS.map((hour) => {
      const appointmentsInHour = dayAppointments.filter((apt) => {
        return apt.scheduled_time.startsWith(hour.slice(0, 2));
      });

      return {
        hour,
        count: appointmentsInHour.length,
        leads: appointmentsInHour.map((apt) => ({
          id: apt.id,
          name: apt.lead.full_name,
          status: apt.confirmed ? 'confirmado' : 'agendado',
        })),
      };
    });
  }, [appointments, selectedServiceDay, selectedDate]);

  const getAppointmentsForServiceDay = (serviceDayId: string) => {
    const day = serviceDays.find(d => d.id === serviceDayId);
    if (!day) return [];
    return appointments.filter(apt => apt.scheduled_date === day.service_date);
  };

  if (isLoading || loadingDays) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-muted-foreground">
            Gerencie os atendimentos agendados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            className="bg-gradient-primary hover:opacity-90"
            onClick={() => setIsScheduleLeadOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Agendar Lead
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Lead Existente
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
        {/* Service Day Selector */}
        <div className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Dia de Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedServiceDayId}
                onValueChange={setSelectedServiceDayId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o dia" />
                </SelectTrigger>
                <SelectContent>
                  {serviceDays.map((day) => (
                    <SelectItem key={day.id} value={day.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{day.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {getAppointmentsForServiceDay(day.id).length}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Resumo do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-primary">
                    {filteredAppointments.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Agendados</p>
                </div>
                <div className="p-2 rounded-lg bg-success/10">
                  <p className="text-2xl font-bold text-success">
                    {filteredAppointments.filter(a => a.confirmed).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Confirmados</p>
                </div>
                <div className="p-2 rounded-lg bg-info/10">
                  <p className="text-2xl font-bold text-info">
                    {filteredAppointments.filter(a => a.attended === true).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Compareceram</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule by Hour */}
          <ScheduleByHour slots={scheduleSlots} />
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          {/* Service Days Quick Nav */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {serviceDays.slice(0, 7).map((day) => {
                  const dayAppointments = getAppointmentsForServiceDay(day.id);
                  const isSelected = day.id === selectedServiceDayId;
                  
                  return (
                    <button
                      key={day.id}
                      onClick={() => setSelectedServiceDayId(day.id)}
                      className={`flex-shrink-0 p-3 rounded-lg text-center transition-all min-w-[100px] ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <p className="text-xs font-medium uppercase">
                        {day.weekday_name.slice(0, 3)}
                      </p>
                      <p className="text-lg font-bold mt-1">
                        {day.service_date.split('-')[2]}/{day.service_date.split('-')[1]}
                      </p>
                      {dayAppointments.length > 0 && (
                        <Badge 
                          variant="secondary" 
                          className={`mt-1 text-xs ${isSelected ? 'bg-white/20' : ''}`}
                        >
                          {dayAppointments.length}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Agendamentos - {selectedServiceDay?.label || format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum agendamento para esta data</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onConfirm={() => handleConfirm(appointment.id)}
                      onAttended={(attended) => handleAttended(appointment.id, attended)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddAppointmentDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchAppointments}
      />

      <ScheduleLeadDialog
        open={isScheduleLeadOpen}
        onOpenChange={setIsScheduleLeadOpen}
        onSuccess={fetchAppointments}
      />
    </div>
  );
}
