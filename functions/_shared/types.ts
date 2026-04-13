// TypeScript type definitions for the restaurant ordering system

export interface Table {
  id: string
  table_number: number
  qr_code: string
  created_at: string
}

export interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  image_url: string | null
  is_available: boolean
  created_at: string
}

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'paid' | 'cancelled'

export interface Order {
  id: string
  table_id: string
  customer_name: string
  phone: string | null
  status: OrderStatus
  total_amount: number
  special_instructions: string | null
  created_at: string
  table?: Table
  order_items?: OrderItemWithDetails[]
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  price: number
}

export interface OrderItemWithDetails extends OrderItem {
  menu_item?: {
    name: string
    image_url: string | null
  }
}

export type PaymentMethod = 'cash' | 'upi' | 'card'
export type PaymentStatus = 'paid' | 'unpaid'

export interface Payment {
  id: string
  order_id: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  paid_at: string
}

// Request/Response types
export interface CreateOrderRequest {
  table_id: string
  customer_name: string
  phone?: string
  items: Array<{
    menu_item_id: string
    quantity: number
  }>
  special_instructions?: string
}

export interface UpdateOrderStatusRequest {
  order_id: string
  status: OrderStatus
}

export interface MarkAsPaidRequest {
  order_id: string
  payment_method: PaymentMethod
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: number
}
