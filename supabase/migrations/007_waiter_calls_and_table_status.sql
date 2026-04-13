-- Migration: 007_waiter_calls_and_table_status.sql

-- 1. Create waiter_calls table
CREATE TABLE IF NOT EXISTS waiter_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to waiter_calls" ON waiter_calls FOR SELECT USING (true);
CREATE POLICY "Allow public insert to waiter_calls" ON waiter_calls FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to waiter_calls" ON waiter_calls FOR UPDATE USING (true);

-- 2. Add status to tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free' CHECK (status IN ('free', 'occupied'));

-- Waiters/Admins need to update the table status
CREATE POLICY "Allow public update to tables" ON tables FOR UPDATE USING (true);
