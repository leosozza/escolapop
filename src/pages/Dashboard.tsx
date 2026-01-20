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
import { useAuth } from '@/contexts/AuthContext';

const stats = [
  {
    name: 'Leads do Mês',
    value: '248',
    change: '+12%',
    trend: 'up',
    icon: Users,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  {
    name: 'Conversões',
    value: '42',
    change: '+8%',
    trend: 'up',
    icon: Target,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    name: 'Taxa de Conversão',
    value: '16.9%',
    change: '-2%',
    trend: 'down',
    icon: TrendingUp,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    name: 'Agendamentos Hoje',
    value: '12',
    change: '+4',
    trend: 'up',
    icon: Calendar,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
];

const recentLeads = [
  { name: 'Maria Silva', course: 'Curso de Modelo', status: 'lead', time: '5 min' },
  { name: 'João Santos', course: 'Influencer Pro', status: 'agendado', time: '15 min' },
  { name: 'Ana Costa', course: 'Passarela', status: 'compareceu', time: '1h' },
  { name: 'Pedro Lima', course: 'Curso de Modelo', status: 'proposta', time: '2h' },
];

const topCourses = [
  { name: 'Curso de Modelo Completo', leads: 85, conversions: 14, progress: 85 },
  { name: 'Influencer Pro', leads: 62, conversions: 11, progress: 72 },
  { name: 'Passarela & Pose', leads: 48, conversions: 8, progress: 58 },
  { name: 'Produção Audiovisual', leads: 35, conversions: 6, progress: 42 },
];

export default function Dashboard() {
  const { profile } = useAuth();

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
          <span className="text-sm font-medium">Nível Gold</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="card-hover border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  stat.trend === 'up' ? 'text-success' : 'text-destructive'
                }`}>
                  {stat.change}
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
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
            <div className="space-y-4">
              {recentLeads.map((lead, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-medium">
                      {lead.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-muted-foreground">{lead.course}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      lead.status === 'lead' ? 'bg-info/10 text-info' :
                      lead.status === 'agendado' ? 'bg-primary/10 text-primary' :
                      lead.status === 'compareceu' ? 'bg-success/10 text-success' :
                      'bg-secondary/10 text-secondary'
                    }`}>
                      {lead.status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{lead.time} atrás</p>
                  </div>
                </div>
              ))}
            </div>
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
            <div className="space-y-6">
              {topCourses.map((course, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{course.name}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{course.leads} leads</span>
                      <span className="text-success font-medium">{course.conversions} conv.</span>
                    </div>
                  </div>
                  <Progress value={course.progress} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
