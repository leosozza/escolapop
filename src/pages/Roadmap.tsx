import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Rocket, 
  Users, 
  GraduationCap, 
  BookOpen, 
  DoorOpen, 
  Film, 
  Wallet,
  Plug,
  Smartphone,
  Brain,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface RoadmapPhase {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  status: 'completed' | 'in-progress' | 'planned';
  progress: number;
  features: {
    name: string;
    status: 'completed' | 'in-progress' | 'planned';
    priority?: 'high' | 'medium' | 'low';
  }[];
}

const roadmapPhases: RoadmapPhase[] = [
  {
    id: 1,
    title: 'CRM & Core',
    description: 'Sistema base com autenticação, roles e pipeline comercial',
    icon: Rocket,
    status: 'completed',
    progress: 100,
    features: [
      { name: 'Autenticação e Login', status: 'completed' },
      { name: 'Sistema de Roles (8 perfis)', status: 'completed' },
      { name: 'Pipeline de 8 estágios', status: 'completed' },
      { name: 'Gestão de Cursos', status: 'completed' },
      { name: 'Histórico de Leads', status: 'completed' },
      { name: 'RLS Policies', status: 'completed' },
    ],
  },
  {
    id: 2,
    title: 'Gestão de Alunos',
    description: 'Perfis de alunos com dados para casting e matrículas',
    icon: Users,
    status: 'completed',
    progress: 100,
    features: [
      { name: 'Perfil de Casting', status: 'completed' },
      { name: 'Matrículas', status: 'completed' },
      { name: 'Status Acadêmicos', status: 'completed' },
      { name: 'Histórico de Mudanças', status: 'completed' },
    ],
  },
  {
    id: 3,
    title: 'LMS & Aulas',
    description: 'Sistema de gestão de aprendizado com módulos e aulas',
    icon: BookOpen,
    status: 'completed',
    progress: 100,
    features: [
      { name: 'Módulos', status: 'completed' },
      { name: 'Aulas com Conteúdos', status: 'completed' },
      { name: 'Tipos de Conteúdo (Vídeo, Texto, Arquivo, Quiz)', status: 'completed' },
      { name: 'Progresso por Aluno', status: 'completed' },
    ],
  },
  {
    id: 4,
    title: 'Operações de Recepção',
    description: 'Check-in, QR Code e fila de atendimento',
    icon: DoorOpen,
    status: 'completed',
    progress: 100,
    features: [
      { name: 'Check-in de Visitantes', status: 'completed' },
      { name: 'QR Code', status: 'completed' },
      { name: 'Fila de Produtores', status: 'completed' },
      { name: 'Call Center (Telemarketing)', status: 'completed' },
    ],
  },
  {
    id: 5,
    title: 'Gestão Acadêmica',
    description: 'Turmas, presença e certificados',
    icon: GraduationCap,
    status: 'completed',
    progress: 100,
    features: [
      { name: 'Gestão de Turmas', status: 'completed' },
      { name: 'Matrículas em Turmas', status: 'completed' },
      { name: 'Controle de Presença', status: 'completed' },
      { name: 'Emissão de Certificados', status: 'completed' },
    ],
  },
  {
    id: 6,
    title: 'Financeiro',
    description: 'Contratos, pagamentos e inadimplência',
    icon: Wallet,
    status: 'in-progress',
    progress: 80,
    features: [
      { name: 'Contratos', status: 'completed' },
      { name: 'Parcelas e Pagamentos', status: 'completed' },
      { name: 'Controle de Inadimplência', status: 'completed' },
      { name: 'Relatórios Financeiros', status: 'in-progress' },
    ],
  },
  {
    id: 7,
    title: 'Integrações Básicas',
    description: 'Webhooks, CSV e campos personalizados',
    icon: Plug,
    status: 'in-progress',
    progress: 60,
    features: [
      { name: 'Webhook de Leads', status: 'completed' },
      { name: 'Importação CSV', status: 'completed' },
      { name: 'Fontes de Lead Dinâmicas', status: 'completed' },
      { name: 'Campos Personalizados', status: 'completed' },
      { name: 'Webhooks de Saída', status: 'planned', priority: 'medium' },
      { name: 'API Key de Segurança', status: 'planned', priority: 'medium' },
    ],
  },
  {
    id: 8,
    title: 'Integrações Avançadas',
    description: 'WhatsApp, Meta Ads, Google Ads e TheMembers',
    icon: MessageSquare,
    status: 'planned',
    progress: 0,
    features: [
      { name: 'TheMembers (Alunos Online)', status: 'planned', priority: 'high' },
      { name: 'WhatsApp Business API', status: 'planned', priority: 'high' },
      { name: 'Meta Ads Integration', status: 'planned', priority: 'high' },
      { name: 'Google Ads Integration', status: 'planned', priority: 'medium' },
      { name: 'Notificações Automatizadas', status: 'planned', priority: 'medium' },
    ],
  },
  {
    id: 9,
    title: 'Casting & Produção',
    description: 'Book digital, busca de casting e jobs',
    icon: Film,
    status: 'planned',
    progress: 0,
    features: [
      { name: 'Book Digital', status: 'planned', priority: 'high' },
      { name: 'Busca por Características', status: 'planned', priority: 'high' },
      { name: 'Agendamento de Jobs', status: 'planned', priority: 'medium' },
      { name: 'Contratos de Jobs', status: 'planned', priority: 'medium' },
      { name: 'Cachês e Comissões', status: 'planned', priority: 'low' },
    ],
  },
  {
    id: 10,
    title: 'Dashboards Executivos',
    description: 'Gráficos, relatórios e análises avançadas',
    icon: BarChart3,
    status: 'planned',
    progress: 0,
    features: [
      { name: 'Gráficos de Funil', status: 'planned', priority: 'high' },
      { name: 'Relatórios de Conversão', status: 'planned', priority: 'high' },
      { name: 'Forecast de Receita', status: 'planned', priority: 'medium' },
      { name: 'Análise de Evasão', status: 'planned', priority: 'medium' },
      { name: 'Export PDF/Excel', status: 'planned', priority: 'low' },
    ],
  },
  {
    id: 11,
    title: 'Mobile & Notificações',
    description: 'PWA, push notifications e app de aluno',
    icon: Smartphone,
    status: 'planned',
    progress: 0,
    features: [
      { name: 'PWA (App Instalável)', status: 'planned', priority: 'high' },
      { name: 'Push Notifications', status: 'planned', priority: 'high' },
      { name: 'Interface de Aluno', status: 'planned', priority: 'medium' },
      { name: 'Notificações por Email', status: 'planned', priority: 'medium' },
    ],
  },
  {
    id: 12,
    title: 'IA & Automação',
    description: 'Lead scoring, chatbot e análises inteligentes',
    icon: Brain,
    status: 'planned',
    progress: 0,
    features: [
      { name: 'Lead Scoring Automático', status: 'planned', priority: 'high' },
      { name: 'Chatbot de Atendimento', status: 'planned', priority: 'medium' },
      { name: 'Sugestões de Follow-up', status: 'planned', priority: 'medium' },
      { name: 'Análise de Sentimento', status: 'planned', priority: 'low' },
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

const getStatusColor = (status: RoadmapPhase['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    case 'in-progress':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    case 'planned':
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getStatusLabel = (status: RoadmapPhase['status']) => {
  switch (status) {
    case 'completed':
      return 'Concluída';
    case 'in-progress':
      return 'Em Progresso';
    case 'planned':
      return 'Planejada';
  }
};

const getStatusIcon = (status: RoadmapPhase['status']) => {
  switch (status) {
    case 'completed':
      return CheckCircle2;
    case 'in-progress':
      return Clock;
    case 'planned':
      return Circle;
  }
};

const getPriorityBadge = (priority?: 'high' | 'medium' | 'low') => {
  switch (priority) {
    case 'high':
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Alta</Badge>;
    case 'medium':
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Média</Badge>;
    case 'low':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Baixa</Badge>;
    default:
      return null;
  }
};

export default function Roadmap() {
  const totalPhases = roadmapPhases.length;
  const completedPhases = roadmapPhases.filter(p => p.status === 'completed').length;
  const inProgressPhases = roadmapPhases.filter(p => p.status === 'in-progress').length;
  const overallProgress = Math.round(
    roadmapPhases.reduce((acc, phase) => acc + phase.progress, 0) / totalPhases
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roadmap do Projeto</h1>
          <p className="text-muted-foreground">
            Acompanhe o progresso de desenvolvimento do SAF School
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                Concluídas
              </CardDescription>
              <CardTitle className="text-3xl text-emerald-600">{completedPhases}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">de {totalPhases} fases</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="size-4 text-amber-500" />
                Em Progresso
              </CardDescription>
              <CardTitle className="text-3xl text-amber-600">{inProgressPhases}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">fases ativas</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-muted bg-muted/30">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Circle className="size-4 text-muted-foreground" />
                Planejadas
              </CardDescription>
              <CardTitle className="text-3xl">{totalPhases - completedPhases - inProgressPhases}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">fases futuras</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Rocket className="size-4 text-primary" />
                Progresso Total
              </CardDescription>
              <CardTitle className="text-3xl text-primary">{overallProgress}%</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={overallProgress} className="h-2" />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Separator />

      {/* Roadmap Timeline */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {roadmapPhases.map((phase) => {
          const StatusIcon = getStatusIcon(phase.status);
          const Icon = phase.icon;

          return (
            <motion.div key={phase.id} variants={itemVariants}>
              <Card className={cn(
                'h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
                phase.status === 'completed' && 'border-emerald-500/30',
                phase.status === 'in-progress' && 'border-amber-500/30 ring-2 ring-amber-500/20',
                phase.status === 'planned' && 'opacity-80'
              )}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className={cn(
                      'flex size-12 items-center justify-center rounded-xl transition-colors',
                      phase.status === 'completed' && 'bg-emerald-500/10 text-emerald-600',
                      phase.status === 'in-progress' && 'bg-amber-500/10 text-amber-600',
                      phase.status === 'planned' && 'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="size-6" />
                    </div>
                    <Badge variant="outline" className={cn('shrink-0', getStatusColor(phase.status))}>
                      <StatusIcon className="mr-1 size-3" />
                      {getStatusLabel(phase.status)}
                    </Badge>
                  </div>
                  <div className="space-y-1 pt-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className="text-muted-foreground font-normal">#{phase.id}</span>
                      {phase.title}
                    </CardTitle>
                    <CardDescription>{phase.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{phase.progress}%</span>
                    </div>
                    <Progress 
                      value={phase.progress} 
                      className={cn(
                        'h-2',
                        phase.status === 'completed' && '[&>div]:bg-emerald-500',
                        phase.status === 'in-progress' && '[&>div]:bg-amber-500'
                      )}
                    />
                  </div>

                  {/* Features List */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Funcionalidades</h4>
                    <ul className="space-y-1.5">
                      {phase.features.map((feature, index) => {
                        const FeatureIcon = getStatusIcon(feature.status);
                        return (
                          <li 
                            key={index}
                            className={cn(
                              'flex items-center gap-2 text-sm',
                              feature.status === 'completed' && 'text-emerald-600',
                              feature.status === 'in-progress' && 'text-amber-600',
                              feature.status === 'planned' && 'text-muted-foreground'
                            )}
                          >
                            <FeatureIcon className="size-3.5 shrink-0" />
                            <span className="flex-1">{feature.name}</span>
                            {feature.priority && getPriorityBadge(feature.priority)}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
