// Edge Function: update-order-status
// Updates order status with validation of state transitions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { supabase } from '../_shared/supabase.ts'
import { 
  corsHeaders, 
  successResponse, 
  errorResponse, 
  handleCors,
  validateRequiredFields,
  isValidStatusTransition 
} from '../_shared/utils.ts'
import { UpdateOrderStatusRequest, OrderStatus } from '../_shared/types.ts'

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Only accept PATCH requests
    if (req.method !== 'PATCH') {
      return new Response(
        JSON.stringify(errorResponse('Method not allowed', 405)),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: UpdateOrderStatusRequest = await req.json()

    // Validate required fields
    const validationError = validateRequiredFields(body, ['order_id', 'status'])
    if (validationError) {
      return new Response(
        JSON.stringify(errorResponse(validationError, 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate status value
    const validStatuses: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'paid', 'cancelled']
    if (!validStatuses.includes(body.status)) {
      return new Response(
        JSON.stringify(errorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cannot use this endpoint to mark as paid
    if (body.status === 'paid') {
      return new Response(
        JSON.stringify(errorResponse('Use mark-as-paid endpoint to mark order as paid', 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch current order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', body.order_id)
      .single()

    if (fetchError || !order) {
      return new Response(
        JSON.stringify(errorResponse('Order not found', 404)),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate status transition
    if (!isValidStatusTransition(order.status as OrderStatus, body.status)) {
      return new Response(
        JSON.stringify(errorResponse(
          `Invalid status transition from '${order.status}' to '${body.status}'`,
          409
        )),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: body.status })
      .eq('id', body.order_id)
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
      .single()

    if (updateError) {
      console.error('Error updating order status:', updateError)
      return new Response(
        JSON.stringify(errorResponse('Failed to update order status', 500)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(successResponse(updatedOrder, `Order status updated to ${body.status}`)),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error in update-order-status:', error)
    return new Response(
      JSON.stringify(errorResponse('Internal server error', 500)),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
