// Edge Function: mark-as-paid
// Marks an order as paid and creates payment record

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { supabase } from '../_shared/supabase.ts'
import { 
  corsHeaders, 
  successResponse, 
  errorResponse, 
  handleCors,
  validateRequiredFields 
} from '../_shared/utils.ts'
import { MarkAsPaidRequest, PaymentMethod } from '../_shared/types.ts'

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
    const body: MarkAsPaidRequest = await req.json()

    // Validate required fields
    const validationError = validateRequiredFields(body, ['order_id', 'payment_method'])
    if (validationError) {
      return new Response(
        JSON.stringify(errorResponse(validationError, 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate payment method
    const validMethods: PaymentMethod[] = ['cash', 'upi', 'card']
    if (!validMethods.includes(body.payment_method)) {
      return new Response(
        JSON.stringify(errorResponse(`Invalid payment method. Must be one of: ${validMethods.join(', ')}`, 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch order
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

    // Validate order is in 'ready' status
    if (order.status !== 'ready') {
      return new Response(
        JSON.stringify(errorResponse(`Cannot pay order with status '${order.status}'. Order must be 'ready'`, 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update order status to 'paid'
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', body.order_id)

    if (updateError) {
      console.error('Error updating order status:', updateError)
      return new Response(
        JSON.stringify(errorResponse('Failed to update order status', 500)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: body.order_id,
        payment_method: body.payment_method,
        payment_status: 'paid',
        paid_at: new Date().toISOString()
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment record:', paymentError)
      // Rollback: Revert order status back to 'ready'
      await supabase
        .from('orders')
        .update({ status: 'ready' })
        .eq('id', body.order_id)
      
      return new Response(
        JSON.stringify(errorResponse('Failed to create payment record', 500)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch complete paid order with details
    const { data: paidOrder, error: finalFetchError } = await supabase
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
      .eq('id', body.order_id)
      .single()

    if (finalFetchError) {
      console.error('Error fetching paid order:', finalFetchError)
    }

    return new Response(
      JSON.stringify(successResponse({
        order: paidOrder,
        payment
      }, 'Payment processed successfully')),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error in mark-as-paid:', error)
    return new Response(
      JSON.stringify(errorResponse('Internal server error', 500)),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
