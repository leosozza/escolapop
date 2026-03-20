import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Download,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { subDays, subMonths, subWeeks, startOfDay } from 'date-fns';

interface ReportStats {
  leads: number;
  appointments: number;
  enrollments: number;
  conversionRate: number;
  activeStudents: number;
  completedStudents: number;
  attendanceRate: number;
  totalRevenue: number;
  overdueAmount: number;
  avgTicket: number;
  agents: number;
  producers: number;
  teachers: number;
  totalTeam: number;
}

function getPeriodStart(period: string): string {
  const now = new Date();
  switch (period) {
    case 'week': return startOfDay(subWeeks(now, 1)).toISOString();
    case 'month': return startOfDay(subMonths(now, 1)).toISOString();
    case 'quarter': return startOfDay(subMonths(now, 3)).toISOString();
    case 'year': return startOfDay(subMonths(now, 12)).toISOString();
    default: return startOfDay(subMonths(now, 1)).toISOString();
  }
}

const FUNNEL_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function KpiCard({ icon: Icon, value, label, color, trend }: { icon: any; value: string | number; label: string; color: string; trend?: string }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const since = getPeriodStart(period);

      const [leadsRes, aptsRes, enrollRes, activeRes, completedRes, attendanceRes, paymentsRes, overdueRes, teamRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }).in('status', ['ativo', 'em_curso']),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'concluido'),
        supabase.from('attendance').select('id, status').gte('created_at', since),
        supabase.from('payments').select('paid_amount').eq('status', 'pago').gte('paid_at', since),
        supabase.from('payments').select('amount').eq('status', 'pendente').lt('due_date', new Date().toISOString().split('T')[0]),
        supabase.from('team_members').select('id, sector').eq('is_active', true),
      ]);

      const leadsCount = leadsRes.count || 0;
      const aptsCount = aptsRes.count || 0;
      const enrollCount = enrollRes.count || 0;
      const activeCount = activeRes.count || 0;
      const completedCount = completedRes.count || 0;

      const attendanceData = attendanceRes.data || [];
      const presentCount = attendanceData.filter((a: any) => a.status === 'presente').length;
      const attendanceRate = attendanceData.length > 0 ? Math.round((presentCount / attendanceData.length) * 100) : 0;

      const paidData = paymentsRes.data || [];
      const totalRevenue = paidData.reduce((sum: number, p: any) => sum + Number(p.paid_amount || 0), 0);

      const overdueData = overdueRes.data || [];
      const overdueAmount = overdueData.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      const avgTicket = enrollCount > 0 ? totalRevenue / enrollCount : 0;

      const teamData = teamRes.data || [];
      const agents = teamData.filter((t: any) => t.sector === 'comercial').length;
      const producers = teamData.filter((t: any) => t.sector === 'producao').length;
      const teachers = teamData.filter((t: any) => t.sector === 'academico').length;

      setStats({
        leads: leadsCount,
        appointments: aptsCount,
        enrollments: enrollCount,
        conversionRate: leadsCount > 0 ? Math.round((enrollCount / leadsCount) * 100) : 0,
        activeStudents: activeCount,
        completedStudents: completedCount,
        attendanceRate,
        totalRevenue,
        overdueAmount,
        avgTicket,
        agents,
        producers,
        teachers,
        totalTeam: teamData.length,
      });
    } catch (error) {
      console.error('Error fetching report stats:', error);
      toast({ variant: 'destructive', title: 'Erro ao carregar relatórios' });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleExport = () => {
    if (!stats) return;
    const csv = [
      'Métrica,Valor',
      `Leads,${stats.leads}`,
      `Agendamentos,${stats.appointments}`,
      `Matrículas,${stats.enrollments}`,
      `Taxa Conversão,${stats.conversionRate}%`,
      `Alunos Ativos,${stats.activeStudents}`,
      `Concluídos,${stats.completedStudents}`,
      `Taxa Presença,${stats.attendanceRate}%`,
      `Receita Total,${stats.totalRevenue}`,
      `Inadimplência,${stats.overdueAmount}`,
      `Ticket Médio,${stats.avgTicket}`,
      `Equipe Total,${stats.totalTeam}`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Relatório exportado!' });
  };

  if (isLoading || !stats) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const funnelData = [
    { name: 'Leads', value: stats.leads },
    { name: 'Agendamentos', value: stats.appointments },
    { name: 'Matrículas', value: stats.enrollments },
    { name: 'Ativos', value: stats.activeStudents },
    { name: 'Concluídos', value: stats.completedStudents },
  ];

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Análises e métricas do sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="quarter">Este trimestre</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="comercial">
        <TabsList>
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
          <TabsTrigger value="academico">Acadêmico</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="comercial" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard icon={Users} value={stats.leads} label="Novos Leads" color="bg-primary/10 text-primary" />
            <KpiCard icon={Calendar} value={stats.appointments} label="Agendamentos" color="bg-chart-2/10 text-chart-2" />
            <KpiCard icon={Users} value={stats.enrollments} label="Matrículas" color="bg-chart-3/10 text-chart-3" />
            <KpiCard icon={BarChart3} value={`${stats.conversionRate}%`} label="Taxa Conversão" color="bg-chart-4/10 text-chart-4" />
          </div>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Funil de Vendas</CardTitle>
              <CardDescription>Conversão por etapa do funil</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value: number) => [value, 'Total']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {funnelData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academico" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard icon={Users} value={stats.activeStudents} label="Alunos Ativos" color="bg-primary/10 text-primary" />
            <KpiCard icon={Calendar} value={`${stats.attendanceRate}%`} label="Taxa de Presença" color="bg-chart-2/10 text-chart-2" />
            <KpiCard icon={BarChart3} value={stats.completedStudents} label="Concluídos" color="bg-chart-3/10 text-chart-3" />
          </div>
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard icon={DollarSign} value={formatCurrency(stats.totalRevenue)} label="Receita Total" color="bg-chart-2/10 text-chart-2" />
            <KpiCard icon={DollarSign} value={formatCurrency(stats.overdueAmount)} label="Inadimplência" color="bg-destructive/10 text-destructive" />
            <KpiCard icon={BarChart3} value={formatCurrency(stats.avgTicket)} label="Ticket Médio" color="bg-primary/10 text-primary" />
          </div>
        </TabsContent>

        <TabsContent value="equipe" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard icon={Users} value={stats.totalTeam} label="Total Equipe" color="bg-primary/10 text-primary" />
            <KpiCard icon={Users} value={stats.agents} label="Comercial" color="bg-chart-2/10 text-chart-2" />
            <KpiCard icon={Users} value={stats.producers} label="Produção" color="bg-chart-3/10 text-chart-3" />
            <KpiCard icon={Users} value={stats.teachers} label="Acadêmico" color="bg-chart-4/10 text-chart-4" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
