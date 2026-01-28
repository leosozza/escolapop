import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, 
  Search, 
  DollarSign, 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  FileText,
  Filter,
  Download,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AddChargeDialog } from '@/components/billing/AddChargeDialog';
import { AddProductDialog } from '@/components/billing/AddProductDialog';
import { ChargeDetailsSheet } from '@/components/billing/ChargeDetailsSheet';

type PaymentType = 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | 'transferencia';
type ChargeStatus = 'pendente' | 'pago' | 'cancelado' | 'vencido' | 'parcial';

interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

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
  product?: BillingProduct | null;
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

export default function Billing() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChargeStatus | 'all'>('all');
  const [addChargeOpen, setAddChargeOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [chargesRes, productsRes] = await Promise.all([
        supabase
          .from('charges')
          .select('*, product:billing_products(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('billing_products')
          .select('*')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (chargesRes.error) throw chargesRes.error;
      if (productsRes.error) throw productsRes.error;

      setCharges(chargesRes.data as Charge[]);
      setProducts(productsRes.data as BillingProduct[]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredCharges = charges.filter((charge) => {
    const matchesSearch = 
      charge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      charge.payer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || charge.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: charges.length,
    pendente: charges.filter(c => c.status === 'pendente').length,
    pago: charges.filter(c => c.status === 'pago').length,
    vencido: charges.filter(c => c.status === 'vencido').length,
    totalValue: charges.reduce((sum, c) => sum + Number(c.amount), 0),
    paidValue: charges
      .filter(c => c.status === 'pago')
      .reduce((sum, c) => sum + Number(c.paid_amount || c.amount), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Cobrança</h1>
          <p className="text-muted-foreground">
            Gerencie produtos, serviços e cobranças da escola
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddProductOpen(true)}>
            <Package className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
          <Button onClick={() => setAddChargeOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Cobrança
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{stats.pendente}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagos</p>
                <p className="text-2xl font-bold">{stats.pago}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recebido</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(stats.paidValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charges" className="space-y-4">
        <TabsList>
          <TabsTrigger value="charges">Cobranças</TabsTrigger>
          <TabsTrigger value="products">Produtos/Serviços</TabsTrigger>
        </TabsList>

        <TabsContent value="charges" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou pagador..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    Todos
                  </Button>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <Button
                      key={key}
                      variant={statusFilter === key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(key as ChargeStatus)}
                    >
                      {config.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charges Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cobrança</TableHead>
                    <TableHead>Pagador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredCharges.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma cobrança encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCharges.map((charge) => {
                      const StatusIcon = STATUS_CONFIG[charge.status].icon;
                      return (
                        <TableRow key={charge.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{charge.name}</p>
                              {charge.product && (
                                <p className="text-xs text-muted-foreground">
                                  {charge.product.name}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{charge.payer_name}</p>
                              {charge.payer_phone && (
                                <p className="text-xs text-muted-foreground">
                                  {charge.payer_phone}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(charge.amount)}
                          </TableCell>
                          <TableCell>
                            {charge.payment_type
                              ? PAYMENT_TYPE_LABELS[charge.payment_type]
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {charge.due_date
                              ? format(new Date(charge.due_date), 'dd/MM/yyyy', { locale: ptBR })
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_CONFIG[charge.status].color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {STATUS_CONFIG[charge.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCharge(charge)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produtos e Serviços
              </CardTitle>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum produto cadastrado</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setAddProductOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Produto
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <Card key={product.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{product.name}</h3>
                            {product.category && (
                              <Badge variant="outline" className="mt-1">
                                {product.category}
                              </Badge>
                            )}
                          </div>
                          <p className="text-lg font-bold text-primary">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(product.default_price)}
                          </p>
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {product.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddChargeDialog
        open={addChargeOpen}
        onOpenChange={setAddChargeOpen}
        products={products}
        onSuccess={fetchData}
      />

      <AddProductDialog
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
        onSuccess={fetchData}
      />

      <ChargeDetailsSheet
        charge={selectedCharge}
        onClose={() => setSelectedCharge(null)}
        onUpdate={fetchData}
      />
    </div>
  );
}
