-- Migration: 006_add_ready_at_to_orders.sql
-- Add the 'ready_at' column to the orders table. 
-- This column is required for the Kitchen Panel to track the 5-minute auto-complete timer.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE;
