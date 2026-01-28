-- Create enum for payment types
CREATE TYPE public.payment_type AS ENUM (
  'pix',
  'cartao_credito',
  'cartao_debito',
  'boleto',
  'dinheiro',
  'transferencia'
);

-- Create enum for charge status
CREATE TYPE public.charge_status AS ENUM (
  'pendente',
  'pago',
  'cancelado',
  'vencido',
  'parcial'
);

-- Create products/services table
CREATE TABLE public.billing_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create charges table
CREATE TABLE public.charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.billing_products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  payment_type public.payment_type,
  payer_name TEXT NOT NULL,
  payer_phone TEXT,
  payer_email TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  status public.charge_status DEFAULT 'pendente',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(10,2),
  attachment_url TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

-- RLS policies for billing_products
CREATE POLICY "Anyone can view active products"
ON public.billing_products FOR SELECT
USING (is_active = true OR is_staff(auth.uid()));

CREATE POLICY "Staff can manage products"
ON public.billing_products FOR ALL
USING (is_staff(auth.uid()));

-- RLS policies for charges
CREATE POLICY "Staff can view charges"
ON public.charges FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can manage charges"
ON public.charges FOR ALL
USING (is_staff(auth.uid()));

-- Create indexes
CREATE INDEX idx_charges_status ON public.charges(status);
CREATE INDEX idx_charges_due_date ON public.charges(due_date);
CREATE INDEX idx_charges_payer_name ON public.charges(payer_name);
CREATE INDEX idx_charges_created_at ON public.charges(created_at DESC);

-- Add triggers for updated_at
CREATE TRIGGER update_billing_products_updated_at
BEFORE UPDATE ON public.billing_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_charges_updated_at
BEFORE UPDATE ON public.charges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();