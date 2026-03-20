import { useState, useEffect } from 'react';
import { Loader2, UserPlus, UserMinus, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Instance {
  id: string;
  name: string;
}

interface UserWithAccess {
  user_id: string;
  full_name: string;
  role: string;
  has_access: boolean;
}

interface Props {
  instance: Instance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppInstanceAccessDialog({ instance, open, onOpenChange }: Props) {
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) loadUsers();
  }, [open, instance.id]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Get all staff profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      // Get all roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Get current access for this instance
      const { data: access } = await supabase
        .from('whatsapp_instance_access')
        .select('user_id')
        .eq('instance_id', instance.id);

      const accessSet = new Set((access || []).map(a => a.user_id));
      const roleMap = new Map<string, string>();
      (roles || []).forEach(r => roleMap.set(r.user_id, r.role));

      const userList: UserWithAccess[] = (profiles || [])
        .filter(p => roleMap.has(p.user_id))
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          role: roleMap.get(p.user_id) || 'unknown',
          has_access: accessSet.has(p.user_id),
        }))
        .sort((a, b) => {
          if (a.has_access !== b.has_access) return a.has_access ? -1 : 1;
          return a.full_name.localeCompare(b.full_name);
        });

      setUsers(userList);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const toggleAccess = async (userId: string, grant: boolean) => {
    setSaving(prev => ({ ...prev, [userId]: true }));
    try {
      if (grant) {
        const { error } = await supabase.from('whatsapp_instance_access').insert({
          instance_id: instance.id,
          user_id: userId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_instance_access')
          .delete()
          .eq('instance_id', instance.id)
          .eq('user_id', userId);
        if (error) throw error;
      }

      setUsers(prev =>
        prev.map(u => u.user_id === userId ? { ...u, has_access: grant } : u)
      );
      toast.success(grant ? 'Acesso concedido' : 'Acesso removido');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao alterar acesso');
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }));
    }
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    gestor: 'Gestor',
    supervisor: 'Supervisor',
    agente_comercial: 'Agente Comercial',
    agente_matricula: 'Agente Matrícula',
    recepcao: 'Recepção',
    professor: 'Professor',
    produtor: 'Produtor',
    scouter: 'Scouter',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Acessos — {instance.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1">
              {users.map(user => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={user.has_access}
                      onCheckedChange={(checked) => toggleAccess(user.user_id, !!checked)}
                      disabled={saving[user.user_id]}
                    />
                    <div>
                      <p className="text-sm font-medium">{user.full_name}</p>
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </div>
                  </div>
                  {saving[user.user_id] && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              ))}

              {users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum usuário encontrado
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
