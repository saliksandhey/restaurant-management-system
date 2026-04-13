-- Migration: 002_enable_realtime.sql
-- Enable Supabase Realtime for orders and payments tables

-- Add tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- Optional: Enable realtime on specific columns to reduce payload
-- This is handled automatically by Supabase, but you can configure it in the dashboard
