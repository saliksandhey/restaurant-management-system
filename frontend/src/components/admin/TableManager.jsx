import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function TableManager() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newTableNum, setNewTableNum] = useState('')
  const [actionMessage, setActionMessage] = useState(null)

  useEffect(() => {
    fetchTables()

    // Optional: Realtime Updates
    const channel = supabase
      .channel('tables_manager_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        fetchTables()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const showMessage = (msg) => {
    setActionMessage(msg)
    setTimeout(() => setActionMessage(null), 4000)
  }

  const fetchTables = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('tables').select('*').order('table_number')
      if (error) throw error
      setTables(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      const table_number = parseInt(newTableNum)
      if (isNaN(table_number)) throw new Error('Invalid table number')
      // Use the production domain to ensure all QR codes reliably point to the live app
      const appUrl = 'https://ressphere.vercel.app'
      
      // Step 1: Pre-generate a UUID to simplify the ONE-STEP insert avoiding the NOT NULL UNIQUE constraint.
      const id = crypto.randomUUID()
      const qrCodeUrl = `${appUrl}/?table_id=${id}`

      // Step 2 & 3: Insert into tables with the table_number and pre-generated qr_code binding to the ID
      const { error } = await supabase.from('tables').insert([{
        id,
        table_number,
        qr_code: qrCodeUrl
      }])
      
      if (error) {
        // Handle duplication natively based on Supabase PostgreSQL uniqueness flag
        if (error.code === '23505') {
          showMessage(<><i className="fa-solid fa-circle-exclamation text-red-500"></i> Table number already exists</>)
          return
        }
        throw error
      }
      
      setIsAdding(false)
      setNewTableNum('')
      showMessage(<><i className="fa-solid fa-circle-check text-green-500"></i> Table added successfully</>)
      fetchTables()
    } catch (err) {
      console.error(err)
      showMessage(<><i className="fa-solid fa-circle-exclamation text-red-500"></i> Error adding table</>)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure? This will delete the table and its active orders.')) return
    try {
      const { error } = await supabase.from('tables').delete().eq('id', id)
      if (error) throw error
      
      showMessage(<><i className="fa-solid fa-check text-green-500"></i> Table deleted successfully</>)
      fetchTables()
    } catch (err) {
      console.error(err)
      showMessage(<><i className="fa-solid fa-circle-exclamation text-red-500"></i> Error deleting table: {err.message}</>)
    }
  }

  const getQrImageUrl = (data) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`
  }

  const handleDownloadQR = async (tableNum, qrData) => {
    try {
      const response = await fetch(getQrImageUrl(qrData))
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `table-${tableNum}-qr.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download err', err)
      alert('Failed to download QR code')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Table Management</h2>
          <p className="text-sm text-gray-500">Manage tables and generate QR codes</p>
        </div>
        <div className="flex items-center gap-4">
          {actionMessage && (
            <span className="text-sm font-bold animate-pulse px-3 py-1 bg-slate-100 rounded-lg whitespace-nowrap">
              {actionMessage}
            </span>
          )}
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <i className="fa-solid fa-plus"></i> Add Table
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 max-w-md animate-in slide-in-from-top-4">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <i className="fa-solid fa-qrcode text-blue-600"></i> New Table / QR
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
              <input 
                required 
                type="number" 
                min="1"
                value={newTableNum} 
                onChange={e => setNewTableNum(e.target.value)} 
                className="w-full p-2 border rounded-md" 
                placeholder="e.g. 1"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsAdding(false)} className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Table</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading tables...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {tables.map(table => (
            <div key={table.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col items-center">
              <div className="w-full bg-gray-50 border-b border-gray-100 p-4 text-center relative">
                <h4 className="font-bold text-xl text-gray-800">Table {table.table_number}</h4>
                <button 
                  onClick={() => handleDelete(table.id)}
                  className="absolute right-4 top-4 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete Table"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
              <div className="p-6 flex flex-col items-center gap-4 w-full">
                <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                  <img 
                    src={getQrImageUrl(table.qr_code)} 
                    alt={`QR Code for Table ${table.table_number}`} 
                    className="w-32 h-32"
                  />
                </div>
                <p className="text-xs text-gray-500 break-all text-center max-w-full px-2" title={table.qr_code}>
                  {new URL(table.qr_code).pathname + new URL(table.qr_code).search}
                </p>
                <button 
                  onClick={() => handleDownloadQR(table.table_number, table.qr_code)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  <i className="fa-solid fa-download"></i> Download QR
                </button>
              </div>
            </div>
          ))}
          {tables.length === 0 && !isAdding && (
             <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
               No tables configured. Add a table to generate its QR code.
             </div>
          )}
        </div>
      )}
    </div>
  )
}
