import { useState, useEffect, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Camera,
  Loader2,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Image,
  Video,
  Brush,
  Package,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DateFilter } from '@/components/dashboard/DateFilter';
import { AddStudioSessionDialog } from '@/components/studio/AddStudioSessionDialog';

interface TeamMember {
  id: string;
  full_name: string;
  sector: string;
  avatar_url: string | null;
}

interface StudioSession {
  id: string;
  lead_id: string;
  session_date: string;
  check_in_time: string | null;
  producer_id: string | null;
  code: string | null;
  status: string;
  plan: string | null;
  makeup_artist_id: string | null;
  making_of_done: boolean;
  photos_done: boolean;
  photo_count: number;
  video_done: boolean;
  video_notes: string | null;
  studio_start: string | null;
  studio_end: string | null;
  editing_start: string | null;
  editing_end: string | null;
  delivery_status: string;
  delivery_notes: string | null;
  next_return_date: string | null;
  return_reason: string | null;
  created_at: string;
  lead?: {
    id: string;
    full_name: string;
    phone: string;
    guardian_name: string | null;
  };
  producer?: TeamMember;
  makeup_artist?: TeamMember;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  a_ver: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', label: 'A Ver' },
  ok: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'OK' },
  cancelado: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Cancelado' },
};

const DELIVERY_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  pendente: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Pendente' },
  parcial: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Parcial' },
  entregue: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Entregue' },
};

