-- Create table for multiple price tiers per product
CREATE TABLE public.billing_product_prices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.billing_products(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL,
    label TEXT NOT NULL, -- e.g., "À vista", "Parcelado 3x"
    allowed_payment_types payment_type[] NOT NULL DEFAULT '{}', -- which payment types are allowed for this price
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_product_prices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active product prices" 
ON public.billing_product_prices 
FOR SELECT 
USING ((is_active = true) OR is_staff(auth.uid()));

CREATE POLICY "Staff can manage product prices" 
ON public.billing_product_prices 
FOR ALL 
USING (is_staff(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_billing_product_prices_product_id ON public.billing_product_prices(product_id);