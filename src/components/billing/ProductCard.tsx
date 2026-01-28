import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

interface ProductPrice {
  id: string;
  price: number;
  label: string;
  allowed_payment_types: string[];
}

interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  category: string | null;
  prices?: ProductPrice[];
}

interface ProductCardProps {
  product: BillingProduct;
  chargesCount: number;
  totalReceived: number;
  onClick: () => void;
}

export function ProductCard({ product, chargesCount, totalReceived, onClick }: ProductCardProps) {
  const minPrice = product.prices && product.prices.length > 0
    ? Math.min(...product.prices.map(p => p.price))
    : product.default_price;
  
  const maxPrice = product.prices && product.prices.length > 0
    ? Math.max(...product.prices.map(p => p.price))
    : product.default_price;

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-primary/50"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{product.name}</h3>
            {product.category && (
              <Badge variant="secondary" className="mt-1 text-xs">
                {product.category}
              </Badge>
            )}
          </div>
        </div>

        {product.description && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="mt-4 pt-3 border-t space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Preço</span>
            <span className="font-medium">
              {minPrice === maxPrice 
                ? `R$ ${minPrice.toFixed(2)}`
                : `R$ ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`
              }
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Vendas</span>
            <Badge variant="outline">{chargesCount}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Recebido</span>
            <span className="font-semibold text-primary">
              R$ {totalReceived.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
