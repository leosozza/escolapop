import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Loader2, 
  Search, 
  QrCode, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Phone, 
  User,
  Calendar,
  AlertCircle,
  ScanLine,
  DoorOpen,
  BarChart3,
  List
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QRCodeDialog } from '@/components/reception/QRCodeDialog';
import { QRScannerDialog } from '@/components/reception/QRScannerDialog';
import { CheckInConfirmDialog } from '@/components/reception/CheckInConfirmDialog';
import { ReceptionDashboard } from '@/components/reception/ReceptionDashboard';

interface AppointmentWithDetails {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  confirmed: boolean | null;
  attended: boolean | null;
  notes: string | null;
  lead: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    status: string;
  } | null;
  agent: {
    full_name: string;
  } | null;
}

export default function Reception() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [activeTab, setActiveTab] = useState('checkin');
  const { toast } = useToast();

  const fetchTodayAppointments = async () => {
    setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          scheduled_date,
          scheduled_time,
          confirmed,
          attended,
          notes,
          lead:leads(id, full_name, phone, email, status),
          agent:profiles!appointments_agent_id_fkey(full_name)
        `)
        .eq('scheduled_date', today)
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      setAppointments((data as unknown as AppointmentWithDetails[]) || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar agendamentos',
        description: 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayAppointments();
    
    // Refresh every minute
    const interval = setInterval(fetchTodayAppointments, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckIn = async (appointment: AppointmentWithDetails, attended: boolean) => {
    try {
      // Update appointment
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ 
          attended, 
          confirmed: true,
          checked_in_at: attended ? new Date().toISOString() : null,
        })
        .eq('id', appointment.id);

      if (appointmentError) throw appointmentError;

      // Update lead status - only update to 'compareceu' if attended
      // If not attended, the system automation will handle 'atrasado' or 'reagendar'
      if (appointment.lead && attended) {
        await supabase
          .from('leads')
          .update({ 
            status: 'compareceu',
            attended_at: new Date().toISOString(),
          })
          .eq('id', appointment.lead.id);
      }

      toast({
        title: attended ? 'Check-in realizado!' : 'Falta registrada',
        description: attended 
          ? `${appointment.lead?.full_name} fez check-in com sucesso.`
          : `${appointment.lead?.full_name} marcado como não compareceu.`,
      });

      fetchTodayAppointments();
      setCheckInDialogOpen(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error('Error updating check-in:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar',
        description: 'Tente novamente.',
      });
    }
  };

  const handleQRScanned = (appointmentId: string) => {
    const appointment = appointments.find(a => a.id === appointmentId);
    if (appointment) {
      setSelectedAppointment(appointment);
      setScannerOpen(false);
      setCheckInDialogOpen(true);
    } else {
      toast({
        variant: 'destructive',
        title: 'Agendamento não encontrado',
        description: 'Este QR code não corresponde a um agendamento de hoje.',
      });
    }
  };

  const showQRCode = (appointment: AppointmentWithDetails) => {
    setSelectedAppointment(appointment);
    setQrDialogOpen(true);
  };

  const openCheckInDialog = (appointment: AppointmentWithDetails) => {
    setSelectedAppointment(appointment);
    setCheckInDialogOpen(true);
  };

  const filteredAppointments = appointments.filter(appointment =>
    appointment.lead?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    appointment.lead?.phone.includes(searchQuery)
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusInfo = (appointment: AppointmentWithDetails) => {
    if (appointment.attended === true) {
      return { label: 'Compareceu', color: 'bg-success/10 text-success', icon: CheckCircle2 };
    }
    if (appointment.attended === false) {
      return { label: 'Não Compareceu', color: 'bg-destructive/10 text-destructive', icon: XCircle };
    }
    if (appointment.confirmed) {
      return { label: 'Confirmado', color: 'bg-primary/10 text-primary', icon: CheckCircle2 };
    }
    return { label: 'Aguardando', color: 'bg-warning/10 text-warning', icon: Clock };
  };

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.confirmed).length,
    attended: appointments.filter(a => a.attended === true).length,
    noShow: appointments.filter(a => a.attended === false).length,
    pending: appointments.filter(a => a.attended === null).length,
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DoorOpen className="h-7 w-7 text-primary" />
            Recepção
          </h1>
          <p className="text-muted-foreground">
            Check-in presencial • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {activeTab === 'checkin' && (
            <>
              <div className="relative flex-1 md:w-64 md:flex-none">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                onClick={() => setScannerOpen(true)}
                className="bg-gradient-primary hover:opacity-90"
              >
                <ScanLine className="mr-2 h-4 w-4" />
                Escanear QR
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="checkin" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Check-in
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkin" className="space-y-6 mt-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Hoje</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.confirmed}</p>
                    <p className="text-xs text-muted-foreground">Confirmados</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.attended}</p>
                    <p className="text-xs text-muted-foreground">Check-in</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.noShow}</p>
                    <p className="text-xs text-muted-foreground">Não Compareceu</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Appointments List */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Agendamentos de Hoje</CardTitle>
              <CardDescription>
                Lista de todos os atendimentos agendados para hoje
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {searchQuery ? 'Nenhum resultado encontrado' : 'Nenhum agendamento hoje'}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchQuery 
                      ? 'Tente buscar por outro nome ou telefone'
                      : 'Não há atendimentos agendados para hoje'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAppointments.map((appointment) => {
                    const statusInfo = getStatusInfo(appointment);
                    const StatusIcon = statusInfo.icon;
                    const isPending = appointment.attended === null;

                    return (
                      <div
                        key={appointment.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          isPending 
                            ? 'border-primary/30 bg-primary/5 hover:border-primary/50' 
                            : 'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {appointment.lead ? getInitials(appointment.lead.full_name) : '?'}
                            </AvatarFallback>
                          </Avatar>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground">
                                {appointment.lead?.full_name || 'Lead não encontrado'}
                              </h4>
                              <Badge className={statusInfo.color}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {appointment.scheduled_time.slice(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {appointment.lead?.phone}
                              </span>
                              {appointment.agent && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3.5 w-3.5" />
                                  {appointment.agent.full_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showQRCode(appointment)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          
                          {isPending && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleCheckIn(appointment, false)}
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                Faltou
                              </Button>
                              <Button
                                size="sm"
                                className="bg-success hover:bg-success/90 text-white"
                                onClick={() => openCheckInDialog(appointment)}
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Check-in
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          <ReceptionDashboard />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <QRCodeDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        appointment={selectedAppointment}
      />

      <QRScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleQRScanned}
      />

      <CheckInConfirmDialog
        open={checkInDialogOpen}
        onOpenChange={setCheckInDialogOpen}
        appointment={selectedAppointment}
        onConfirm={(attended) => selectedAppointment && handleCheckIn(selectedAppointment, attended)}
      />
    </div>
  );
}
