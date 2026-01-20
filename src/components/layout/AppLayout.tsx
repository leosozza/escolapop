import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface AppLayoutProps {
  children: ReactNode;
}

const routeNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/crm': 'CRM',
  '/telemarketing': 'Telemarketing',
  '/appointments': 'Agendamentos',
  '/reception': 'Recepção',
  '/producer-queue': 'Atendimento',
  '/students': 'Alunos',
  '/classes': 'Turmas',
  '/courses': 'Cursos',
  '/lms': 'Aulas (LMS)',
  '/attendance': 'Presença',
  '/certificates': 'Certificados',
  '/contracts': 'Contratos',
  '/payments': 'Pagamentos',
  '/overdue': 'Inadimplência',
  '/team': 'Equipe',
  '/reports': 'Relatórios',
  '/settings': 'Configurações',
  '/agent-portfolio': 'Portfólio do Agente',
  '/users': 'Usuários',
};

const pageVariants = {
  initial: { 
    opacity: 0, 
    y: 12,
    scale: 0.99
  },
  animate: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  },
  exit: { 
    opacity: 0, 
    y: -8,
    scale: 0.99,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  }
};

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading } = useAuth();
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
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-muted-foreground">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const currentRouteName = routeNames[location.pathname] || 'Página';

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 transition-all duration-300">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 transition-all duration-200 hover:scale-105 active:scale-95" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink 
                    href="/dashboard" 
                    className="transition-colors duration-200 hover:text-primary"
                  >
                    SAF School
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium">{currentRouteName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
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
