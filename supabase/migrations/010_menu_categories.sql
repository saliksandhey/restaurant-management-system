CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert existing categories from menu_items so we don't start empty
INSERT INTO menu_categories (name)
SELECT DISTINCT category FROM menu_items
ON CONFLICT (name) DO NOTHING;
