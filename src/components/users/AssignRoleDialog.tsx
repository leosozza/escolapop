import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ROLE_CONFIG, type AppRole } from '@/types/database';
import { RoleBadge } from './RoleBadge';

const ALL_ROLES: AppRole[] = [
  'admin',
  'gestor',
  'agente_comercial',
  'recepcao',
  'professor',
  'produtor',
  'scouter',
  'aluno',
];

interface UserWithRoles {
  id: string;
  user_id: string;
  full_name: string;
  roles: AppRole[];
}

interface AssignRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRoles;
  onSuccess: () => void;
}

export function AssignRoleDialog({ open, onOpenChange, user, onSuccess }: AssignRoleDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(user.roles);
  const { toast } = useToast();

  const handleRoleToggle = (role: AppRole) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Get roles to add and remove
      const rolesToAdd = selectedRoles.filter(r => !user.roles.includes(r));
      const rolesToRemove = user.roles.filter(r => !selectedRoles.includes(r));

      // Remove old roles
      if (rolesToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.user_id)
          .in('role', rolesToRemove);

        if (deleteError) throw deleteError;
      }

      // Add new roles
      if (rolesToAdd.length > 0) {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(rolesToAdd.map(role => ({
            user_id: user.user_id,
            role,
          })));

        if (insertError) throw insertError;
      }

      toast({
        title: 'Permissões atualizadas!',
        description: `As permissões de ${user.full_name} foram salvas.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Error updating roles:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar permissões',
        description: (error as Error).message || 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Permissões</DialogTitle>
          <DialogDescription>
            Atribua perfis de acesso para {user.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {ALL_ROLES.map((role) => {
            const config = ROLE_CONFIG[role];
            const isSelected = selectedRoles.includes(role);

            return (
              <div
                key={role}
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  id={role}
                  checked={isSelected}
                  onCheckedChange={() => handleRoleToggle(role)}
                />
                <Label
                  htmlFor={role}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <RoleBadge role={role} />
                      <p className="text-sm text-muted-foreground mt-1">
                        {config.description}
                      </p>
                    </div>
                  </div>
                </Label>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-primary hover:opacity-90"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Salvar Permissões'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
