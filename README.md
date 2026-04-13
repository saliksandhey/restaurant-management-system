# QR-Based Restaurant Ordering System

A complete, production-ready dine-in restaurant ordering system using **Supabase Edge Functions** and **PostgreSQL**. Customers scan QR codes at their tables to access the menu, place orders, and track status in realtime.

## 📌 Features

- ✅ QR code-based table identification
- ✅ Digital menu with categories and availability
- ✅ Order placement with special instructions
- ✅ Kitchen order management with status tracking
- ✅ Admin payment processing
- ✅ Realtime updates for kitchen and admin panels
- ✅ Atomic transactions for order creation
- ✅ Price snapshot integrity
- ✅ Row Level Security (RLS) policies
- ✅ CORS-enabled for frontend integration

## 🏗️ Architecture

```
Customer scans QR → Opens menu → Places order → Kitchen prepares → Admin processes payment
```

### Order Status Flow

```
pending → accepted → preparing → ready → paid
                                  ↓
                              cancelled (any state)
```

## 📁 Project Structure

```
restaurant-management-system/
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_tables.sql          # Database schema
│   │   ├── 002_enable_realtime.sql        # Realtime subscriptions
│   │   ├── 003_setup_rls_policies.sql     # Security policies
│   │   └── 004_seed_sample_data.sql       # Sample data
│   └── config.toml                         # Supabase CLI config
├── functions/
│   ├── _shared/
│   │   ├── supabase.ts                     # Supabase client
│   │   ├── types.ts                        # TypeScript types
│   │   └── utils.ts                        # Helper functions
│   ├── create-order/index.ts               # POST: Create new order
│   ├── get-menu/index.ts                   # GET: Fetch menu items
│   ├── get-orders/index.ts                 # GET: Fetch orders by status
│   ├── update-order-status/index.ts        # PATCH: Update order status
│   ├── mark-as-paid/index.ts               # POST: Process payment
│   └── get-table-by-qr/index.ts            # GET: Validate QR code
├── scripts/
│   ├── generate-qr-codes.ts                # Generate table QR codes
│   └── setup-realtime.ts                   # Realtime subscription examples
├── .env.example                            # Environment variables template
├── package.json                            # NPM scripts
└── README.md                               # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Supabase Account**: Create a project at [supabase.com](https://supabase.com)
2. **Supabase CLI**: Install globally
   ```bash
   npm install -g supabase
   ```
3. **Deno**: Edge Functions run on Deno (automatically handled by Supabase)

### Step 1: Setup Supabase Project

```bash
# Clone or navigate to the project
cd restaurant-management-system

# Initialize Supabase (if not already done)
supabase init

# Link to your Supabase project
supabase link --project-ref your-project-ref
```

Get your project ref from: Supabase Dashboard → Project Settings → API

### Step 2: Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit with your Supabase credentials
# Get these from: Project Settings → API
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 3: Deploy Secrets to Edge Functions

```bash
# Set environment variables for Edge Functions
supabase secrets set SUPABASE_URL=your-url SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Step 4: Run Database Migrations

```bash
# Apply all migrations to create tables
supabase db push

# This creates:
# - tables (restaurant tables with QR codes)
# - menu_items (restaurant menu)
# - orders (customer orders)
# - order_items (order line items)
# - payments (payment records)
```

### Step 5: Seed Sample Data (Optional)

```bash
# Insert sample tables and menu items for testing
supabase db seed
```

Or manually run:
```bash
psql -h your-db.supabase.co -U postgres -d postgres -f supabase/migrations/004_seed_sample_data.sql
```

### Step 6: Deploy Edge Functions

```bash
# Deploy all functions to Supabase
supabase functions deploy

# Or deploy individually
supabase functions deploy create-order
supabase functions deploy get-menu
supabase functions deploy get-orders
supabase functions deploy update-order-status
supabase functions deploy mark-as-paid
supabase functions deploy get-table-by-qr
```

### Step 7: Generate QR Codes

```bash
# Generate QR codes for 10 tables
deno run --allow-env --allow-net scripts/generate-qr-codes.ts 10
```

This creates QR codes in format: `TABLE-001`, `TABLE-002`, etc.

### Step 8: Test Locally (Optional)

```bash
# Start local Supabase stack
supabase start

# Serve functions locally
supabase functions serve

# Functions will be available at:
# http://localhost:54321/functions/v1/{function-name}
```

## 📡 API Endpoints

All endpoints are available at:
```
https://your-project-id.supabase.co/functions/v1/{function-name}
```

### 1. Get Menu

**Endpoint:** `GET /functions/v1/get-menu`

**Query Parameters:**
- `category` (optional): Filter by category (e.g., "Starters", "Mains")
- `available_only` (optional, default: true): Show only available items

