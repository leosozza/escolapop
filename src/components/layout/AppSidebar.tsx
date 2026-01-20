import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  UserPlus,
  BookOpen,
  DoorOpen,
  Headphones,
  MessageSquare,
  Users2,
  ClipboardCheck,
  Award,
  FileText,
  CreditCard,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState, useEffect } from 'react';

const sidebarGroups = [
  {
    title: 'Comercial',
    defaultOpen: true,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Leads', href: '/leads', icon: UserPlus },
      { name: 'Telemarketing', href: '/telemarketing', icon: Headphones },
      { name: 'Agendamentos', href: '/appointments', icon: Calendar },
      { name: 'Recepção', href: '/reception', icon: DoorOpen },
      { name: 'Atendimento', href: '/producer-queue', icon: MessageSquare },
    ],
  },
  {
    title: 'Acadêmico',
    defaultOpen: false,
    items: [
      { name: 'Alunos', href: '/students', icon: Users },
      { name: 'Turmas', href: '/classes', icon: Users2 },
      { name: 'Cursos', href: '/courses', icon: GraduationCap },
      { name: 'Aulas (LMS)', href: '/lms', icon: BookOpen },
      { name: 'Presença', href: '/attendance', icon: ClipboardCheck },
      { name: 'Certificados', href: '/certificates', icon: Award },
    ],
  },
  {
    title: 'Financeiro',
    defaultOpen: false,
    items: [
      { name: 'Contratos', href: '/contracts', icon: FileText },
      { name: 'Pagamentos', href: '/payments', icon: CreditCard },
      { name: 'Inadimplência', href: '/overdue', icon: AlertTriangle },
    ],
  },
  {
    title: 'Gestão',
    defaultOpen: false,
    items: [
      { name: 'Equipe', href: '/team', icon: Users },
      { name: 'Relatórios', href: '/reports', icon: BarChart3 },
      { name: 'Configurações', href: '/settings', icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  
  // Initialize open groups based on current route
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sidebarGroups.forEach((group) => {
      const isActive = group.items.some((item) => location.pathname === item.href);
      initial[group.title] = isActive || group.defaultOpen;
    });
    return initial;
  });

  // Update open groups when route changes
  useEffect(() => {
    sidebarGroups.forEach((group) => {
      const isActive = group.items.some((item) => location.pathname === item.href);
      if (isActive && !openGroups[group.title]) {
        setOpenGroups((prev) => ({ ...prev, [group.title]: true }));
      }
    });
  }, [location.pathname]);

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">SAF School</h1>
          <p className="text-xs text-sidebar-foreground/60">CRM + LMS</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {sidebarGroups.map((group) => (
          <Collapsible
            key={group.title}
            open={openGroups[group.title]}
            onOpenChange={() => toggleGroup(group.title)}
          >
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70">
                {group.title}
                {openGroups[group.title] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <item.icon
                      className={cn('h-5 w-5', isActive && 'animate-scale-in')}
                    />
                    {item.name}
                    {isActive && (
                      <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-white" />
                    )}
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </nav>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-sidebar-primary/50">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
              {profile?.full_name ? getInitials(profile.full_name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {profile?.full_name ?? 'Usuário'}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">Online</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-8 w-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
