import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AddAppointmentDialog } from '@/components/appointments/AddAppointmentDialog';
import { ScheduleLeadDialog } from '@/components/appointments/ScheduleLeadDialog';
import { AppointmentCard } from '@/components/appointments/AppointmentCard';
import { ScheduleByHour } from '@/components/dashboard/ScheduleByHour';

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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isScheduleLeadOpen, setIsScheduleLeadOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { toast } = useToast();

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          lead:leads(id, full_name, phone, email),
          agent:profiles!appointments_agent_id_fkey(id, full_name)
        `)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      setAppointments((data as unknown as AppointmentWithDetails[]) || []);
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
    const matchesDate = isSameDay(parseISO(apt.scheduled_date), selectedDate);
    return matchesSearch && matchesDate;
  });

  // Schedule by hour slots for selected date
  const scheduleSlots: ScheduleSlot[] = useMemo(() => {
    const dayAppointments = appointments.filter(apt => 
      isSameDay(parseISO(apt.scheduled_date), selectedDate)
    );

    const slots: ScheduleSlot[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      const appointmentsInHour = dayAppointments.filter((apt) => {
        const [aptHour] = apt.scheduled_time.split(':').map(Number);
        return aptHour === hour;
      });

      slots.push({
        hour: hourStr,
        count: appointmentsInHour.length,
        leads: appointmentsInHour.map((apt) => ({
          id: apt.id,
          name: apt.lead.full_name,
          status: apt.confirmed ? 'confirmado' : 'agendado',
        })),
      });
    }

    return slots;
  }, [appointments, selectedDate]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const getAppointmentsForDate = (date: Date) => 
    appointments.filter(apt => isSameDay(parseISO(apt.scheduled_date), date));

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => addDays(prev, direction === 'next' ? 7 : -7));
  };

  if (isLoading) {
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
        {/* Calendar Sidebar */}
        <div className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                className="w-full"
              />
            </CardContent>
          </Card>

          {/* Today's Stats */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-primary">
                    {getAppointmentsForDate(new Date()).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Agendados</p>
                </div>
                <div className="p-2 rounded-lg bg-success/10">
                  <p className="text-2xl font-bold text-success">
                    {getAppointmentsForDate(new Date()).filter(a => a.confirmed).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Confirmados</p>
                </div>
                <div className="p-2 rounded-lg bg-info/10">
                  <p className="text-2xl font-bold text-info">
                    {getAppointmentsForDate(new Date()).filter(a => a.attended === true).length}
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
          {/* Week Navigation */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h3 className="text-lg font-semibold">
                  {format(currentWeekStart, "MMMM yyyy", { locale: ptBR })}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayAppointments = getAppointmentsForDate(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentDay = isToday(day);
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`p-3 rounded-lg text-center transition-all ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground' 
                          : isCurrentDay 
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                      }`}
                    >
                      <p className="text-xs font-medium uppercase">
                        {format(day, 'EEE', { locale: ptBR })}
                      </p>
                      <p className="text-lg font-bold mt-1">
                        {format(day, 'd')}
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

          {/* Appointments List */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Agendamentos - {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
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
