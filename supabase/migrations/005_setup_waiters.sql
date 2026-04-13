-- Migration: 005_setup_waiters.sql
-- Create waiters table and update missing update policies for interactions

CREATE TABLE IF NOT EXISTS waiters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    pass_code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE waiters ENABLE ROW LEVEL SECURITY;

-- Allow public access for now since there's no auth in the system yet
CREATE POLICY "Allow public read access to waiters"
    ON waiters FOR SELECT USING (true);

CREATE POLICY "Allow public insert to waiters"
    ON waiters FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to waiters"
    ON waiters FOR UPDATE USING (true);

CREATE POLICY "Allow public delete to waiters"
    ON waiters FOR DELETE USING (true);

-- Adding UPDATE policies for orders and order_items which were missing in 003
CREATE POLICY "Allow public update to orders"
    ON orders FOR UPDATE USING (true);

CREATE POLICY "Allow public update to order_items"
    ON order_items FOR UPDATE USING (true);

CREATE POLICY "Allow public delete to order_items"
    ON order_items FOR DELETE USING (true);
