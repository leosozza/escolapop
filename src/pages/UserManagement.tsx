import { useState, useEffect } from 'react';
import {
  Shield,
  UserPlus,
  KeyRound,
  History,
  Search,
  Loader2,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { ResetPasswordDialog } from '@/components/users/ResetPasswordDialog';
import { AssignRoleDialog } from '@/components/users/AssignRoleDialog';
import { ROLE_CONFIG, type AppRole } from '@/types/database';
import { RoleBadge } from '@/components/users/RoleBadge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ManagedUser {
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: AppRole[];
}

interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  details: any;
  performed_by: string;
  created_at: string;
}

const AREA_ROLES: Record<string, AppRole[]> = {
  'Acadêmico': ['agente_matricula', 'professor', 'recepcao', 'gestor'],
  'Comercial': ['supervisor', 'agente_comercial', 'recepcao', 'produtor', 'gestor', 'scouter'],
  'Financeiro': ['admin', 'gestor'],
  'Gestão': ['gestor', 'supervisor'],
};

const ACTION_LABELS: Record<string, string> = {
  user_created: 'Usuário criado',
  password_reset: 'Senha resetada',
  role_assigned: 'Permissão atribuída',
  role_removed: 'Permissão removida',
};

export default function UserManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<ManagedUser | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list_users' },
      });
      if (error) throw error;
      setUsers(data.users || []);

      // Load audit log
      const { data: audit } = await supabase
        .from('access_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setAuditLog(audit || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: error.message || 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.roles.some((r) => r.includes(q));
  });

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const getUserName = (userId: string) => {
    return users.find((u) => u.user_id === userId)?.full_name || userId.slice(0, 8);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Gestão de Acessos
          </h1>
          <p className="text-muted-foreground">
            Criar usuários, gerenciar permissões e auditar alterações
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Criar Colaborador
        </Button>
      </div>

      {/* Area Mapping Info */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(AREA_ROLES).map(([area, roles]) => (
          <Card key={area} className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{area}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {roles.map((role) => (
                  <Badge key={role} variant="secondary" className="text-[10px]">
                    {ROLE_CONFIG[role]?.label || role}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Colaboradores ({users.length})
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou permissão..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredUsers.map((u) => (
                <Card key={u.user_id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
                          {getInitials(u.full_name)}
                        </div>
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Criado em {format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 flex-wrap mr-4">
                          {u.roles.length > 0 ? (
                            u.roles.map((role) => (
                              <RoleBadge key={role} role={role} />
                            ))
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Sem permissão
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRoleTarget(u)}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Permissões
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetTarget(u)}
                        >
                          <KeyRound className="h-3 w-3 mr-1" />
                          Senha
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {ACTION_LABELS[entry.action] || entry.action}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Usuário: {getUserName(entry.user_id)} • Por: {getUserName(entry.performed_by)}
                        </p>
                        {entry.details && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {entry.details.role && `Permissão: ${ROLE_CONFIG[entry.details.role as AppRole]?.label || entry.details.role}`}
                            {entry.details.email && `Email: ${entry.details.email}`}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                  {auditLog.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      Nenhuma atividade registrada ainda.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateUserDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={loadData}
      />

      {resetTarget && (
        <ResetPasswordDialog
          open={!!resetTarget}
          onOpenChange={(open) => !open && setResetTarget(null)}
          userId={resetTarget.user_id}
          userName={resetTarget.full_name}
          onSuccess={loadData}
        />
      )}

      {roleTarget && (
        <AssignRoleDialog
          open={!!roleTarget}
          onOpenChange={(open) => !open && setRoleTarget(null)}
          userId={roleTarget.user_id}
          userName={roleTarget.full_name}
          currentRoles={roleTarget.roles}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
