import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

const routeNames: Record<string, { title: string; icon?: string }> = {
  '/dashboard': { title: 'Dashboard' },
  '/crm': { title: 'CRM' },
  '/appointments': { title: 'Agendamento' },
  '/reception': { title: 'Recepção' },
  '/producer-queue': { title: 'Atendimento' },
  '/students': { title: 'Alunos' },
  '/classes': { title: 'Turmas' },
  '/courses': { title: 'Cursos' },
  '/lms': { title: 'Aulas (LMS)' },
  '/academic-support': { title: 'Atendimento Matrícula' },
  '/certificates': { title: 'Certificados' },
  '/billing': { title: 'Cobrança' },
  '/contracts': { title: 'Contratos' },
  '/payments': { title: 'Pagamentos' },
  '/overdue': { title: 'Inadimplência' },
  '/team': { title: 'Equipe' },
  '/reports': { title: 'Relatórios' },
  '/settings': { title: 'Configurações' },
  '/agent-portfolio': { title: 'Portfólio do Agente' },
  '/users': { title: 'Usuários' },
  '/roadmap': { title: 'Roadmap' },
  '/user-management': { title: 'Gestão de Acessos' },
  '/studio': { title: 'Studio' },
};

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export function AppLayout({ children }: AppLayoutProps) {
  const { user, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-muted-foreground">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const currentRoute = routeNames[location.pathname];
  const currentTitle = currentRoute?.title || 'Página';

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground transition-colors" />
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              {currentTitle}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                className="pl-9 w-64 h-10 rounded-xl bg-muted/50 border-border/50 focus:bg-background"
              />
            </div>

            {/* User avatar */}
            <Avatar className="size-10 ring-2 ring-primary/20 cursor-pointer">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? 'Usuário'} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {profile?.full_name ? getInitials(profile.full_name) : 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="container py-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
