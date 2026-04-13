// Script: generate-qr-codes.ts
// Generates QR codes for restaurant tables and inserts them into the database
// Usage: deno run --allow-env --allow-net generate-qr-codes.ts [number-of-tables]

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function generateQRCodes(numTables: number) {
  console.log(`Generating QR codes for ${numTables} tables...\n`)

  const tables = []
  for (let i = 1; i <= numTables; i++) {
    const qrCode = `TABLE-${String(i).padStart(3, '0')}`
    tables.push({
      table_number: i,
      qr_code: qrCode
    })
  }

  // Insert tables into database
  const { data, error } = await supabase
    .from('tables')
    .upsert(tables, { onConflict: 'table_number' })
    .select()

  if (error) {
    console.error('Error inserting tables:', error)
    Deno.exit(1)
  }

  console.log(`✅ Successfully created/updated ${data.length} tables:\n`)
  console.log('Table Number | QR Code')
  console.log('-------------|----------')
  data.forEach(table => {
    console.log(`${String(table.table_number).padEnd(13)}| ${table.qr_code}`)
  })

  console.log('\n💡 QR Code URLs for frontend:')
  data.forEach(table => {
    const qrUrl = `https://your-restaurant-app.com/menu?table=${table.qr_code}`
    console.log(`Table ${table.table_number}: ${qrUrl}`)
  })

  console.log('\n✅ Done! Print these QR codes and place them on tables.')
}

// Get number of tables from command line argument or default to 10
const numTables = parseInt(Deno.args[0]) || 10

if (isNaN(numTables) || numTables < 1) {
  console.error('Error: Invalid number of tables. Please provide a positive integer.')
  Deno.exit(1)
}

generateQRCodes(numTables)
