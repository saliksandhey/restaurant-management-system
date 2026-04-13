-- Migration: 004_seed_sample_data.sql
-- Sample data for testing the restaurant ordering system

-- Insert sample tables (5 tables with QR codes)
INSERT INTO tables (table_number, qr_code) VALUES
(1, 'TABLE-001'),
(2, 'TABLE-002'),
(3, 'TABLE-003'),
(4, 'TABLE-004'),
(5, 'TABLE-005')
ON CONFLICT (table_number) DO NOTHING;

-- Insert sample menu items
INSERT INTO menu_items (name, price, category, image_url, is_available) VALUES
-- Starters
('Bruschetta', 8.99, 'Starters', 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400', true),
('Garlic Bread', 5.99, 'Starters', 'https://images.unsplash.com/photo-1573140401552-388e7e2f00b8?w=400', true),
('Caesar Salad', 9.99, 'Starters', 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400', true),
('Chicken Wings', 10.99, 'Starters', 'https://images.unsplash.com/photo-1608039829572-9b0e4538bca1?w=400', true),

-- Mains
('Margherita Pizza', 14.99, 'Mains', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400', true),
('Pasta Carbonara', 13.99, 'Mains', 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400', true),
('Grilled Salmon', 18.99, 'Mains', 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400', true),
('Chicken Burger', 12.99, 'Mains', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400', true),
('Beef Steak', 22.99, 'Mains', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400', true),
('Vegetable Curry', 11.99, 'Mains', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400', true),

-- Desserts
('Chocolate Lava Cake', 7.99, 'Desserts', 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400', true),
('Tiramisu', 8.99, 'Desserts', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400', true),
('Cheesecake', 7.99, 'Desserts', 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400', true),

-- Beverages
('Fresh Orange Juice', 4.99, 'Beverages', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400', true),
('Iced Coffee', 5.99, 'Beverages', 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400', true),
('Lemonade', 3.99, 'Beverages', 'https://images.unsplash.com/photo-1523371054106-bbf80586c38c?w=400', true),
('Sparkling Water', 2.99, 'Beverages', 'https://images.unsplash.com/photo-1560023907-5f339617ea30?w=400', true)
ON CONFLICT DO NOTHING;
