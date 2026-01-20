import { useState, useEffect } from 'react';
import { 
  Users, 
  Target, 
  TrendingUp, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LEAD_STATUS_CONFIG } from '@/types/database';

interface DashboardStats {
  totalLeads: number;
  conversions: number;
  conversionRate: number;
  todayAppointments: number;
}

interface RecentLead {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
  course: { name: string } | null;
}

interface CourseStats {
  id: string;
  name: string;
  lead_count: number;
  conversion_count: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    conversions: 0,
    conversionRate: 0,
    todayAppointments: 0,
  });
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [topCourses, setTopCourses] = useState<CourseStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch total leads this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: leadsData, error: leadsError } = await supabase
          .from('leads')
          .select('id, status')
          .gte('created_at', startOfMonth.toISOString());

        if (leadsError) throw leadsError;

        const totalLeads = leadsData?.length || 0;
        const conversions = leadsData?.filter(l => l.status === 'matriculado').length || 0;
        const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;

        // Fetch today's appointments
        const today = new Date().toISOString().split('T')[0];
        const { data: appointmentsData } = await supabase
          .from('appointments')
          .select('id')
          .eq('scheduled_date', today);

        // Fetch recent leads
        const { data: recentData } = await supabase
          .from('leads')
          .select('id, full_name, status, created_at, course:courses(name)')
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch course stats
        const { data: coursesData } = await supabase
          .from('courses')
          .select('id, name')
          .eq('is_active', true);

        const { data: allLeadsData } = await supabase
          .from('leads')
          .select('course_interest_id, status');

        // Calculate course stats
        const courseStats = coursesData?.map(course => {
          const courseLeads = allLeadsData?.filter(l => l.course_interest_id === course.id) || [];
          return {
            id: course.id,
            name: course.name,
            lead_count: courseLeads.length,
            conversion_count: courseLeads.filter(l => l.status === 'matriculado').length,
          };
        }).sort((a, b) => b.lead_count - a.lead_count).slice(0, 4) || [];

        setStats({
          totalLeads,
          conversions,
          conversionRate,
          todayAppointments: appointmentsData?.length || 0,
        });
        setRecentLeads((recentData as unknown as RecentLead[]) || []);
        setTopCourses(courseStats);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = [
    {
      name: 'Leads do Mês',
      value: stats.totalLeads.toString(),
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      name: 'Conversões',
      value: stats.conversions.toString(),
      icon: Target,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      name: 'Taxa de Conversão',
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      name: 'Agendamentos Hoje',
      value: stats.todayAppointments.toString(),
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Olá, {profile?.full_name?.split(' ')[0] ?? 'Usuário'}! 👋
          </h1>
          <p className="text-muted-foreground">
            Aqui está o resumo do seu dia
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-primary text-white">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className="card-hover border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Leads Recentes
            </CardTitle>
            <CardDescription>Últimos leads cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum lead cadastrado ainda
              </div>
            ) : (
              <div className="space-y-4">
                {recentLeads.map((lead) => {
                  const statusConfig = LEAD_STATUS_CONFIG[lead.status as keyof typeof LEAD_STATUS_CONFIG];
                  return (
                    <div 
                      key={lead.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                          {lead.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium">{lead.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {lead.course?.name || 'Sem curso'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`${statusConfig?.bgColor} ${statusConfig?.color}`}>
                          {statusConfig?.label || lead.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(lead.created_at)} atrás
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Courses */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Cursos em Destaque
            </CardTitle>
            <CardDescription>Performance por curso</CardDescription>
          </CardHeader>
          <CardContent>
            {topCourses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum curso cadastrado ainda
              </div>
            ) : (
              <div className="space-y-6">
                {topCourses.map((course) => {
                  const maxLeads = Math.max(...topCourses.map(c => c.lead_count), 1);
                  const progress = (course.lead_count / maxLeads) * 100;
                  
                  return (
                    <div key={course.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{course.name}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">{course.lead_count} leads</span>
                          <span className="text-success font-medium">{course.conversion_count} conv.</span>
                        </div>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
