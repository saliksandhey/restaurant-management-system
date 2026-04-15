-- Create the settings table
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    id smallint PRIMARY KEY DEFAULT 1,
    restaurant_name text DEFAULT 'My Restaurant',
    logo_url text,
    address text,
    phone text,
    gst_number text,
    gst_percentage numeric DEFAULT 0,
    service_charge_enabled boolean DEFAULT false,
    currency text DEFAULT 'INR',
    auto_complete_time integer DEFAULT 5,
    enable_waiter_item_addition boolean DEFAULT true,
    allow_multiple_orders boolean DEFAULT true,
    kitchen_sound_enabled boolean DEFAULT true,
    new_order_alert_enabled boolean DEFAULT true,
    admin_pin text,
    updated_at timestamp with time zone DEFAULT now()
);

-- Ensure only one row exists
ALTER TABLE public.restaurant_settings ADD CONSTRAINT enforce_single_row CHECK (id = 1);

-- Insert default row if it doesn't exist
INSERT INTO public.restaurant_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to anyone (so frontend can fetch settings)
CREATE POLICY "Anyone can view settings" 
    ON public.restaurant_settings 
    FOR SELECT 
    USING (true);

-- Allow updates (in a real app this should be restricted, but for this demo allow it)
CREATE POLICY "Allow public updates for demo" 
    ON public.restaurant_settings 
    FOR UPDATE
    USING (true);
