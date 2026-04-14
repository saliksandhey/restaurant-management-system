-- Migration 009: Add kitchen_status to order_items for per-batch kitchen tracking
-- This allows the kitchen to track individual item batches independently of the order status.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS kitchen_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (kitchen_status IN ('pending', 'preparing', 'ready'));

-- Also add created_at if not present (was added in migration 008 but just in case)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Index for fast kitchen queries
CREATE INDEX IF NOT EXISTS idx_order_items_kitchen_status
  ON order_items (kitchen_status);

-- Also add table_id column to tables if not already there (status col added in 007)
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'free'
    CHECK (status IN ('free', 'occupied'));

-- Enable realtime on order_items so kitchen gets live updates (safe to run multiple times)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
