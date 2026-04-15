import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('restaurant')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState({
    restaurant_name: '',
    logo_url: '',
    address: '',
    phone: '',
    gst_number: '',
    gst_percentage: 0,
    service_charge_enabled: false,
    currency: 'INR',
    auto_complete_time: 5,
    enable_waiter_item_addition: true,
    allow_multiple_orders: true,
    kitchen_sound_enabled: true,
    new_order_alert_enabled: true,
    admin_pin: ''
  })

  const [originalSettings, setOriginalSettings] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('id', 1)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        setSettings(data)
        setOriginalSettings(data)
      } else {
        // Fallback default if not yet created
        setOriginalSettings(settings)
      }
    } catch (err) {
      console.error('Error fetching settings:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('restaurant_settings')
        .update(settings)
        .eq('id', 1)

      if (error) throw error
      setOriginalSettings(settings)
      alert('Settings saved successfully!')
    } catch (err) {
      alert('Error saving settings: ' + err.message)
      // If table doesn't exist, tell them to run migration
      if (err.message.includes('relation "public.restaurant_settings" does not exist')) {
        alert('Please run the 011_restaurant_settings.sql migration in Supabase SQL editor first.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings)

  const tabs = [
    { id: 'restaurant', label: 'Restaurant Info', icon: 'fa-store' },
    { id: 'billing', label: 'Billing & Tax', icon: 'fa-receipt' },
    { id: 'orders', label: 'Orders & Tables', icon: 'fa-concierge-bell' },
    { id: 'notifications', label: 'Notifications', icon: 'fa-bell' },
    { id: 'qr', label: 'QR Codes', icon: 'fa-qrcode' },
    { id: 'security', label: 'Security', icon: 'fa-shield-halved' }
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="glass p-6 md:p-8 rounded-[2rem] flex items-center justify-between animate-slide-down">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">System Settings</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Manage global configuration across all devices.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={!isDirty || saving}
          className={`btn-primary !px-6 !py-3 !rounded-xl transition-all shadow-lg ${isDirty ? 'opacity-100 shadow-blue-500/20' : 'opacity-50 grayscale cursor-not-allowed'}`}
        >
          {saving ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-floppy-disk mr-2"></i>}
          Save Changes
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 animate-slide-up">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto thin-scrollbar pb-2 md:pb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-left font-bold transition-all whitespace-nowrap md:whitespace-normal shrink-0 ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm border border-blue-100/50' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
            >
              <i className={`fa-solid ${tab.icon} w-5 text-center`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          <form onSubmit={handleSave} className="card-base p-6 md:p-8 rounded-3xl min-h-[400px]">
            
            {/* Restaurant Info */}
            {activeTab === 'restaurant' && (
              <div className="space-y-6 animate-fade-scale">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fa-solid fa-store text-blue-500"></i> Restaurant Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Restaurant Name</label>
                    <input type="text" name="restaurant_name" value={settings.restaurant_name} onChange={handleChange} className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Phone Number</label>
                    <input type="text" name="phone" value={settings.phone} onChange={handleChange} className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-blue-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Address</label>
                    <textarea name="address" value={settings.address || ''} onChange={handleChange} rows="3" className="w-full p-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-blue-500 resize-none"></textarea>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Logo URL (Optional)</label>
                    <input type="text" name="logo_url" value={settings.logo_url || ''} onChange={handleChange} className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-blue-500" placeholder="https://" />
                  </div>
                </div>
              </div>
            )}

            {/* Billing & Tax */}
            {activeTab === 'billing' && (
              <div className="space-y-6 animate-fade-scale">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fa-solid fa-receipt text-amber-500"></i> Billing &amp; Tax Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">GST Percentage (%)</label>
                    <input type="number" step="0.01" name="gst_percentage" value={settings.gst_percentage} onChange={handleChange} className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-black font-mono text-slate-800 outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">GST Identification Number</label>
                    <input type="text" name="gst_number" value={settings.gst_number || ''} onChange={handleChange} className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-amber-500" placeholder="e.g. 29ABCDE1234F1Z5" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Currency Symbol</label>
                    <select name="currency" value={settings.currency} onChange={handleChange} className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-black font-mono text-slate-800 outline-none focus:border-amber-500">
                      <option value="INR">₹ (INR)</option>
                      <option value="USD">$ (USD)</option>
                      <option value="EUR">€ (EUR)</option>
                      <option value="GBP">£ (GBP)</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center shrink-0 mt-1">
                      <input type="checkbox" name="service_charge_enabled" checked={settings.service_charge_enabled} onChange={handleChange} className="peer sr-only" />
                      <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">Enable Service Charge</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1 mt-0.5">Allow waiters to optionally append service charges to final bills.</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Orders & Tables */}
            {activeTab === 'orders' && (
              <div className="space-y-6 animate-fade-scale">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fa-solid fa-concierge-bell text-emerald-500"></i> Ordering System</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Auto-Complete Time (Min)</label>
                    <input type="number" name="auto_complete_time" value={settings.auto_complete_time} onChange={handleChange} className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-black font-mono text-slate-800 outline-none focus:border-emerald-500" />
                    <p className="text-[10px] text-slate-400 mt-2 font-semibold">Ready orders complete automatically after this time.</p>
                  </div>
                </div>

                <div className="space-y-6 border-t border-slate-100 pt-6">
                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center shrink-0 mt-1">
                      <input type="checkbox" name="enable_waiter_item_addition" checked={settings.enable_waiter_item_addition} onChange={handleChange} className="peer sr-only" />
                      <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">Waiter Item Addition</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">Allow waiters to modify customer orders directly from panel.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center shrink-0 mt-1">
                      <input type="checkbox" name="allow_multiple_orders" checked={settings.allow_multiple_orders} onChange={handleChange} className="peer sr-only" />
                      <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">Continuous Ordering Session</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">Allow tables to place multiple orders onto a single active bill until payment.</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-fade-scale">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fa-solid fa-bell text-rose-500"></i> Audio & Alerts</h3>
                
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group cursor-pointer" onClick={() => handleChange({ target: { name: 'kitchen_sound_enabled', type: 'checkbox', checked: !settings.kitchen_sound_enabled }})}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${settings.kitchen_sound_enabled ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                        <i className={`fa-solid ${settings.kitchen_sound_enabled ? 'fa-volume-high' : 'fa-volume-off'}`}></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">Kitchen Display Sound</h4>
                        <p className="text-xs text-slate-500 font-medium mt-1">Play an alert chime when a new order arrives.</p>
                      </div>
                    </div>
                    <div className="relative inline-flex items-center">
                      <input type="checkbox" name="kitchen_sound_enabled" checked={settings.kitchen_sound_enabled} onChange={handleChange} className="sr-only peer" onClick={e => e.stopPropagation()} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group cursor-pointer" onClick={() => handleChange({ target: { name: 'new_order_alert_enabled', type: 'checkbox', checked: !settings.new_order_alert_enabled }})}>
                    <div className="flex items-start gap-4">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${settings.new_order_alert_enabled ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                        <i className={`fa-solid ${settings.new_order_alert_enabled ? 'fa-bell-ringing' : 'fa-bell-slash'}`}></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">Waitstaff Push Alerts</h4>
                        <p className="text-xs text-slate-500 font-medium mt-1">Notify waiters immediately when an order is ready.</p>
                      </div>
                    </div>
                    <div className="relative inline-flex items-center">
                      <input type="checkbox" name="new_order_alert_enabled" checked={settings.new_order_alert_enabled} onChange={handleChange} className="sr-only peer" onClick={e => e.stopPropagation()} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* QR Codes */}
            {activeTab === 'qr' && (
              <div className="space-y-6 animate-fade-scale">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fa-solid fa-qrcode text-purple-500"></i> QR Code Management</h3>
                
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                  <div className="w-16 h-16 bg-white border-2 border-dashed border-purple-300 rounded-2xl mx-auto flex items-center justify-center mb-4">
                    <i className="fa-solid fa-qrcode text-3xl text-purple-400"></i>
                  </div>
                  <h4 className="text-lg font-black text-slate-800">Generate Table QRs</h4>
                  <p className="text-sm font-semibold text-slate-500 max-w-sm mx-auto mt-2 mb-6">Create printable QR codes for all your tables. Customers scan these to view the menu and order directly to their table.</p>
                  
                  <div className="flex justify-center gap-4">
                    <button type="button" onClick={() => window.open('/qr-scanner', '_blank')} className="btn-secondary !px-6 !py-3 !rounded-xl font-bold bg-white text-slate-700 shadow-sm">
                      <i className="fa-solid fa-camera mr-2"></i> Open Scanner
                    </button>
                    <button type="button" onClick={() => alert('Download feature will generate PDFs of your QR codes in production.')} className="btn-primary !px-6 !py-3 !rounded-xl font-bold shadow-lg shadow-purple-500/20 bg-purple-600 hover:bg-purple-700">
                      <i className="fa-solid fa-download mr-2"></i> Download All QRs (PDF)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Table Link Format</label>
                  <input type="text" readOnly value={`${window.location.origin}/menu?table=[TABLE_NUMBER]`} className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-black font-mono tracking-widest text-slate-500 outline-none bg-slate-100 cursor-not-allowed" />
                  <p className="text-[10px] text-slate-400 font-semibold mt-2">This is the base URL structure embedded in generated QR codes.</p>
                </div>
              </div>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <div className="space-y-6 animate-fade-scale">
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><i className="fa-solid fa-shield-halved text-indigo-500"></i> Admin Security</h3>
                
                <div className="max-w-md">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Action Authorization PIN</label>
                  <input type="password" name="admin_pin" value={settings.admin_pin || ''} onChange={handleChange} className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-black font-mono tracking-widest text-slate-800 outline-none focus:border-indigo-500 placeholder:text-slate-300" placeholder="••••" maxLength={6} />
                  <p className="text-[10px] text-slate-400 font-semibold mt-2">Optional logic. Require this 4-6 digit custom PIN for destructive actions (e.g., voiding orders, modifying bills).</p>
                </div>
              </div>
            )}
            
          </form>
        </div>
      </div>
    </div>
  )
}
