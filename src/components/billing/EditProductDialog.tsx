import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type PaymentType = 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'dinheiro' | 'transferencia';

const ALL_PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
];

interface ProductPrice {
  id?: string;
  price: string;
  label: string;
  allowed_payment_types: PaymentType[];
  isNew?: boolean;
  toDelete?: boolean;
}

interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  category: string | null;
}

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: BillingProduct | null;
  onSuccess: () => void;
}

export function EditProductDialog({ open, onOpenChange, product, onSuccess }: EditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    if (open && product) {
      setName(product.name);
      setDescription(product.description || '');
      setCategory(product.category || '');
      fetchPrices();
    }
  }, [open, product]);

  const fetchPrices = async () => {
    if (!product) return;
    
    const { data, error } = await supabase
      .from('billing_product_prices')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true);

    if (!error && data) {
      setPrices(data.map(p => ({
        id: p.id,
        price: p.price.toString(),
        label: p.label,
        allowed_payment_types: p.allowed_payment_types as PaymentType[],
      })));
    }
  };

  const addPriceOption = () => {
    setPrices([...prices, {
      price: '',
      label: '',
      allowed_payment_types: [],
      isNew: true,
    }]);
  };

  const removePriceOption = (index: number) => {
    const price = prices[index];
    if (price.id) {
      // Mark existing for deletion
      setPrices(prices.map((p, i) => i === index ? { ...p, toDelete: true } : p));
    } else {
      // Remove new ones directly
      setPrices(prices.filter((_, i) => i !== index));
    }
  };

  const updatePriceOption = (index: number, field: keyof ProductPrice, value: any) => {
    setPrices(prices.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const togglePaymentType = (index: number, type: PaymentType) => {
    const price = prices[index];
    const types = price.allowed_payment_types.includes(type)
      ? price.allowed_payment_types.filter(t => t !== type)
      : [...price.allowed_payment_types, type];
    updatePriceOption(index, 'allowed_payment_types', types);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product || !name.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Preencha o nome do produto',
        variant: 'destructive',
      });
      return;
    }

    const validPrices = prices.filter(p => !p.toDelete);
    for (const price of validPrices) {
      if (!price.price || !price.label.trim() || price.allowed_payment_types.length === 0) {
        toast({
          title: 'Dados incompletos',
          description: 'Preencha todos os campos das opções de preço',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    try {
      // Update product
      const { error: productError } = await supabase
        .from('billing_products')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          default_price: validPrices.length > 0 ? parseFloat(validPrices[0].price) : product.default_price,
        })
        .eq('id', product.id);

      if (productError) throw productError;

      // Delete removed prices
      const toDelete = prices.filter(p => p.toDelete && p.id);
      for (const price of toDelete) {
        await supabase
          .from('billing_product_prices')
          .update({ is_active: false })
          .eq('id', price.id);
      }

      // Update existing prices
      const toUpdate = prices.filter(p => !p.toDelete && !p.isNew && p.id);
      for (const price of toUpdate) {
        await supabase
          .from('billing_product_prices')
          .update({
            price: parseFloat(price.price),
            label: price.label.trim(),
            allowed_payment_types: price.allowed_payment_types,
          })
          .eq('id', price.id);
      }

      // Insert new prices
      const toInsert = prices.filter(p => p.isNew && !p.toDelete);
      if (toInsert.length > 0) {
        await supabase
          .from('billing_product_prices')
          .insert(toInsert.map(p => ({
            product_id: product.id,
            price: parseFloat(p.price),
            label: p.label.trim(),
            allowed_payment_types: p.allowed_payment_types,
          })));
      }

      toast({
        title: 'Produto atualizado',
        description: 'As alterações foram salvas com sucesso',
      });

      onOpenChange(false);
      onSuccess();
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

  if (!product) return null;

  const visiblePrices = prices.filter(p => !p.toDelete);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productName">Nome do Produto *</Label>
            <Input
              id="productName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Catwalk Brasil"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Eventos, Cursos"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productDescription">Descrição</Label>
            <Textarea
              id="productDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do produto..."
              rows={2}
            />
          </div>

          {/* Price Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Opções de Preço</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPriceOption}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Preço
              </Button>
            </div>

            {visiblePrices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma opção de preço cadastrada. Adicione pelo menos uma.
              </p>
            ) : (
              <div className="space-y-4">
                {visiblePrices.map((price, index) => {
                  const actualIndex = prices.findIndex(p => p === price);
                  return (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Opção {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePriceOption(actualIndex)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome da Opção *</Label>
                          <Input
                            value={price.label}
                            onChange={(e) => updatePriceOption(actualIndex, 'label', e.target.value)}
                            placeholder="Ex: À vista"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Valor (R$) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={price.price}
                            onChange={(e) => updatePriceOption(actualIndex, 'price', e.target.value)}
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Formas de Pagamento Aceitas *</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {ALL_PAYMENT_TYPES.map((type) => (
                            <div key={type.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${index}-${type.value}`}
                                checked={price.allowed_payment_types.includes(type.value)}
                                onCheckedChange={() => togglePaymentType(actualIndex, type.value)}
                              />
                              <label
                                htmlFor={`${index}-${type.value}`}
                                className="text-sm cursor-pointer"
                              >
                                {type.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
