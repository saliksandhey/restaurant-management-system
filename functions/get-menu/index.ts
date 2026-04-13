// Edge Function: get-menu
// Retrieves menu items with optional filtering by category and availability

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
    const category = url.searchParams.get('category')
    const availableOnly = url.searchParams.get('available_only') !== 'false'

    // Build query
    let query = supabase
      .from('menu_items')
      .select('*')

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }
    if (availableOnly) {
      query = query.eq('is_available', true)
    }

    // Execute query with ordering
    const { data, error } = await query
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching menu:', error)
      return new Response(
        JSON.stringify(errorResponse('Failed to fetch menu', 500)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group items by category for easier frontend rendering
    const groupedByCategory = data.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    }, {} as Record<string, typeof data>)

    return new Response(
      JSON.stringify(successResponse({
        items: data,
        groupedByCategory,
        total: data.length
      })),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error in get-menu:', error)
    return new Response(
      JSON.stringify(errorResponse('Internal server error', 500)),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
