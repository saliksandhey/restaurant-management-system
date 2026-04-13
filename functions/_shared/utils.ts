// Helper functions and utilities for edge functions

import { ApiResponse, OrderStatus } from './types.ts'

// CORS headers for browser access
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS'
}

// Standard success response
export function successResponse<T>(data: T, message = 'Success'): ApiResponse<T> {
  return {
    success: true,
    data,
    message
  }
}

// Standard error response
export function errorResponse(error: string, code = 400): ApiResponse {
  return {
    success: false,
    error,
    code
  }
}

// Validate required fields are present
export function validateRequiredFields(obj: any, fields: string[]): string | null {
  for (const field of fields) {
    if (!obj[field]) {
      return `Missing required field: ${field}`
    }
  }
  return null
}

// Calculate total amount from order items
export function calculateTotal(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((total, item) => {
    return total + (item.price * item.quantity)
  }, 0)
}

// Validate order status transition
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['paid', 'cancelled'],
  paid: [],
  cancelled: []
}

export function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return validTransitions[from]?.includes(to) || false
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

// Parse request body with error handling
export async function parseRequestBody(req: Request): Promise<any> {
  try {
    return await req.json()
  } catch (error) {
    throw new Error('Invalid JSON in request body')
  }
}

// Handle CORS preflight requests
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}
