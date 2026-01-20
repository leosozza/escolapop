import { useState, useRef, ChangeEvent } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AddAgentDialog({ open, onOpenChange, onSuccess }: AddAgentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetForm = () => {
    setFullName('');
    setWhatsappPhone('');
    setImageFile(null);
    setImagePreview(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Use apenas JPG, PNG ou WebP.',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 5MB.',
      });
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const formatPhone = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    
    // Apply Brazilian phone mask
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setWhatsappPhone(formatted);
  };

  const handleSubmit = async () => {
    // Validation
    if (!fullName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Informe o nome completo do agente.',
      });
      return;
    }

    if (fullName.trim().length < 3) {
      toast({
        variant: 'destructive',
        title: 'Nome muito curto',
        description: 'O nome deve ter pelo menos 3 caracteres.',
      });
      return;
    }

    const phoneDigits = whatsappPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      toast({
        variant: 'destructive',
        title: 'WhatsApp inválido',
        description: 'Informe um número de WhatsApp válido.',
      });
      return;
    }

    setIsLoading(true);

    try {
      let avatarUrl: string | null = null;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `agent-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;
      }

      // Insert agent
      const { error: insertError } = await supabase
        .from('agents')
        .insert({
          full_name: fullName.trim(),
          whatsapp_phone: phoneDigits,
          avatar_url: avatarUrl,
        });

      if (insertError) throw insertError;

      toast({
        title: 'Agente adicionado!',
        description: `${fullName} foi cadastrado com sucesso.`,
      });

      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error adding agent:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao adicionar agente',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Agente de Relacionamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Image Upload Area - 16:9 */}
          <div>
            <Label className="mb-2 block">Foto do Agente (16:9)</Label>
            <div 
              className="cursor-pointer relative overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <AspectRatio ratio={16 / 9}>
                {imagePreview ? (
                  <>
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-muted/50">
                    <ImagePlus className="h-10 w-10 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Clique para enviar imagem</span>
                    <span className="text-xs text-muted-foreground mt-1">JPG, PNG ou WebP (máx. 5MB)</span>
                  </div>
                )}
              </AspectRatio>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>

          {/* Full Name */}
          <div>
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              placeholder="João Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* WhatsApp Phone */}
          <div>
            <Label htmlFor="whatsapp">WhatsApp para Alertas</Label>
            <Input
              id="whatsapp"
              placeholder="(11) 99999-9999"
              value={whatsappPhone}
              onChange={handlePhoneChange}
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Adicionar Agente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
