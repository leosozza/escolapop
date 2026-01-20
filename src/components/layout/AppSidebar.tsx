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
  ChevronRight,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronsUpDown } from 'lucide-react';

const sidebarGroups = [
  {
    title: 'Comercial',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'CRM', href: '/crm', icon: UserPlus },
      { name: 'Telemarketing', href: '/telemarketing', icon: Headphones },
      { name: 'Agendamentos', href: '/appointments', icon: Calendar },
      { name: 'Recepção', href: '/reception', icon: DoorOpen },
      { name: 'Atendimento', href: '/producer-queue', icon: MessageSquare },
    ],
  },
  {
    title: 'Acadêmico',
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
    items: [
      { name: 'Contratos', href: '/contracts', icon: FileText },
      { name: 'Pagamentos', href: '/payments', icon: CreditCard },
      { name: 'Inadimplência', href: '/overdue', icon: AlertTriangle },
    ],
  },
  {
    title: 'Gestão',
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
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

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

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Header com Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md">
                <Sparkles className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">SAF School</span>
                <span className="truncate text-xs text-muted-foreground">CRM + LMS</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navegação Principal */}
      <SidebarContent>
        {sidebarGroups.map((group) => (
          <Collapsible
            key={group.title}
            asChild
            defaultOpen={isGroupOpen(group) || group.title === 'Comercial'}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center gap-2 [&[data-state=open]>svg]:rotate-90">
                  <span className="uppercase tracking-wider">{group.title}</span>
                  <ChevronRight className="ml-auto size-4 transition-transform duration-200" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.name}
                            className={cn(
                              'transition-all duration-200',
                              isActive && 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm'
                            )}
                          >
                            <Link to={item.href}>
                              <item.icon className={cn('size-4', isActive && 'text-sidebar-primary-foreground')} />
                              <span>{item.name}</span>
                              {isActive && (
                                <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary-foreground animate-pulse" />
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

      {/* Footer com Perfil do Usuário */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg ring-2 ring-sidebar-primary/30">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? 'Usuário'} />
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
                      {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{profile?.full_name ?? 'Usuário'}</span>
                    <span className="truncate text-xs text-muted-foreground flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Online
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isCollapsed ? "right" : "top"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem className="gap-2 p-2" asChild>
                  <Link to="/settings">
                    <Settings className="size-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 p-2 text-destructive focus:text-destructive"
                  onClick={signOut}
                >
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Rail para arrastar/clicar para expandir/colapsar */}
      <SidebarRail />
    </Sidebar>
  );
}
