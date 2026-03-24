import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DuplicateLead {
  id: string;
  full_name: string;
  phone: string;
  status: string;
}

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
  const [duplicateLead, setDuplicateLead] = useState<DuplicateLead | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  // Check for duplicate when dialog opens
  useEffect(() => {
    if (open && phone) {
      checkDuplicate();
    }
  }, [open, phone]);

  const checkDuplicate = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 8) return;

    const suffix = clean.slice(-8);
    const { data } = await supabase
      .from('leads')
      .select('id, full_name, phone, status')
      .or(`phone.eq.${clean},phone.like.%${suffix}`)
      .limit(1);

    if (data && data.length > 0) {
      setDuplicateLead(data[0] as DuplicateLead);
      setDuplicateConfirmed(false);
    } else {
      setDuplicateLead(null);
    }
  };

  const handleUseExisting = async () => {
    if (!duplicateLead) return;
    setIsLoading(true);
    try {
      // Link existing messages to this lead
      const cleanPhone = phone.replace(/\D/g, '');
      await supabase
        .from('whatsapp_messages')
        .update({ lead_id: duplicateLead.id })
        .eq('phone', cleanPhone);

      toast.success(`Mensagens vinculadas ao lead "${duplicateLead.full_name}"`);
      resetForm();
      onOpenChange(false);
      onSuccess(duplicateLead.id);
    } catch (err) {
      console.error('Error linking messages:', err);
      toast.error('Erro ao vincular mensagens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast.error('O nome do modelo é obrigatório.');
      return;
    }

    if (duplicateLead && !duplicateConfirmed) return;

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
    setDuplicateLead(null);
    setDuplicateConfirmed(false);
  };

  const statusLabels: Record<string, string> = {
    lead: 'Lead', agendado: 'Agendado', compareceu: 'Compareceu',
    proposta: 'Proposta', matriculado: 'Matriculado', perdido: 'Perdido',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar como Lead</DialogTitle>
          <DialogDescription>Telefone: {phone}</DialogDescription>
        </DialogHeader>

        {/* Duplicate warning */}
        {duplicateLead && !duplicateConfirmed && (
          <Alert variant="destructive" className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">Contato já cadastrado!</AlertTitle>
            <AlertDescription className="space-y-2">
              <div className="bg-muted p-2 rounded-md mt-1">
                <p className="font-medium text-sm">{duplicateLead.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  Tel: {duplicateLead.phone} • Status: {statusLabels[duplicateLead.status] || duplicateLead.status}
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={handleUseExisting} disabled={isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Vincular ao existente
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDuplicateConfirmed(true)}>
                  Criar novo mesmo assim
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Modelo <span className="text-destructive">*</span></Label>
            <Input placeholder="Nome completo do modelo" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Nome do Responsável</Label>
            <Input placeholder="Nome da mãe/responsável" value={guardianName} onChange={e => setGuardianName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nº Contrato MaxSystem</Label>
              <Input placeholder="Ex: 12345" value={maxsystemContract} onChange={e => setMaxsystemContract(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ID Ficha MaxSystem</Label>
              <Input placeholder="Ex: 67890" value={maxsystemRecordId} onChange={e => setMaxsystemRecordId(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>ID Bitrix</Label>
            <Input placeholder="ID externo do Bitrix" value={bitrixId} onChange={e => setBitrixId(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading || (!!duplicateLead && !duplicateConfirmed)}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
