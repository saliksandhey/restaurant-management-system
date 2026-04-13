// Script: setup-realtime.ts
// Example Supabase Realtime subscriptions for frontend integration
// This file demonstrates how to use realtime updates in your frontend application

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Kitchen Panel: Listen for order status changes
function subscribeToKitchenUpdates() {
  console.log('👨‍🍳 Kitchen Panel: Subscribing to order updates...\n')

  const channel = supabase
    .channel('kitchen-orders')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders'
      },
      (payload) => {
        console.log('📦 Order Update:', {
          eventType: payload.eventType,
          orderId: payload.new?.id,
          oldStatus: payload.old?.status,
          newStatus: payload.new?.status,
          timestamp: new Date().toISOString()
        })

        // Handle different events
        if (payload.eventType === 'INSERT') {
          console.log('🆕 New order received!')
          // Play notification sound
          // Show toast notification
          // Refresh kitchen display
        } else if (payload.eventType === 'UPDATE') {
          console.log(`🔄 Order status changed: ${payload.old?.status} → ${payload.new?.status}`)
          // Update kitchen display
        }
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status)
    })

  return channel
}

// Admin Panel: Listen for new payments
function subscribeToPaymentUpdates() {
  console.log('\n💰 Admin Panel: Subscribing to payment updates...\n')

  const channel = supabase
    .channel('admin-payments')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'payments'
      },
      (payload) => {
        console.log('💳 New Payment Received:', {
          paymentId: payload.new.id,
          orderId: payload.new.order_id,
          method: payload.new.payment_method,
          amount: payload.new.paid_at,
          timestamp: new Date().toISOString()
        })

        // Update revenue dashboard
        // Show success notification
        // Print receipt
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status)
    })

  return channel
}

// Customer View: Listen for their specific order updates
function subscribeToCustomerOrder(orderId: string) {
  console.log(`\n📱 Customer: Subscribing to order ${orderId}...\n`)

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
        console.log('📋 Your Order Status:', {
          orderId: payload.new.id,
          status: payload.new.status,
          timestamp: new Date().toISOString()
        })

        // Show status update to customer
        // "Your order is being prepared!"
        // "Your order is ready!"
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status)
    })

  return channel
}

// Example usage
console.log('=== Supabase Realtime Setup Examples ===\n')

// Uncomment the subscriptions you want to test:
// const kitchenChannel = subscribeToKitchenUpdates()
// const adminChannel = subscribeToPaymentUpdates()
// const customerChannel = subscribeToCustomerOrder('your-order-id-here')

console.log('\n💡 Usage in your frontend:')
console.log(`
// For Kitchen Panel (React example):
useEffect(() => {
  const channel = supabase
    .channel('kitchen-orders')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => {
        // Update state with new order data
        setOrders(prev => updateOrder(prev, payload))
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
`)

console.log('\n✅ Realtime setup examples complete!')
console.log('💡 Copy these patterns into your frontend application.')
