'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Save, QrCode } from 'lucide-react'

export default function SalesModal() {
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    total: 0,
    comision: 0,
    utilidad: 0,
    bono_counter: 0,
    generar_voucher: false,
    numero_proforma: ''
  })

  useEffect(() => {
    const handleOpen = (e) => {
      const q = e.detail
      setQuote(q)
      setFormData({
        total: q.valor_total || 0,
        comision: q.valor_comision || 0,
        utilidad: q.valor_utilidad || 0,
        bono_counter: q.valor_bono || 0,
        generar_voucher: false,
        numero_proforma: q.codigo
      })
    }
    window.addEventListener('open-sales-modal', handleOpen)
    return () => window.removeEventListener('open-sales-modal', handleOpen)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Crear la Venta
      const { data: venta, error: vError } = await supabase
        .from('ventas')
        .insert([{
          cotizacion_id: quote.id,
          operativo_id: quote.operativo_id,
          total: formData.total,
          comision: formData.comision,
          utilidad: formData.utilidad,
          bono_counter: formData.bono_counter,
          numero_proforma: formData.numero_proforma
        }])
        .select()
        .single()

      if (vError) throw vError

      // 2. Actualizar estado de Cotización
      await supabase
        .from('cotizaciones')
        .update({ estado: 'ganada' })
        .eq('id', quote.id)

      // 3. Generar Voucher si aplica
      if (formData.generar_voucher) {
        const voucherCode = `VCH-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        await supabase
          .from('vouchers')
          .insert([{
            venta_id: venta.id,
            operativo_id: quote.operativo_id,
            codigo: voucherCode,
            estado: 'activo'
          }])
      }

      // 4. Notificar a Telegram (Llamada a Edge Function o similar)
      // fetch('/api/telegram', { method: 'POST', body: JSON.stringify({ ...venta, operative: quote.profiles.nombre }) })

      window.location.reload()
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!quote) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-200">
        <div className="bg-primary p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">¡Venta Ganada!</h2>
            <p className="text-xs opacity-80 uppercase tracking-widest mt-1">Cotización: {quote.codigo}</p>
          </div>
          <button onClick={() => setQuote(null)} className="p-2 hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Referencia de Cotización</p>
              <p className="text-sm font-bold text-gray-700">{quote.codigo}</p>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Total Venta ($)</label>
              <input 
                type="number" step="0.01" required
                className="input font-bold text-primary"
                value={formData.total}
                onChange={e => setFormData({...formData, total: parseFloat(e.target.value)})}
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Bono Counter ($)</label>
              <input 
                type="number" step="0.01" required
                className="input text-gray-600"
                value={formData.bono_counter}
                onChange={e => setFormData({...formData, bono_counter: parseFloat(e.target.value)})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Comisión ($)</label>
              <input 
                type="number" step="0.01" required
                className="input text-success font-bold"
                value={formData.comision}
                onChange={e => setFormData({...formData, comision: parseFloat(e.target.value)})}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Utilidad ($)</label>
              <input 
                type="number" step="0.01" required
                className="input text-success font-bold"
                value={formData.utilidad}
                onChange={e => setFormData({...formData, utilidad: parseFloat(e.target.value)})}
              />
            </div>
          </div>

          <div className="bg-success/5 p-4 rounded-xl border border-success/10 flex items-center justify-between">
            <span className="text-sm font-bold text-success">Aporte a Meta Mensual:</span>
            <span className="text-xl font-black text-success">
              ${(formData.comision + formData.utilidad).toLocaleString()}
            </span>
          </div>

          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer group">
            <input 
              type="checkbox" 
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              checked={formData.generar_voucher}
              onChange={e => setFormData({...formData, generar_voucher: e.target.checked})}
            />
            <div className="flex items-center gap-2">
              <QrCode size={20} className="text-gray-400 group-hover:text-primary transition-colors" />
              <div>
                <p className="text-sm font-bold text-gray-700">Generar Voucher QR</p>
                <p className="text-[10px] text-gray-400">Verificable públicamente en destino</p>
              </div>
            </div>
          </label>

          <button 
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
          >
            {loading ? 'Procesando...' : (
              <>
                <Save size={20} />
                Registrar Venta
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
