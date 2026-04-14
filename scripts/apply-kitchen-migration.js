/**
 * Run this script once to apply the kitchen_status column migration.
 * Usage: node scripts/apply-migration.js
 */

const https = require('https')

const SUPABASE_URL = 'https://nlfappbopqcmljjvltyx.supabase.co'

// You need to set your SERVICE_ROLE_KEY here (from Supabase Dashboard → Settings → API)
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY_HERE'

const SQL = `
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS kitchen_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (kitchen_status IN ('pending', 'preparing', 'ready'));

CREATE INDEX IF NOT EXISTS idx_order_items_kitchen_status
  ON order_items (kitchen_status);
`

if (SERVICE_ROLE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable or edit this file directly.')
  console.error('')
  console.error('Alternatively, run this SQL manually in your Supabase SQL editor:')
  console.error('https://supabase.com/dashboard/project/nlfappbopqcmljjvltyx/sql/new')
  console.error('')
  console.error('-- SQL to run:')
  console.error(SQL)
  process.exit(1)
}

const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL)

const body = JSON.stringify({ query: SQL })

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey': SERVICE_ROLE_KEY,
    'Content-Length': Buffer.byteLength(body)
  }
}

const req = https.request(options, (res) => {
  let data = ''
  res.on('data', (chunk) => { data += chunk })
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Migration applied successfully!')
    } else {
      console.error('❌ Migration failed:', res.statusCode, data)
      console.error('\nRun this SQL manually instead:')
      console.error('https://supabase.com/dashboard/project/nlfappbopqcmljjvltyx/sql/new')
    }
  })
})

req.on('error', (e) => {
  console.error('Request error:', e)
})
req.write(body)
req.end()
