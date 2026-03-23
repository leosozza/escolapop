import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Users } from 'lucide-react';

interface RegisterSiblingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guardianName: string;
  guardianPhone: string;
  onSiblingCreated?: (leadId: string) => void;
}

export function RegisterSiblingDialog({ open, onOpenChange, guardianName, guardianPhone, onSiblingCreated }: RegisterSiblingDialogProps) {
  const [fullName, setFullName] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [externalId, setExternalId] = useState('');
  const [recordId, setRecordId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast.error('Nome do modelo é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create new lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          full_name: fullName.trim(),
          guardian_name: guardianName,
          phone: guardianPhone,
          source: 'indicacao' as any,
          status: 'matriculado' as any,
          origin_sector: 'academico',
          external_id: externalId.trim() || null,
          external_source: externalId.trim() ? 'bitrix' : null,
          maxsystem_contract_number: contractNumber.trim() || null,
          maxsystem_record_id: recordId.trim() || null,
        } as any)
        .select('id')
        .single();

      if (leadError) throw leadError;

      // Create student record
      const { error: studentError } = await supabase
        .from('students')
        .insert({
          lead_id: lead.id,
          full_name: fullName.trim(),
          guardian_name: guardianName,
        });

      if (studentError) throw studentError;

      toast.success('Irmão cadastrado com sucesso!');
      onSiblingCreated?.(lead.id);
      onOpenChange(false);
      setFullName('');
      setContractNumber('');
      setExternalId('');
      setRecordId('');
    } catch (err) {
      console.error('Error creating sibling:', err);
      toast.error('Erro ao cadastrar irmão');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Novo Aluno (Irmão)
          </DialogTitle>
          <DialogDescription>
            Cadastrar um novo aluno do mesmo responsável ({guardianName || guardianPhone})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Responsável</Label>
            <Input value={guardianName || guardianPhone} disabled className="h-8 text-sm bg-muted" />
          </div>
          <div>
            <Label className="text-xs">Telefone</Label>
            <Input value={guardianPhone} disabled className="h-8 text-sm bg-muted" />
          </div>
          <div>
            <Label className="text-xs">Nome do Modelo *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nome completo do aluno" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Nº Contrato MaxSystem</Label>
            <Input value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="Opcional" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">ID Bitrix</Label>
            <Input value={externalId} onChange={e => setExternalId(e.target.value)} placeholder="Opcional" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">ID Ficha MaxSystem</Label>
            <Input value={recordId} onChange={e => setRecordId(e.target.value)} placeholder="Opcional" className="h-8 text-sm" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !fullName.trim()}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Cadastrar Irmão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