export default function Studio() {
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState('producao');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch team members for producers and makeup artists
      const { data: teamData } = await supabase
        .from('team_members')
        .select('id, full_name, sector, avatar_url')
        .eq('is_active', true)
        .in('sector', ['produtor', 'maquiagem', 'edicao_imagem', 'fotografo', 'video_maker']);

      setTeamMembers(teamData || []);

      // Fetch studio sessions with related data
      const { data: sessionsData, error } = await supabase
        .from('studio_sessions')
        .select(`
          *,
          lead:leads(id, full_name, phone, guardian_name),
          producer:team_members!studio_sessions_producer_id_fkey(id, full_name, sector, avatar_url),
          makeup_artist:team_members!studio_sessions_makeup_artist_id_fkey(id, full_name, sector, avatar_url)
        `)
        .order('check_in_time', { ascending: true });

      if (error) throw error;
      setSessions((sessionsData as unknown as StudioSession[]) || []);
    } catch (error) {
      console.error('Error fetching studio data:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter sessions by selected date
  const filteredSessions = useMemo(() => {
    if (!selectedDate) return sessions;
    return sessions.filter((s) => isSameDay(new Date(s.session_date), selectedDate));
  }, [sessions, selectedDate]);

  // KPI calculations
  const kpis = useMemo(() => {
    return {
      registrados: filteredSessions.length,
      cancelados: filteredSessions.filter((s) => s.status === 'cancelado').length,
      finalizados: filteredSessions.filter((s) => s.photos_done && s.video_done).length,
      fotografando: filteredSessions.filter((s) => s.studio_start && !s.studio_end).length,
      editando: filteredSessions.filter((s) => s.editing_start && !s.editing_end).length,
      entregues: filteredSessions.filter((s) => s.delivery_status === 'entregue').length,
    };
  }, [filteredSessions]);

  // Get team members by sector
  const producers = teamMembers.filter((m) => m.sector === 'produtor');
  const makeupArtists = teamMembers.filter((m) => m.sector === 'maquiagem');

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const updateSession = async (sessionId: string, updates: Partial<StudioSession>) => {
    try {
      const { error } = await supabase
        .from('studio_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error updating session:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar a sessão.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Camera className="h-8 w-8 text-primary" />
            Studio
          </h1>
          <p className="text-muted-foreground">
            Gestão de produção fotográfica • {format(selectedDate || new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateFilter selectedDate={selectedDate} onDateChange={setSelectedDate} />
          <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-primary hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.registrados}</p>
              <p className="text-xs text-muted-foreground">Registrados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.cancelados}</p>
              <p className="text-xs text-muted-foreground">Cancelados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.finalizados}</p>
              <p className="text-xs text-muted-foreground">Finalizados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Camera className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.fotografando}</p>
              <p className="text-xs text-muted-foreground">Fotografando</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Image className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.editando}</p>
              <p className="text-xs text-muted-foreground">Editando</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.entregues}</p>
              <p className="text-xs text-muted-foreground">Entregues</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-md">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Clientes do Dia
              </CardTitle>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="producao" className="text-xs">
                  <Camera className="h-3 w-3 mr-1" />
                  Maquiagem & Estúdio
                </TabsTrigger>
                <TabsTrigger value="edicao" className="text-xs">
                  <Image className="h-3 w-3 mr-1" />
                  Edição
                </TabsTrigger>
                <TabsTrigger value="entregas" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  Entregas
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent>
            <TabsContent value="producao" className="mt-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-20">Hora</TableHead>
                      <TableHead>Produtor</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Maquiadora</TableHead>
                      <TableHead className="text-center">Making-of</TableHead>
                      <TableHead className="text-center">Fotos</TableHead>
                      <TableHead className="text-center">Vídeo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                          <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Nenhuma sessão agendada para esta data
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSessions.map((session, index) => {
                        const statusStyle = STATUS_COLORS[session.status] || STATUS_COLORS.a_ver;

                        return (
                          <TableRow key={session.id} className="hover:bg-muted/50">
                            <TableCell className="font-bold">{index + 1}</TableCell>
                            <TableCell className="text-sm">
                              {session.check_in_time || '-'}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={session.producer_id || ''}
                                onValueChange={(value) => updateSession(session.id, { producer_id: value })}
                              >
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue placeholder="Selecionar" />
                                </SelectTrigger>
                                <SelectContent>
                                  {producers.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.full_name.split(' ')[0]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {session.lead ? getInitials(session.lead.full_name) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">
                                  {session.lead?.full_name || 'N/A'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {session.code || '-'}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={session.status}
                                onValueChange={(value) => updateSession(session.id, { status: value })}
                              >
                                <SelectTrigger className="w-28 h-8">
                                  <Badge className={`${statusStyle.bg} ${statusStyle.text} text-xs`}>
                                    {statusStyle.label}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="a_ver">A Ver</SelectItem>
                                  <SelectItem value="ok">OK</SelectItem>
                                  <SelectItem value="cancelado">Cancelado</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-sm">{session.plan || '-'}</TableCell>
                            <TableCell>
                              <Select
                                value={session.makeup_artist_id || ''}
                                onValueChange={(value) => updateSession(session.id, { makeup_artist_id: value })}
                              >
                                <SelectTrigger className="w-28 h-8">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {makeupArtists.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {m.full_name.split(' ')[0]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={session.making_of_done}
                                onCheckedChange={(checked) =>
                                  updateSession(session.id, { making_of_done: checked as boolean })
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={session.photos_done}
                                onCheckedChange={(checked) =>
                                  updateSession(session.id, { photos_done: checked as boolean })
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={session.video_done}
                                onCheckedChange={(checked) =>
                                  updateSession(session.id, { video_done: checked as boolean })
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="edicao" className="mt-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Início Edição</TableHead>
                      <TableHead>Fim Edição</TableHead>
                      <TableHead>Qtd. Fotos</TableHead>
                      <TableHead>Observações Vídeo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.filter((s) => s.photos_done || s.video_done).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Nenhuma sessão em edição
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSessions
                        .filter((s) => s.photos_done || s.video_done)
                        .map((session, index) => (
                          <TableRow key={session.id} className="hover:bg-muted/50">
                            <TableCell className="font-bold">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {session.lead ? getInitials(session.lead.full_name) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">
                                  {session.lead?.full_name || 'N/A'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{session.code || '-'}</TableCell>
                            <TableCell className="text-sm">
                              {session.editing_start
                                ? format(new Date(session.editing_start), 'dd/MM HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {session.editing_end
                                ? format(new Date(session.editing_end), 'dd/MM HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-sm">{session.photo_count || 0}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {session.video_notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="entregas" className="mt-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Status Entrega</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead>Próximo Retorno</TableHead>
                      <TableHead>Motivo Retorno</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Nenhuma entrega para esta data
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSessions.map((session, index) => {
                        const deliveryStyle = DELIVERY_STATUS[session.delivery_status] || DELIVERY_STATUS.pendente;

                        return (
                          <TableRow key={session.id} className="hover:bg-muted/50">
                            <TableCell className="font-bold">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {session.lead ? getInitials(session.lead.full_name) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">
                                  {session.lead?.full_name || 'N/A'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{session.code || '-'}</TableCell>
                            <TableCell>
                              <Select
                                value={session.delivery_status}
                                onValueChange={(value) =>
                                  updateSession(session.id, { delivery_status: value })
                                }
                              >
                                <SelectTrigger className="w-28 h-8">
                                  <Badge className={`${deliveryStyle.bg} ${deliveryStyle.text} text-xs`}>
                                    {deliveryStyle.label}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="parcial">Parcial</SelectItem>
                                  <SelectItem value="entregue">Entregue</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {session.delivery_notes || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {session.next_return_date
                                ? format(new Date(session.next_return_date), 'dd/MM/yyyy')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {session.return_reason || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Add Session Dialog */}
      <AddStudioSessionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        producers={producers}
        selectedDate={selectedDate || new Date()}
        onSuccess={fetchData}
      />
    </div>
  );
}
