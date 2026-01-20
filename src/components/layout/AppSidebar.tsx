import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import { useNotificationCounts, NotificationCounts } from '@/hooks/useNotificationCounts';
import { NotificationBadge } from './NotificationBadge';

// Mapeamento de rotas para contagem de notificações
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

const menuItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.02,
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  }),
};

const logoVariants = {
  collapsed: { scale: 1.1 },
  expanded: { scale: 1 },
};

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

  let globalItemIndex = 0;

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
    >
      {/* Header com Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-200"
            >
              <motion.div 
                className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md"
                variants={logoVariants}
                animate={isCollapsed ? "collapsed" : "expanded"}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.08, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <Sparkles className="size-4" />
              </motion.div>
              <motion.div 
                className="grid flex-1 text-left text-sm leading-tight overflow-hidden"
                initial={false}
                animate={{ 
                  opacity: isCollapsed ? 0 : 1,
                  width: isCollapsed ? 0 : 'auto',
                }}
                transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <span className="truncate font-semibold">SAF School</span>
                <span className="truncate text-xs text-muted-foreground">CRM + LMS</span>
              </motion.div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navegação Principal */}
      <SidebarContent className="overflow-x-hidden">
        {sidebarGroups.map((group) => (
          <Collapsible
            key={group.title}
            asChild
            defaultOpen={isGroupOpen(group) || group.title === 'Comercial'}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center gap-2 transition-colors duration-200 hover:text-foreground [&[data-state=open]>svg]:rotate-90">
                  <span className="uppercase tracking-wider text-xs font-semibold">{group.title}</span>
                  <ChevronRight className="ml-auto size-3.5 transition-transform duration-200" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      const currentIndex = globalItemIndex++;
                      const badgeCount = getBadgeCount(item.href);
                      const badgeVariant = getBadgeVariant(item.href);
                      
                      return (
                        <motion.div
                          key={item.name}
                          custom={currentIndex}
                          initial="hidden"
                          animate="visible"
                          variants={menuItemVariants}
                        >
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              tooltip={item.name}
                              className={cn(
                                'transition-all duration-200 hover:translate-x-0.5',
                                isActive && 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm'
                              )}
                            >
                              <Link to={item.href}>
                                <motion.div
                                  className="relative"
                                  whileHover={{ scale: 1.1, rotate: isActive ? 0 : 5 }}
                                  whileTap={{ scale: 0.95 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <item.icon className={cn('size-4', isActive && 'text-sidebar-primary-foreground')} />
                                  {badgeCount > 0 && isCollapsed && (
                                    <NotificationBadge 
                                      count={badgeCount} 
                                      variant={badgeVariant}
                                      pulse={badgeVariant === 'danger'}
                                      className="-top-2 -right-2"
                                    />
                                  )}
                                </motion.div>
                                <span className="flex-1">{item.name}</span>
                                {badgeCount > 0 && !isCollapsed && (
                                  <NotificationBadge 
                                    count={badgeCount} 
                                    variant={badgeVariant}
                                    pulse={badgeVariant === 'danger'}
                                    className="relative top-0 right-0"
                                  />
                                )}
                                {isActive && badgeCount === 0 && (
                                  <motion.span 
                                    className="ml-auto size-1.5 rounded-full bg-sidebar-primary-foreground"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ 
                                      type: "spring",
                                      stiffness: 500,
                                      damping: 25
                                    }}
                                  />
                                )}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </motion.div>
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
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-200"
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Avatar className="size-8 rounded-lg ring-2 ring-sidebar-primary/30 transition-all duration-200">
                      <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? 'Usuário'} />
                      <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
                        {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  <motion.div 
                    className="grid flex-1 text-left text-sm leading-tight overflow-hidden"
                    initial={false}
                    animate={{ 
                      opacity: isCollapsed ? 0 : 1,
                      width: isCollapsed ? 0 : 'auto',
                    }}
                    transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <span className="truncate font-semibold">{profile?.full_name ?? 'Usuário'}</span>
                    <span className="truncate text-xs text-muted-foreground flex items-center gap-1">
                      <motion.span 
                        className="size-1.5 rounded-full bg-emerald-500"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      Online
                    </span>
                  </motion.div>
                  <ChevronsUpDown className="ml-auto size-4 transition-transform duration-200" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg animate-scale-in"
                side={isCollapsed ? "right" : "top"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem className="gap-2 p-2 cursor-pointer transition-colors duration-150" asChild>
                  <Link to="/settings">
                    <Settings className="size-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 p-2 text-destructive focus:text-destructive cursor-pointer transition-colors duration-150"
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
      <SidebarRail className="transition-opacity duration-200 hover:opacity-100 opacity-50" />
    </Sidebar>
  );
}
