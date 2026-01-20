import { useState, useEffect } from 'react';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Percent, Users, Clock, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface HourlyData {
  hour: string;
  agendados: number;
  compareceram: number;
  faltaram: number;
}

interface DailyData {
  date: string;
  agendados: number;
  compareceram: number;
  taxa: number;
}

interface AppointmentRecord {
  scheduled_date: string;
  scheduled_time: string;
  attended: boolean | null;
}

export function ReceptionDashboard() {
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');

      // Fetch appointments for the last 7 days
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('scheduled_date, scheduled_time, attended')
        .gte('scheduled_date', sevenDaysAgo)
        .lte('scheduled_date', today)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      // Process hourly data for today
      const todayAppointments = (appointments || []).filter(
        (a: AppointmentRecord) => a.scheduled_date === today
      );
      
      const hourlyStats: Record<string, HourlyData> = {};
      for (let i = 8; i <= 20; i++) {
        const hour = `${i.toString().padStart(2, '0')}:00`;
        hourlyStats[hour] = { hour, agendados: 0, compareceram: 0, faltaram: 0 };
      }

      todayAppointments.forEach((apt: AppointmentRecord) => {
        const hour = apt.scheduled_time.slice(0, 2) + ':00';
        if (hourlyStats[hour]) {
          hourlyStats[hour].agendados++;
          if (apt.attended === true) hourlyStats[hour].compareceram++;
          if (apt.attended === false) hourlyStats[hour].faltaram++;
        }
      });

      setHourlyData(Object.values(hourlyStats));

      // Process daily data for the last 7 days
      const dailyStats: Record<string, DailyData> = {};
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const displayDate = format(subDays(new Date(), i), 'dd/MM', { locale: ptBR });
        dailyStats[date] = { date: displayDate, agendados: 0, compareceram: 0, taxa: 0 };
      }

      (appointments || []).forEach((apt: AppointmentRecord) => {
        if (dailyStats[apt.scheduled_date]) {
          dailyStats[apt.scheduled_date].agendados++;
          if (apt.attended === true) {
            dailyStats[apt.scheduled_date].compareceram++;
          }
        }
      });

      // Calculate conversion rates
      Object.values(dailyStats).forEach((day) => {
        day.taxa = day.agendados > 0 
          ? Math.round((day.compareceram / day.agendados) * 100) 
          : 0;
      });

      setDailyData(Object.values(dailyStats));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate summary stats
  const todayTotal = hourlyData.reduce((sum, h) => sum + h.agendados, 0);
  const todayAttended = hourlyData.reduce((sum, h) => sum + h.compareceram, 0);
  const todayNoShow = hourlyData.reduce((sum, h) => sum + h.faltaram, 0);
  const todayRate = todayTotal > 0 ? Math.round((todayAttended / todayTotal) * 100) : 0;

  const weekTotal = dailyData.reduce((sum, d) => sum + d.agendados, 0);
  const weekAttended = dailyData.reduce((sum, d) => sum + d.compareceram, 0);
  const weekRate = weekTotal > 0 ? Math.round((weekAttended / weekTotal) * 100) : 0;

  // Compare with yesterday
  const yesterdayData = dailyData[dailyData.length - 2];
  const todayData = dailyData[dailyData.length - 1];
  const rateTrend = todayData && yesterdayData 
    ? todayData.taxa - yesterdayData.taxa 
    : 0;

  const COLORS = {
    primary: 'hsl(var(--primary))',
    success: 'hsl(var(--success))',
    destructive: 'hsl(var(--destructive))',
    muted: 'hsl(var(--muted-foreground))',
  };

  const pieData = [
    { name: 'Compareceram', value: todayAttended, color: COLORS.success },
    { name: 'Não Compareceram', value: todayNoShow, color: COLORS.destructive },
    { name: 'Pendentes', value: todayTotal - todayAttended - todayNoShow, color: COLORS.muted },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        <div className="h-80 bg-muted rounded-lg" />
        <div className="h-80 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa Hoje</p>
                <p className="text-3xl font-bold text-foreground">{todayRate}%</p>
              </div>
              <div className={`flex items-center gap-1 text-sm ${rateTrend >= 0 ? 'text-success' : 'text-destructive'}`}>
                {rateTrend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {Math.abs(rateTrend)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa Semana</p>
                <p className="text-3xl font-bold text-foreground">{weekRate}%</p>
              </div>
              <Percent className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Check-ins Hoje</p>
                <p className="text-3xl font-bold text-foreground">{todayAttended}</p>
              </div>
              <Users className="h-6 w-6 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Semana</p>
                <p className="text-3xl font-bold text-foreground">{weekAttended}/{weekTotal}</p>
              </div>
              <BarChart3 className="h-6 w-6 text-info" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Comparecimento por Hora
            </CardTitle>
            <CardDescription>
              Distribuição de check-ins ao longo do dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="agendados" name="Agendados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="compareceram" name="Compareceram" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="faltaram" name="Faltaram" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Conversion Rate */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Taxa de Conversão Diária
            </CardTitle>
            <CardDescription>
              Evolução da taxa de comparecimento nos últimos 7 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Taxa']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="taxa" 
                    name="Taxa %" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Volume Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-info" />
              Volume Diário
            </CardTitle>
            <CardDescription>
              Agendamentos vs Check-ins por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="agendados" name="Agendados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="compareceram" name="Compareceram" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Today's Distribution */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-warning" />
              Distribuição Hoje
            </CardTitle>
            <CardDescription>
              Status dos agendamentos de hoje
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p>Nenhum dado disponível</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