**Example:**
```bash
curl https://your-project.supabase.co/functions/v1/get-menu
curl https://your-project.supabase.co/functions/v1/get-menu?category=Mains
curl https://your-project.supabase.co/functions/v1/get-menu?available_only=false
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "groupedByCategory": {
      "Starters": [...],
      "Mains": [...]
    },
    "total": 15
  },
  "message": "Success"
}
```

---

### 2. Validate QR Code

**Endpoint:** `GET /functions/v1/get-table-by-qr?code=TABLE-001`

**Example:**
```bash
curl https://your-project.supabase.co/functions/v1/get-table-by-qr?code=TABLE-001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "table_number": 1,
    "qr_code": "TABLE-001",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "Table found"
}
```

---

### 3. Create Order

**Endpoint:** `POST /functions/v1/create-order`

**Request Body:**
```json
{
  "table_id": "uuid-here",
  "customer_name": "John Doe",
  "phone": "+1234567890",
  "items": [
    { "menu_item_id": "uuid-1", "quantity": 2 },
    { "menu_item_id": "uuid-2", "quantity": 1 }
  ],
  "special_instructions": "No onions, extra spicy"
}
```

**Example:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "table_id": "your-table-uuid",
    "customer_name": "John",
    "items": [
      {"menu_item_id": "item-uuid-1", "quantity": 2},
      {"menu_item_id": "item-uuid-2", "quantity": 1}
    ],
    "special_instructions": "No onions"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "table_id": "table-uuid",
    "customer_name": "John",
    "status": "pending",
    "total_amount": 35.97,
    "order_items": [...],
    "table": { "table_number": 1 }
  },
  "message": "Order created successfully"
}
```

---

### 4. Get Orders by Status

**Endpoint:** `GET /functions/v1/get-orders?status=pending&table_id=uuid`

**Query Parameters:**
- `status` (required): `pending`, `accepted`, `preparing`, `ready`, `paid`, `cancelled`
- `table_id` (optional): Filter by specific table

**Examples:**
```bash
# Kitchen: Get pending orders
curl https://your-project.supabase.co/functions/v1/get-orders?status=pending

# Kitchen: Get preparing orders
curl https://your-project.supabase.co/functions/v1/get-orders?status=preparing

# Admin: Get ready orders for payment
curl https://your-project.supabase.co/functions/v1/get-orders?status=ready

# Customer: Get their table's orders
curl https://your-project.supabase.co/functions/v1/get-orders?status=pending&table_id=uuid
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "total": 5,
    "status": "pending"
  }
}
```

---

### 5. Update Order Status (Kitchen)

**Endpoint:** `PATCH /functions/v1/update-order-status`

**Request Body:**
```json
{
  "order_id": "uuid",
  "status": "preparing"
}
```

**Valid Transitions:**
- `pending` → `accepted`
- `accepted` → `preparing`
- `preparing` → `ready`
- Any → `cancelled`

**Example:**
```bash
curl -X PATCH https://your-project.supabase.co/functions/v1/update-order-status \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order-uuid", "status": "preparing"}'
```

---

### 6. Mark Order as Paid (Admin)

**Endpoint:** `POST /functions/v1/mark-as-paid`

**Request Body:**
```json
{
  "order_id": "uuid",
  "payment_method": "cash"
}
```

**Payment Methods:** `cash`, `upi`, `card`

**Example:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/mark-as-paid \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order-uuid", "payment_method": "upi"}'
```

---

## 🔄 Realtime Subscriptions

Enable realtime updates in your frontend for live order and payment tracking.

### Kitchen Panel - Order Updates

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Listen for all order changes
const channel = supabase
  .channel('kitchen-orders')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'orders' },
    (payload) => {
      console.log('Order updated:', payload)
      // Update kitchen display
    }
  )
  .subscribe()
```

### Admin Panel - Payment Updates

```typescript
// Listen for new payments
const channel = supabase
  .channel('admin-payments')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'payments' },
    (payload) => {
      console.log('New payment:', payload)
      // Update revenue dashboard
    }
  )
  .subscribe()
```

### Customer - Order Status Updates

```typescript
// Listen for specific order updates
const channel = supabase
  .channel(`customer-order-${orderId}`)
  .on(
    'postgres_changes',
    { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'orders',
      filter: `id=eq.${orderId}`
    },
    (payload) => {
      console.log('Your order status:', payload.new.status)
      // Show status to customer
    }
  )
  .subscribe()
