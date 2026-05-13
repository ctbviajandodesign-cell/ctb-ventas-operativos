'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { X, Save, QrCode, Calendar, CreditCard, DollarSign } from 'lucide-react'

export default function SalesModal() {
  const router = useRouter()
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    total: 0,
    abono_tarjeta: 0,
    abono_1: 0,
    abono_2: 0,
    comision: 0,
    utilidad: 0,
    bono_counter: 0,
    generar_voucher: false,
    numero_proforma: '',
    fecha_viaje_desde: '',
    fecha_viaje_hasta: '',
    fecha_caducidad_voucher: '',
    notas_voucher: ''
  })

  useEffect(() => {
    const handleOpen = (e) => {
      const q = e.detail
      setQuote(q)
      setFormData({
        total: q.valor_total || 0,
        abono_tarjeta: 0,
        abono_1: 0,
        abono_2: 0,
        comision: q.valor_comision || 0,
        utilidad: q.valor_utilidad || 0,
        bono_counter: q.valor_bono || 0,
        generar_voucher: false,
        numero_proforma: q.codigo,
        fecha_viaje_desde: q.fecha_viaje_desde || '',
        fecha_viaje_hasta: q.fecha_viaje_hasta || '',
        fecha_caducidad_voucher: '',
        notas_voucher: ''
      })
    }
    window.addEventListener('open-sales-modal', handleOpen)
    return () => window.removeEventListener('open-sales-modal', handleOpen)
  }, [])

  const faltante = formData.total - (formData.abono_tarjeta + formData.abono_1 + formData.abono_2)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Crear la Venta con desglose de pagos
      const { data: venta, error: vError } = await supabase
        .from('ventas')
        .insert([{
          cotizacion_id: quote.id,
          operativo_id: quote.operativo_id,
          total: formData.total,
          abono_tarjeta: formData.abono_tarjeta,
          abono_1: formData.abono_1,
          abono_2: formData.abono_2,
          comision: formData.comision,
          utilidad: formData.utilidad,
          bono_counter: formData.bono_counter,
          numero_proforma: quote.codigo
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
        const { error: vchError } = await supabase
          .from('vouchers')
          .insert([{
            venta_id: venta.id,
            operativo_id: quote.operativo_id,
            codigo: voucherCode,
            estado: 'activo',
            fecha_viaje_desde: formData.fecha_viaje_desde,
            fecha_viaje_hasta: formData.fecha_viaje_hasta,
            fecha_caducidad: formData.fecha_caducidad_voucher,
            notas: formData.notas_voucher
          }])
        
        if (vchError) throw vchError
        router.push('/dashboard/vouchers')
      } else {
        window.location.reload()
      }
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!quote) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-primary p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Cierre de Venta Oficial</h2>
            <p className="text-xs opacity-80 uppercase tracking-widest mt-1">Ref: {quote.codigo}</p>
          </div>
          <button onClick={() => setQuote(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
          {/* SECCIÓN 1: PAGOS */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={14} /> Desglose de Pagos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="label">Total Venta ($)</label>
                <input type="number" step="0.01" className="input font-bold bg-gray-50" value={formData.total} onChange={e => setFormData({...formData, total: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="label">T. Crédito ($)</label>
                <input type="number" step="0.01" className="input" value={formData.abono_tarjeta} onChange={e => setFormData({...formData, abono_tarjeta: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="label">Abono 1 ($)</label>
                <input type="number" step="0.01" className="input" value={formData.abono_1} onChange={e => setFormData({...formData, abono_1: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="label">Abono 2 ($)</label>
                <input type="number" step="0.01" className="input" value={formData.abono_2} onChange={e => setFormData({...formData, abono_2: parseFloat(e.target.value)})} />
              </div>
            </div>
            
            <div className={`p-4 rounded-2xl flex justify-between items-center ${faltante > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-success/10 border border-success/20'}`}>
              <span className={`text-sm font-bold ${faltante > 0 ? 'text-amber-700' : 'text-success'}`}>
                {faltante > 0 ? `Faltante: $${faltante.toLocaleString()}` : '✅ Pagado Completo'}
              </span>
              <span className="text-[10px] uppercase font-bold opacity-60">Control de Caja</span>
            </div>
          </div>

          {/* SECCIÓN 2: RENTABILIDAD */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUpIcon size={14} /> Rentabilidad Operativa
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label text-success">Comisión ($)</label>
                <input type="number" step="0.01" className="input font-bold" value={formData.comision} onChange={e => setFormData({...formData, comision: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="label text-success">Utilidad ($)</label>
                <input type="number" step="0.01" className="input font-bold" value={formData.utilidad} onChange={e => setFormData({...formData, utilidad: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="label text-gray-400">Bono Counter ($)</label>
                <input type="number" step="0.01" className="input" value={formData.bono_counter} onChange={e => setFormData({...formData, bono_counter: parseFloat(e.target.value)})} />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: VOUCHER OPCIONAL */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-6 h-6 rounded-lg border-gray-300 text-primary focus:ring-primary"
                checked={formData.generar_voucher}
                onChange={e => setFormData({...formData, generar_voucher: e.target.checked})}
              />
              <div>
                <p className="text-sm font-bold text-gray-800">¿Generar Voucher de Seguridad QR?</p>
                <p className="text-[10px] text-gray-400">Activa campos adicionales para el certificado de viaje</p>
              </div>
            </label>

            {formData.generar_voucher && (
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl animate-in slide-in-from-top-4 duration-300">
                <div className="col-span-2">
                  <h4 className="text-xs font-bold text-primary uppercase mb-4">Datos del Certificado</h4>
                </div>
                <div>
                  <label className="label">Fecha Inicio Viaje</label>
                  <input type="date" required className="input text-sm" value={formData.fecha_viaje_desde} onChange={e => setFormData({...formData, fecha_viaje_desde: e.target.value})} />
                </div>
                <div>
                  <label className="label">Fecha Fin Viaje</label>
                  <input type="date" required className="input text-sm" value={formData.fecha_viaje_hasta} onChange={e => setFormData({...formData, fecha_viaje_hasta: e.target.value})} />
                </div>
                <div>
                  <label className="label text-danger">Caducidad Voucher</label>
                  <input type="date" required className="input text-sm border-danger/20" value={formData.fecha_caducidad_voucher} onChange={e => setFormData({...formData, fecha_caducidad_voucher: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="label">Instrucciones / Notas Voucher</label>
                  <textarea className="input min-h-[80px] text-sm" placeholder="Ej: Presentar este QR en la recepción del hotel..." value={formData.notas_voucher} onChange={e => setFormData({...formData, notas_voucher: e.target.value})} />
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-5 text-lg flex items-center justify-center gap-3 shadow-2xl shadow-primary/30"
          >
            {loading ? 'Procesando Venta...' : (
              <>
                <Save size={24} />
                Finalizar y Cerrar Negocio
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

function TrendingUpIcon({ size, className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
  )
}
