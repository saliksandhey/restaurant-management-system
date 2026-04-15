/**
 * Run this script once to apply the restaurant_settings table migration.
 * Usage: node scripts/apply-settings-migration.js
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../frontend/.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nlfappbopqcmljjvltyx.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY_HERE'

const SQL = fs.readFileSync(path.join(__dirname, '../supabase/migrations/011_restaurant_settings.sql'), 'utf8')

if (SERVICE_ROLE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable.')
  console.error('')
  console.error('Alternatively, run this SQL manually in your Supabase SQL editor:')
  console.error('https://supabase.com/dashboard/project/nlfappbopqcmljjvltyx/sql/new')
  console.error('')
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
      console.log('✅ Settings migration applied successfully!')
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
