import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  UserPlus,
  BookOpen,
  DoorOpen,
  Headphones,
  MessageSquare,
  Users2,
  Award,
  FileText,
  CreditCard,
  AlertTriangle,
  Rocket,
  Receipt,
  Camera,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useNotificationCounts, NotificationCounts } from '@/hooks/useNotificationCounts';
import { NotificationBadge } from './NotificationBadge';
import logoImg from '@/assets/logo-pep.png';

const badgeRouteMap: Record<string, keyof NotificationCounts> = {
  '/crm': 'crm',
  '/appointments': 'appointments',
  '/overdue': 'overdue',
  '/reception': 'reception',
};

const sidebarGroups = [
  {
    title: 'Comercial',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'CRM', href: '/crm', icon: UserPlus },
      { name: 'Atendimentos', href: '/academic-support', icon: Headphones },
      { name: 'Recepção', href: '/reception', icon: DoorOpen },
      { name: 'Agendamento', href: '/appointments', icon: Calendar },
      { name: 'Studio', href: '/studio', icon: Camera },
    ],
  },
  {
    title: 'Acadêmico',
    items: [
      { name: 'Alunos', href: '/students', icon: Users },
      { name: 'Turmas', href: '/classes', icon: Users2 },
      { name: 'Cursos', href: '/courses', icon: GraduationCap },
      { name: 'Aulas (LMS)', href: '/lms', icon: BookOpen },
      { name: 'Certificados', href: '/certificates', icon: Award },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { name: 'Cobrança', href: '/billing', icon: Receipt },
      { name: 'Contratos', href: '/contracts', icon: FileText },
      { name: 'Pagamentos', href: '/payments', icon: CreditCard },
      { name: 'Inadimplência', href: '/overdue', icon: AlertTriangle },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { name: 'Gestão de Acessos', href: '/user-management', icon: Shield },
      { name: 'Equipe', href: '/team', icon: Users },
      { name: 'Relatórios', href: '/reports', icon: BarChart3 },
      { name: 'Roadmap', href: '/roadmap', icon: Rocket },
      { name: 'Configurações', href: '/settings', icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { counts } = useNotificationCounts();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isGroupOpen = (group: typeof sidebarGroups[0]) => {
    return group.items.some((item) => location.pathname === item.href);
  };

  const getBadgeCount = (href: string): number => {
    const key = badgeRouteMap[href];
    return key ? counts[key] : 0;
  };

  const getBadgeVariant = (href: string): 'danger' | 'warning' | 'default' => {
    if (href === '/overdue') return 'danger';
    if (href === '/appointments') return 'warning';
    return 'default';
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0 bg-gradient-to-b from-[hsl(262,83%,18%)] to-[hsl(262,83%,12%)]"
    >
      {/* Logo */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img
            src={logoImg}
            alt="PEP System"
            className={cn(
              'transition-all duration-300',
              isCollapsed ? 'h-8 w-8 object-contain object-left' : 'h-10 w-auto max-w-[140px]'
            )}
          />
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="overflow-x-hidden px-2">
        {sidebarGroups.map((group) => (
          <Collapsible
            key={group.title}
            asChild
            defaultOpen={isGroupOpen(group) || group.title === 'Comercial'}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors duration-200 [&[data-state=open]>svg]:rotate-180">
                  <span className="uppercase tracking-widest text-[10px] font-bold">{group.title}</span>
                  <ChevronDown className="ml-auto size-3 transition-transform duration-200" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      const badgeCount = getBadgeCount(item.href);
                      const badgeVariant = getBadgeVariant(item.href);

                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.name}
                            className={cn(
                              'rounded-lg transition-all duration-200 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                              isActive && 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-md'
                            )}
                          >
                            <Link to={item.href} className="flex items-center gap-3">
                              <div className="relative">
                                <item.icon className="size-4" />
                                {badgeCount > 0 && isCollapsed && (
                                  <NotificationBadge
                                    count={badgeCount}
                                    variant={badgeVariant}
                                    pulse={badgeVariant === 'danger'}
                                    className="-top-2 -right-2"
                                  />
                                )}
                              </div>
                              <span className="flex-1 text-sm">{item.name}</span>
                              {badgeCount > 0 && !isCollapsed && (
                                <NotificationBadge
                                  count={badgeCount}
                                  variant={badgeVariant}
                                  pulse={badgeVariant === 'danger'}
                                  className="relative top-0 right-0"
                                />
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="rounded-lg hover:bg-sidebar-accent transition-all duration-200"
              onClick={signOut}
            >
              <Avatar className="size-9 rounded-lg ring-2 ring-sidebar-primary/40">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? 'Usuário'} />
                <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                  {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-sidebar-foreground">{profile?.full_name ?? 'Usuário'}</span>
                  <span className="truncate text-xs text-sidebar-foreground/50">Admin</span>
                </div>
              )}
              {!isCollapsed && <ChevronDown className="ml-auto size-4 text-sidebar-foreground/50" />}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail className="transition-opacity duration-200 hover:opacity-100 opacity-50" />
    </Sidebar>
  );
}
