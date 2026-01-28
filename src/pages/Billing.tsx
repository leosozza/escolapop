import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Package, 
  Plus, 
  DollarSign, 
  CheckCircle,
  Search,
  Settings
} from 'lucide-react';
import { AddProductDialog } from '@/components/billing/AddProductDialog';
import { EditProductDialog } from '@/components/billing/EditProductDialog';
import { ProductCard } from '@/components/billing/ProductCard';
import { ProductSalesSheet } from '@/components/billing/ProductSalesSheet';

interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  category: string | null;
  is_active: boolean;
}

interface ChargeStats {
  product_id: string;
  count: number;
  total_received: number;
}

export default function Billing() {
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [chargeStats, setChargeStats] = useState<Record<string, ChargeStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editProductOpen, setEditProductOpen] = useState(false);
  const [salesSheetOpen, setSalesSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BillingProduct | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('billing_products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch charge statistics per product
      const { data: chargesData, error: chargesError } = await supabase
        .from('charges')
        .select('product_id, amount, status, paid_amount');

      if (chargesError) throw chargesError;

      // Calculate stats per product
      const stats: Record<string, ChargeStats> = {};
      (chargesData || []).forEach(charge => {
        if (charge.product_id) {
          if (!stats[charge.product_id]) {
            stats[charge.product_id] = { product_id: charge.product_id, count: 0, total_received: 0 };
          }
          stats[charge.product_id].count++;
          if (charge.status === 'pago' || charge.status === 'parcial') {
            stats[charge.product_id].total_received += charge.paid_amount || charge.amount || 0;
          }
        }
      });
      setChargeStats(stats);

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

  const handleProductClick = (product: BillingProduct) => {
    setSelectedProduct(product);
    setSalesSheetOpen(true);
  };

  const handleEditProduct = (product: BillingProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setEditProductOpen(true);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate totals
  const totalProducts = products.length;
  const totalSales = Object.values(chargeStats).reduce((sum, s) => sum + s.count, 0);
  const totalReceived = Object.values(chargeStats).reduce((sum, s) => sum + s.total_received, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cobrança</h1>
          <p className="text-muted-foreground">Gerencie produtos e vendas</p>
        </div>
        <Button onClick={() => setAddProductOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground">registradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {totalReceived.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">em vendas pagas</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando produtos...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
          </p>
          {!searchTerm && (
            <Button variant="outline" className="mt-4" onClick={() => setAddProductOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Produto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="relative group">
              <ProductCard
                product={product}
                chargesCount={chargeStats[product.id]?.count || 0}
                totalReceived={chargeStats[product.id]?.total_received || 0}
                onClick={() => handleProductClick(product)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleEditProduct(product, e)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddProductDialog
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
        onSuccess={fetchData}
      />

      <EditProductDialog
        open={editProductOpen}
        onOpenChange={setEditProductOpen}
        product={selectedProduct}
        onSuccess={fetchData}
      />

      <ProductSalesSheet
        open={salesSheetOpen}
        onOpenChange={setSalesSheetOpen}
        product={selectedProduct}
        onSuccess={fetchData}
      />
    </div>
  );
}
