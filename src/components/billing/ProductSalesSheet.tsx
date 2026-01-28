import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type PaymentType = 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | 'transferencia';
type ChargeStatus = 'pendente' | 'pago' | 'cancelado' | 'vencido' | 'parcial';

const PAYMENT_LABELS: Record<PaymentType, string> = {
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
};

const STATUS_CONFIG: Record<ChargeStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  pago: { label: 'Pago', variant: 'default' },
  parcial: { label: 'Parcial', variant: 'outline' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
  vencido: { label: 'Vencido', variant: 'destructive' },
};

interface ProductPrice {
  id: string;
  price: number;
  label: string;
  allowed_payment_types: PaymentType[];
}

interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  category: string | null;
}

interface Charge {
  id: string;
  name: string;
  amount: number;
  payer_name: string;
  payer_phone: string | null;
  payer_email: string | null;
  payment_type: PaymentType | null;
  status: ChargeStatus;
  created_at: string;
  paid_at: string | null;
  paid_amount: number | null;
}

interface ProductSalesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: BillingProduct | null;
  onSuccess: () => void;
}

export function ProductSalesSheet({ open, onOpenChange, product, onSuccess }: ProductSalesSheetProps) {
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [selectedPriceId, setSelectedPriceId] = useState<string>('');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType | ''>('');
  
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && product) {
      fetchPrices();
      fetchCharges();
    }
  }, [open, product]);

  const fetchPrices = async () => {
    if (!product) return;
    
    const { data, error } = await supabase
      .from('billing_product_prices')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (!error && data) {
      setPrices(data as ProductPrice[]);
      if (data.length > 0) {
        setSelectedPriceId(data[0].id);
      }
    }
  };

  const fetchCharges = async () => {
    if (!product) return;
    
    const { data, error } = await supabase
      .from('charges')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCharges(data as Charge[]);
    }
  };

  const selectedPrice = prices.find(p => p.id === selectedPriceId);
  const allowedPaymentTypes = selectedPrice?.allowed_payment_types || [];

  const resetSaleForm = () => {
    setPayerName('');
    setPayerPhone('');
    setPayerEmail('');
    setPaymentType('');
  };

  const handleCreateSale = async () => {
    if (!product || !selectedPrice || !payerName.trim() || !paymentType) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha nome do pagador e tipo de pagamento',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('charges').insert({
        product_id: product.id,
        name: product.name,
        amount: selectedPrice.price,
        payment_type: paymentType,
        payer_name: payerName.trim(),
        payer_phone: payerPhone.trim() || null,
        payer_email: payerEmail.trim() || null,
        created_by: user?.id || null,
        status: 'pago',
        paid_at: new Date().toISOString(),
        paid_amount: selectedPrice.price,
      });

      if (error) throw error;

      toast({
        title: 'Venda registrada',
        description: `Pagamento de R$ ${selectedPrice.price.toFixed(2)} registrado com sucesso`,
      });

      resetSaleForm();
      fetchCharges();
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar venda',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (charge: Charge) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('charges')
        .update({ status: 'cancelado' })
        .eq('id', charge.id);

      if (error) throw error;

      toast({
        title: 'Estorno realizado',
        description: 'O pagamento foi estornado com sucesso',
      });

      fetchCharges();
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao estornar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {product.name}
            {product.category && (
              <Badge variant="secondary">{product.category}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="sale" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sale">Nova Venda</TabsTrigger>
            <TabsTrigger value="history">Histórico ({charges.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sale" className="space-y-4 mt-4">
            {prices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Este produto não possui opções de preço cadastradas.</p>
                <p className="text-sm mt-2">Edite o produto para adicionar preços.</p>
              </div>
            ) : (
              <>
                {/* Price Selection */}
                <div className="space-y-2">
                  <Label>Opção de Preço *</Label>
                  <Select value={selectedPriceId} onValueChange={setSelectedPriceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o preço" />
                    </SelectTrigger>
                    <SelectContent>
                      {prices.map((price) => (
                        <SelectItem key={price.id} value={price.id}>
                          {price.label} - R$ {price.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Type */}
                <div className="space-y-2">
                  <Label>Tipo de Pagamento *</Label>
                  <Select 
                    value={paymentType} 
                    onValueChange={(v) => setPaymentType(v as PaymentType)}
                    disabled={allowedPaymentTypes.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedPaymentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {PAYMENT_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {allowedPaymentTypes.length === 0 && selectedPrice && (
                    <p className="text-xs text-muted-foreground">
                      Nenhum tipo de pagamento configurado para este preço
                    </p>
                  )}
                </div>

                {/* Payer Info */}
                <div className="space-y-2">
                  <Label htmlFor="payerName">Nome do Pagador *</Label>
                  <Input
                    id="payerName"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Nome completo"
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

                <Button 
                  onClick={handleCreateSale} 
                  disabled={loading || !selectedPrice || allowedPaymentTypes.length === 0}
                  className="w-full"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Venda - R$ {selectedPrice?.price.toFixed(2) || '0.00'}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {charges.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma venda registrada para este produto.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pagador</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {charges.map((charge) => (
                      <TableRow key={charge.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{charge.payer_name}</p>
                            {charge.payer_phone && (
                              <p className="text-xs text-muted-foreground">{charge.payer_phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>R$ {charge.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {charge.payment_type ? PAYMENT_LABELS[charge.payment_type] : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_CONFIG[charge.status]?.variant || 'secondary'}>
                            {STATUS_CONFIG[charge.status]?.label || charge.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(charge.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {charge.status === 'pago' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRefund(charge)}
                              disabled={loading}
                              title="Estornar"
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
