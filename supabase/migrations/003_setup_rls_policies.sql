-- Migration: 003_setup_rls_policies.sql
-- Row Level Security policies for secure access control

-- Enable RLS on all tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Tables: Public read access (needed for QR validation)
CREATE POLICY "Allow public read access to tables"
    ON tables FOR SELECT
    USING (true);

-- Menu Items: Public read access (customers need to view menu)
CREATE POLICY "Allow public read access to menu_items"
    ON menu_items FOR SELECT
    USING (true);

-- Orders: Public insert (customers can place orders)
CREATE POLICY "Allow public insert to orders"
    ON orders FOR INSERT
    WITH CHECK (true);

-- Orders: Public read (customers can view their orders)
CREATE POLICY "Allow public read access to orders"
    ON orders FOR SELECT
    USING (true);

-- Order Items: Public insert (created with orders)
CREATE POLICY "Allow public insert to order_items"
    ON order_items FOR INSERT
    WITH CHECK (true);

-- Order Items: Public read
CREATE POLICY "Allow public read access to order_items"
    ON order_items FOR SELECT
    USING (true);

-- Payments: Restricted access (will be updated with auth later)
-- For now, allow read access for admin panels
CREATE POLICY "Allow public read access to payments"
    ON payments FOR SELECT
    USING (true);

-- Payments: Insert access (will be restricted with auth later)
CREATE POLICY "Allow public insert to payments"
    ON payments FOR INSERT
    WITH CHECK (true);

-- Note: When authentication is added, update these policies to:
-- - Restrict order creation to authenticated users
-- - Restrict payment management to admin role
-- - Restrict order status updates to kitchen/admin roles