```

---

## 🛡️ Security

### Row Level Security (RLS)

All tables have RLS enabled with policies:

- **Public read access**: menu_items, tables
- **Public insert**: orders, order_items (for customer ordering)
- **Payments**: Restricted (will be updated with auth)

### Best Practices

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY`** in frontend code
2. **Use Edge Functions** for business logic (server-side only)
3. **Validate all inputs** in edge functions
4. **CORS headers** configured for browser access
5. **Price snapshots** stored in order_items (prevents menu price changes from affecting orders)

---

## 🧪 Testing

### Test Complete Order Flow

```bash
# 1. Get menu
curl https://your-project.supabase.co/functions/v1/get-menu

# 2. Validate QR code
curl https://your-project.supabase.co/functions/v1/get-table-by-qr?code=TABLE-001

# 3. Create order
curl -X POST https://your-project.supabase.co/functions/v1/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "table_id": "your-table-uuid",
    "customer_name": "Test Customer",
    "items": [
      {"menu_item_id": "item-uuid", "quantity": 1}
    ]
  }'

# 4. Kitchen accepts order
curl -X PATCH https://your-project.supabase.co/functions/v1/update-order-status \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order-uuid", "status": "accepted"}'

# 5. Kitchen starts preparing
curl -X PATCH https://your-project.supabase.co/functions/v1/update-order-status \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order-uuid", "status": "preparing"}'

# 6. Kitchen marks as ready
curl -X PATCH https://your-project.supabase.co/functions/v1/update-order-status \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order-uuid", "status": "ready"}'

# 7. Admin processes payment
curl -X POST https://your-project.supabase.co/functions/v1/mark-as-paid \
  -H "Content-Type: application/json" \
  -d '{"order_id": "order-uuid", "payment_method": "cash"}'
```

---

## 📊 Database Schema

### tables
- `id` (uuid, primary key)
- `table_number` (int, unique)
- `qr_code` (text, unique)
- `created_at` (timestamp)

### menu_items
- `id` (uuid, primary key)
- `name` (text)
- `price` (numeric 10,2)
- `category` (text)
- `image_url` (text)
- `is_available` (boolean, default true)
- `created_at` (timestamp)

### orders
- `id` (uuid, primary key)
- `table_id` (uuid, foreign key)
- `customer_name` (text)
- `phone` (text)
- `status` (text: pending/accepted/preparing/ready/paid/cancelled)
- `total_amount` (numeric 10,2)
- `special_instructions` (text)
- `created_at` (timestamp)

### order_items
- `id` (uuid, primary key)
- `order_id` (uuid, foreign key)
- `menu_item_id` (uuid, foreign key)
- `quantity` (int)
- `price` (numeric 10,2) - **Price snapshot at order time**

### payments
- `id` (uuid, primary key)
- `order_id` (uuid, foreign key)
- `payment_method` (text: cash/upi/card)
- `payment_status` (text: paid/unpaid)
- `paid_at` (timestamp)

---

## 🔧 Development Commands

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Reset local database
supabase db reset

# Run migrations
supabase db push

# Serve functions locally
supabase functions serve

# Deploy functions
supabase functions deploy

# View function logs
supabase functions logs <function-name>

# Set secrets
supabase secrets set KEY=value
```

---

## 🚀 Deployment Checklist

- [ ] Create Supabase project
- [ ] Set environment variables
- [ ] Deploy secrets to Edge Functions
- [ ] Run database migrations
- [ ] Seed sample data (optional)
- [ ] Deploy Edge Functions
- [ ] Generate QR codes for tables
- [ ] Test complete order flow
- [ ] Configure frontend with function URLs
- [ ] Print and place QR codes on tables

---

## 🎯 Next Steps

### Add Authentication
- Implement Supabase Auth for admin and kitchen roles
- Update RLS policies with authentication checks
- Add login/signup endpoints

### Add Analytics
- Order completion time tracking
- Popular items reporting
- Revenue by day/week/month
- Peak hours analysis

### Add Notifications
- Push notifications for kitchen (new orders)
- SMS notifications for customers (order ready)
- Email receipts after payment

### Add Soft Deletes
- Add `deleted_at` column to menu_items
- Filter out deleted items in queries
- Admin interface to manage menu

### Add Features
- Split bills
- Tips/gratuity
- Discounts and promo codes
- Multi-language support
- Customer feedback/ratings

---

## 📝 License

MIT License - feel free to use this in your projects!

---

## 🤝 Support

For issues or questions:
1. Check the Supabase dashboard logs
2. Review Edge Function logs: `supabase functions logs <function-name>`
3. Test endpoints with curl before frontend integration
4. Ensure all environment variables are set correctly

---

## 🎉 You're All Set!

Your QR-based restaurant ordering system is ready to use. Start by:
1. Generating QR codes for your tables
2. Customizing the menu items
3. Building your frontend (customer menu, kitchen panel, admin dashboard)
4. Testing the complete order flow

Happy coding! 🍽️
