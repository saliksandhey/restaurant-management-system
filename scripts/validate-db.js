const { createClient } = require('@supabase/supabase-js')
const supabase = createClient('https://nlfappbopqcmljjvltyx.supabase.co', 'sb_publishable_Y1ZR9jJPfdJOLuV9qiHcnw_6PkpN3mK')

async function runChecks() {
  console.log('=== Database Validation ===\n')

  // 1. Check kitchen_status column 
  const { error: ksErr } = await supabase.from('order_items').select('kitchen_status').limit(1)
  console.log('1. kitchen_status column:', ksErr ? 'MISSING ❌ ' + ksErr.message : 'EXISTS ✅')

  // 2. Check orders query with .not().in()
  const { data: ordData, error: ordErr } = await supabase
    .from('orders')
    .select('id, status')
    .not('status', 'in', '("paid","cancelled")')
    .limit(3)
  console.log('2. Active orders query:', ordErr ? 'ERROR ❌ ' + ordErr.message : 'OK ✅ (' + (ordData?.length ?? 0) + ' rows)')

  // 3. Check kitchen join query (orders -> order_items inner join)
  const { error: kitErr } = await supabase
    .from('orders')
    .select('id, order_items!inner(id, kitchen_status)')
    .not('status', 'in', '("paid","cancelled")')
    .limit(3)
  console.log('3. Kitchen join query:', kitErr ? 'ERROR ❌ ' + kitErr.message : 'OK ✅')

  // 4. tables.status column
  const { error: tblErr } = await supabase.from('tables').select('id, status').limit(1)
  console.log('4. tables.status column:', tblErr ? 'MISSING ❌ ' + tblErr.message : 'EXISTS ✅')
  
  // 5. payments table
  const { error: payErr } = await supabase.from('payments').select('id').limit(1)
  console.log('5. payments table:', payErr ? 'ERROR ❌ ' + payErr.message : 'OK ✅')

  // 6. Check waiter_calls table
  const { error: wcErr } = await supabase.from('waiter_calls').select('id, status').limit(1)
  console.log('6. waiter_calls table:', wcErr ? 'ERROR ❌ ' + wcErr.message : 'OK ✅')

  // 7. Check waiters table (for PIN auth)
  const { error: wErr } = await supabase.from('waiters').select('id, name, pass_code, is_active').limit(1)
  console.log('7. waiters table:', wErr ? 'ERROR ❌ ' + wErr.message : 'OK ✅')

  // 8. Check menu_items
  const { data: menuData, error: menuErr } = await supabase.from('menu_items').select('id, name, price, is_available').limit(3)
  console.log('8. menu_items:', menuErr ? 'ERROR ❌ ' + menuErr.message : 'OK ✅ (' + (menuData?.length ?? 0) + ' available)')

  console.log('\n=== Summary ===')
  const allOk = [ksErr, ordErr, kitErr, tblErr, payErr, wcErr, wErr, menuErr].every(e => !e)
  console.log(allOk ? '✅ All checks passed! Database is ready.' : '❌ Some checks failed - see above.')

  if (ksErr) {
    console.log('\n⚠️  ACTION REQUIRED: Run this SQL in Supabase dashboard:')
    console.log('https://supabase.com/dashboard/project/nlfappbopqcmljjvltyx/sql/new\n')
    console.log(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kitchen_status TEXT NOT NULL DEFAULT 'pending' CHECK (kitchen_status IN ('pending', 'preparing', 'ready'));`)
    console.log(`CREATE INDEX IF NOT EXISTS idx_order_items_kitchen_status ON order_items (kitchen_status);`)
    console.log(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`)
  }
}

runChecks().catch(console.error)
