// Edge Function: get-table-by-qr
// Validates QR code and returns table information

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
    const qrCode = url.searchParams.get('code')

    // Validate QR code parameter
    if (!qrCode) {
      return new Response(
        JSON.stringify(errorResponse('QR code parameter is required', 400)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch table by QR code
    const { data: table, error } = await supabase
      .from('tables')
      .select('*')
      .eq('qr_code', qrCode)
      .single()

    if (error || !table) {
      return new Response(
        JSON.stringify(errorResponse('Invalid QR code. Table not found.', 404)),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(successResponse(table, 'Table found')),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error in get-table-by-qr:', error)
    return new Response(
      JSON.stringify(errorResponse('Internal server error', 500)),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
