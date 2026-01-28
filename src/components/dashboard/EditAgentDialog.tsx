import { useState, useEffect } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Agent {
  id: string;
  full_name: string;
  avatar_url: string | null;
  whatsapp_phone: string;
}

interface EditAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onSuccess: () => void;
}

export function EditAgentDialog({ open, onOpenChange, agent, onSuccess }: EditAgentDialogProps) {
  const [fullName, setFullName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (agent) {
      setFullName(agent.full_name);
      setWhatsappPhone(agent.whatsapp_phone);
      setAvatarUrl(agent.avatar_url);
    }
  }, [agent]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !agent) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `agents/${agent.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar foto',
        description: 'Tente novamente.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!agent || !fullName.trim() || !whatsappPhone.trim()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('agents')
        .update({
          full_name: fullName.trim(),
          whatsapp_phone: whatsappPhone.trim(),
          avatar_url: avatarUrl,
        })
        .eq('id', agent.id);

      if (error) throw error;

      toast({
        title: 'Agente atualizado!',
        description: `${fullName} foi atualizado com sucesso.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Error updating agent:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar agente',
        description: (error as Error).message || 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!agent) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('agents')
        .update({ is_active: false })
        .eq('id', agent.id);

      if (error) throw error;

      toast({
        title: 'Agente removido!',
        description: `${agent.full_name} foi removido da equipe.`,
      });

      setShowDeleteConfirm(false);
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Error deleting agent:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover agente',
        description: (error as Error).message || 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (!agent) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agente</DialogTitle>
            <DialogDescription>
              Atualize as informações do agente de relacionamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl || undefined} alt={fullName} className="object-cover" />
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {getInitials(fullName || 'AG')}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatar-upload-edit"
                  className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {isUploading ? 'Enviando...' : 'Alterar'}
                </label>
                <input
                  id="avatar-upload-edit"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nome do agente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="bg-gradient-primary hover:opacity-90"
                disabled={isLoading || !fullName.trim() || !whatsappPhone.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {agent.full_name} da equipe de agentes de relacionamento?
              Esta ação pode ser revertida pelo administrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
