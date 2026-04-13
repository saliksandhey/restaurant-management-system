// Edge Function: create-order
// Creates a new order with order items (atomic transaction)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { supabase } from '../_shared/supabase.ts'
import { 
  corsHeaders, 
  successResponse, 
  errorResponse, 
  handleCors,
  validateRequiredFields,
  calculateTotal 
} from '../_shared/utils.ts'
import { CreateOrderRequest } from '../_shared/types.ts'

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify(errorResponse('Method not allowed', 405)),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: CreateOrderRequest = await req.json()

    // Validate required fields
    const validationError = validateRequiredFields(body, ['table_id', 'customer_name', 'items'])
    if (validationError) {
      return new Response(
        JSON.stringify(errorResponse(validationError, 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate items array
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return new Response(
        JSON.stringify(errorResponse('Items must be a non-empty array', 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch menu items to get prices and validate availability
    const menuItemIds = body.items.map(item => item.menu_item_id)
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, price, is_available')
      .in('id', menuItemIds)

    if (menuError) {
      console.error('Error fetching menu items:', menuError)
      return new Response(
        JSON.stringify(errorResponse('Failed to validate menu items', 500)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if all menu items exist
    if (menuItems.length !== menuItemIds.length) {
      const foundIds = menuItems.map(item => item.id)
      const missingIds = menuItemIds.filter(id => !foundIds.includes(id))
      return new Response(
        JSON.stringify(errorResponse(`Menu items not found: ${missingIds.join(', ')}`, 404)),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if all items are available
    const unavailableItems = menuItems.filter(item => !item.is_available)
    if (unavailableItems.length > 0) {
      return new Response(
        JSON.stringify(errorResponse(`Items not available: ${unavailableItems.map(i => i.name).join(', ')}`, 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create price lookup map
    const priceMap = new Map(menuItems.map(item => [item.id, item.price]))

    // Calculate order items with prices
    const orderItemsData = body.items.map(item => ({
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      price: priceMap.get(item.menu_item_id)!
    }))

    // Calculate total amount
    const totalAmount = calculateTotal(orderItemsData)

    // Start transaction: Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        table_id: body.table_id,
        customer_name: body.customer_name,
        phone: body.phone || null,
        status: 'pending',
        total_amount: totalAmount,
        special_instructions: body.special_instructions || null
      })
      .select()
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return new Response(
        JSON.stringify(errorResponse('Failed to create order', 500)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert order items
    const orderItemsWithOrderId = orderItemsData.map(item => ({
      ...item,
      order_id: order.id
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId)

    if (itemsError) {
      console.error('Error creating order items:', itemsError)
      // Rollback: Delete the order if items insertion fails
      await supabase.from('orders').delete().eq('id', order.id)
      return new Response(
        JSON.stringify(errorResponse('Failed to create order items', 500)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch complete order with items
    const { data: completeOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          quantity,
          price,
          menu_item:menu_items (
            name,
            image_url
          )
        ),
        table:tables (
          table_number
        )
      `)
      .eq('id', order.id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete order:', fetchError)
    }

    return new Response(
      JSON.stringify(successResponse(completeOrder, 'Order created successfully')),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error in create-order:', error)
    return new Response(
      JSON.stringify(errorResponse('Internal server error', 500)),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
