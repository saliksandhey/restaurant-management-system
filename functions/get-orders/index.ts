// Edge Function: get-orders
// Retrieves orders filtered by status and optionally by table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { supabase } from '../_shared/supabase.ts'
import { corsHeaders, successResponse, errorResponse, handleCors } from '../_shared/utils.ts'

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Parse query parameters
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const tableId = url.searchParams.get('table_id')

    // Validate status parameter
    const validStatuses = ['pending', 'accepted', 'preparing', 'ready', 'paid', 'cancelled']
    if (!status) {
      return new Response(
        JSON.stringify(errorResponse('Status parameter is required', 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify(errorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build query with joins
    let query = supabase
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
          table_number,
          qr_code
        )
      `)
      .eq('status', status)

    // Optional table filter
    if (tableId) {
      query = query.eq('table_id', tableId)
    }

    // Execute query
    const { data, error } = await query
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching orders:', error)
      return new Response(
        JSON.stringify(errorResponse('Failed to fetch orders', 500)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(successResponse({
        orders: data,
        total: data.length,
        status
      })),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error in get-orders:', error)
    return new Response(
      JSON.stringify(errorResponse('Internal server error', 500)),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
