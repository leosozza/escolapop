import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegisterLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  onSuccess: (leadId: string) => void;
}

export function RegisterLeadDialog({ open, onOpenChange, phone, onSuccess }: RegisterLeadDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [maxsystemContract, setMaxsystemContract] = useState('');
  const [bitrixId, setBitrixId] = useState('');
  const [maxsystemRecordId, setMaxsystemRecordId] = useState('');

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast.error('O nome do modelo é obrigatório.');
      return;
    }

    setIsLoading(true);
    try {
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          full_name: fullName.trim(),
          guardian_name: guardianName.trim() || null,
          phone,
          source: 'whatsapp' as any,
          origin_sector: 'comercial',
          external_id: bitrixId.trim() || null,
          external_source: bitrixId.trim() ? 'bitrix' : null,
          maxsystem_contract_number: maxsystemContract.trim() || null,
          maxsystem_record_id: maxsystemRecordId.trim() || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Link existing messages to this lead
      await supabase
        .from('whatsapp_messages')
        .update({ lead_id: newLead.id })
        .eq('phone', phone);

      toast.success('Lead cadastrado com sucesso!');
      resetForm();
      onOpenChange(false);
      onSuccess(newLead.id);
    } catch (err: any) {
      console.error('Error registering lead:', err);
      toast.error('Erro ao cadastrar lead');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setGuardianName('');
    setMaxsystemContract('');
    setBitrixId('');
    setMaxsystemRecordId('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar como Lead</DialogTitle>
          <DialogDescription>
            Telefone: {phone}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Modelo <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Nome completo do modelo"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Nome do Responsável</Label>
            <Input
              placeholder="Nome da mãe/responsável"
              value={guardianName}
              onChange={e => setGuardianName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nº Contrato MaxSystem</Label>
              <Input
                placeholder="Ex: 12345"
                value={maxsystemContract}
                onChange={e => setMaxsystemContract(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ID Ficha MaxSystem</Label>
              <Input
                placeholder="Ex: 67890"
                value={maxsystemRecordId}
                onChange={e => setMaxsystemRecordId(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>ID Bitrix</Label>
            <Input
              placeholder="ID externo do Bitrix"
              value={bitrixId}
              onChange={e => setBitrixId(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
