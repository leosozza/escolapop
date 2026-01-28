import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  FileText,
  User,
  Phone,
  Mail,
  Calendar,
  Paperclip,
  Loader2,
} from 'lucide-react';

type PaymentType = 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | 'transferencia';
type ChargeStatus = 'pendente' | 'pago' | 'cancelado' | 'vencido' | 'parcial';

interface Charge {
  id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  amount: number;
  payment_type: PaymentType | null;
  payer_name: string;
  payer_phone: string | null;
  payer_email: string | null;
  lead_id: string | null;
  status: ChargeStatus;
  due_date: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  attachment_url: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
}

interface ChargeDetailsSheetProps {
  charge: Charge | null;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<ChargeStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  pago: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800', icon: XCircle },
  vencido: { label: 'Vencido', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  parcial: { label: 'Parcial', color: 'bg-blue-100 text-blue-800', icon: DollarSign },
};

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
};

export function ChargeDetailsSheet({
  charge,
  onClose,
  onUpdate,
}: ChargeDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<ChargeStatus | ''>('');
  const [paidAmount, setPaidAmount] = useState('');
  const { toast } = useToast();

  if (!charge) return null;

  const StatusIcon = STATUS_CONFIG[charge.status].icon;

  const handleStatusUpdate = async () => {
    if (!newStatus) return;

    setLoading(true);
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'pago' || newStatus === 'parcial') {
        updateData.paid_at = new Date().toISOString();
        updateData.paid_amount = paidAmount ? parseFloat(paidAmount) : charge.amount;
      }

      const { error } = await supabase
        .from('charges')
        .update(updateData)
        .eq('id', charge.id);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: 'O status da cobrança foi atualizado',
      });

      onUpdate();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={!!charge} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes da Cobrança
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge className={`${STATUS_CONFIG[charge.status].color} text-sm px-3 py-1`}>
              <StatusIcon className="h-4 w-4 mr-1" />
              {STATUS_CONFIG[charge.status].label}
            </Badge>
            <span className="text-2xl font-bold text-primary">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(charge.amount)}
            </span>
          </div>

          <Separator />

          {/* Charge Info */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{charge.name}</h3>
              {charge.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {charge.description}
                </p>
              )}
            </div>

            {/* Payer Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{charge.payer_name}</span>
              </div>
              {charge.payer_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{charge.payer_phone}</span>
                </div>
              )}
              {charge.payer_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{charge.payer_email}</span>
                </div>
              )}
            </div>

            {/* Payment Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Tipo de Pagamento</p>
                <p className="font-medium">
                  {charge.payment_type
                    ? PAYMENT_TYPE_LABELS[charge.payment_type]
                    : 'Não definido'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Vencimento</p>
                <p className="font-medium">
                  {charge.due_date
                    ? format(new Date(charge.due_date), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Não definido'}
                </p>
              </div>
            </div>

            {charge.paid_at && (
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm text-green-800">
                  <CheckCircle className="h-4 w-4 inline mr-1" />
                  Pago em {format(new Date(charge.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                {charge.paid_amount && (
                  <p className="text-sm text-green-800 mt-1">
                    Valor pago: {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(charge.paid_amount)}
                  </p>
                )}
              </div>
            )}

            {charge.notes && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium mb-1">Observações</p>
                <p className="text-sm text-muted-foreground">{charge.notes}</p>
              </div>
            )}

            {charge.attachment_url && (
              <div>
                <a
                  href={charge.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Paperclip className="h-4 w-4" />
                  Ver anexo
                </a>
              </div>
            )}
          </div>

          <Separator />

          {/* Update Status */}
          {charge.status !== 'pago' && charge.status !== 'cancelado' && (
            <div className="space-y-4">
              <h4 className="font-medium">Atualizar Status</h4>
              
              <div className="space-y-2">
                <Label>Novo Status</Label>
                <Select
                  value={newStatus}
                  onValueChange={(v) => setNewStatus(v as ChargeStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="parcial">Pagamento Parcial</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(newStatus === 'pago' || newStatus === 'parcial') && (
                <div className="space-y-2">
                  <Label htmlFor="paidAmount">Valor Pago (R$)</Label>
                  <Input
                    id="paidAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder={charge.amount.toString()}
                  />
                </div>
              )}

              <Button
                onClick={handleStatusUpdate}
                disabled={!newStatus || loading}
                className="w-full"
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Atualizar Status
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Criado em {format(new Date(charge.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
