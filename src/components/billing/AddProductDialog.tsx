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

interface PriceOption {
  price: string;
  label: string;
  allowed_payment_types: PaymentType[];
}

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddProductDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [prices, setPrices] = useState<PriceOption[]>([
    { price: '', label: 'À vista', allowed_payment_types: ['pix', 'dinheiro', 'cartao_debito'] }
  ]);
  
  const { toast } = useToast();

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('');
    setPrices([{ price: '', label: 'À vista', allowed_payment_types: ['pix', 'dinheiro', 'cartao_debito'] }]);
  };

  const addPriceOption = () => {
    setPrices([...prices, { price: '', label: '', allowed_payment_types: [] }]);
  };

  const removePriceOption = (index: number) => {
    setPrices(prices.filter((_, i) => i !== index));
  };

  const updatePriceOption = (index: number, field: keyof PriceOption, value: any) => {
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
    
    if (!name.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Preencha o nome do produto',
        variant: 'destructive',
      });
      return;
    }

    // Validate at least one price with payment types
    const validPrices = prices.filter(p => p.price && p.label.trim() && p.allowed_payment_types.length > 0);
    if (validPrices.length === 0) {
      toast({
        title: 'Opção de preço obrigatória',
        description: 'Adicione pelo menos uma opção de preço com formas de pagamento',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Create product
      const { data: product, error: productError } = await supabase
        .from('billing_products')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          default_price: parseFloat(validPrices[0].price),
          category: category.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Create price options
      const priceInserts = validPrices.map(p => ({
        product_id: product.id,
        price: parseFloat(p.price),
        label: p.label.trim(),
        allowed_payment_types: p.allowed_payment_types,
      }));

      const { error: pricesError } = await supabase
        .from('billing_product_prices')
        .insert(priceInserts);

      if (pricesError) throw pricesError;

      toast({
        title: 'Produto criado',
        description: 'O produto foi cadastrado com sucesso',
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar produto',
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
          <DialogTitle>Novo Produto</DialogTitle>
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
              <Label>Opções de Preço *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPriceOption}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Preço
              </Button>
            </div>

            {prices.map((price, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Opção {index + 1}</span>
                  {prices.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePriceOption(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome da Opção *</Label>
                    <Input
                      value={price.label}
                      onChange={(e) => updatePriceOption(index, 'label', e.target.value)}
                      placeholder="Ex: À vista, Parcelado 3x"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price.price}
                      onChange={(e) => updatePriceOption(index, 'price', e.target.value)}
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
                          onCheckedChange={() => togglePaymentType(index, type.value)}
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
            ))}
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
              Criar Produto
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
