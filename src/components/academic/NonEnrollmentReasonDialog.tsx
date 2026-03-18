import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const REASONS = [
  { value: 'sem_resposta', label: 'Sem Resposta' },
  { value: 'sem_interesse', label: 'Sem Interesse' },
  { value: 'contrato_cancelado', label: 'Contrato Cancelado' },
  { value: 'sem_disponibilidade', label: 'Sem Disponibilidade' },
  { value: 'distancia', label: 'Distância' },
  { value: 'outro', label: 'Outro Motivo' },
];

interface NonEnrollmentReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onReasonSaved: () => void;
}

export function NonEnrollmentReasonDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  onReasonSaved,
}: NonEnrollmentReasonDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!reason) return;
    if (reason === 'outro' && !customReason.trim()) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('lead_non_enrollment_reasons').insert({
        lead_id: leadId,
        reason: reason as any,
        custom_reason: reason === 'outro' ? customReason : null,
      });

      if (error) throw error;

      toast({
        title: 'Motivo registrado',
        description: `Motivo de não matrícula salvo para ${leadName}.`,
      });
      onReasonSaved();
      onOpenChange(false);
      setReason('');
      setCustomReason('');
    } catch (error) {
      console.error('Error saving reason:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar motivo',
        description: 'Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Motivo Obrigatório
          </DialogTitle>
          <DialogDescription>
            O lead <strong>{leadName}</strong> está como "Não Matriculado". É necessário registrar
            um motivo antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o motivo..." />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {reason === 'outro' && (
            <Textarea
              placeholder="Descreva o motivo..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              rows={3}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!reason || (reason === 'outro' && !customReason.trim()) || isSaving}
          >
            {isSaving ? 'Salvando...' : 'Salvar Motivo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
