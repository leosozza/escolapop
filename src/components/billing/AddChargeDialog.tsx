import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Upload } from 'lucide-react';

type PaymentType = 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | 'transferencia';

interface BillingProduct {
  id: string;
  name: string;
  default_price: number;
}

interface AddChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: BillingProduct[];
  onSuccess: () => void;
}

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
];

export function AddChargeDialog({
  open,
  onOpenChange,
  products,
  onSuccess,
}: AddChargeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType | ''>('');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const resetForm = () => {
    setProductId('');
    setName('');
    setDescription('');
    setAmount('');
    setPaymentType('');
    setPayerName('');
    setPayerPhone('');
    setPayerEmail('');
    setDueDate('');
    setNotes('');
    setAttachment(null);
  };

  const handleProductChange = (value: string) => {
    setProductId(value);
    if (value && value !== 'custom') {
      const product = products.find(p => p.id === value);
      if (product) {
        setName(product.name);
        setAmount(product.default_price.toString());
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !payerName.trim() || !amount) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha nome, pagador e valor',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      let attachmentUrl = null;

      // Upload attachment if exists
      if (attachment) {
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `charges/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(filePath, attachment);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('certificates')
          .getPublicUrl(filePath);

        attachmentUrl = publicUrl;
      }

      const { error } = await supabase.from('charges').insert({
        product_id: productId && productId !== 'custom' ? productId : null,
        name: name.trim(),
        description: description.trim() || null,
        amount: parseFloat(amount),
        payment_type: paymentType || null,
        payer_name: payerName.trim(),
        payer_phone: payerPhone.trim() || null,
        payer_email: payerEmail.trim() || null,
        due_date: dueDate || null,
        notes: notes.trim() || null,
        attachment_url: attachmentUrl,
        created_by: user?.id || null,
        status: 'pendente',
      });

      if (error) throw error;

      toast({
        title: 'Cobrança criada',
        description: 'A cobrança foi registrada com sucesso',
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar cobrança',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cobrança</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Produto/Serviço (opcional)</Label>
            <Select value={productId} onValueChange={handleProductChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione ou crie personalizado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Cobrança Personalizada</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - R$ {product.default_price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name and Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Cobrança *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Aula particular"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          {/* Payer Info */}
          <div className="space-y-2">
            <Label htmlFor="payerName">Nome de Quem Pagou *</Label>
            <Input
              id="payerName"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="Nome completo do pagador"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payerPhone">Telefone</Label>
              <Input
                id="payerPhone"
                value={payerPhone}
                onChange={(e) => setPayerPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payerEmail">E-mail</Label>
              <Input
                id="payerEmail"
                type="email"
                value={payerEmail}
                onChange={(e) => setPayerEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Pagamento</Label>
              <Select 
                value={paymentType} 
                onValueChange={(v) => setPaymentType(v as PaymentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes da cobrança..."
              rows={2}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas..."
              rows={2}
            />
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <Label>Anexo de Cobrança</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input
                type="file"
                id="attachment"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              />
              <label
                htmlFor="attachment"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                {attachment ? (
                  <span className="text-sm text-primary font-medium">
                    {attachment.name}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Clique para anexar comprovante, nota fiscal, etc.
                  </span>
                )}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Cobrança
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
