'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  X, Save, QrCode, Calendar, CreditCard, DollarSign, Plus, Trash2, 
  CheckCircle2, AlertCircle, Percent, Hotel, Bus, Plane, Map 
} from 'lucide-react'

export default function SalesModal() {
  const router = useRouter()
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const [milestones, setMilestones] = useState([
    { id: Date.now(), label: 'Pago Inicial / Reserva', amount: 0, percent: 0, date: new Date().toISOString().split('T')[0], status: 'pagado' }
  ])
  
  const [inclusions, setInclusions] = useState({
    hotel: true,
    traslados: false,
    boletos: false,
    tours: false,
    seguro: false
  })

  const [formData, setFormData] = useState({
    total: 0,
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
      const initialTotal = q.valor_total || q.total || 0
      
      if (q.existingSale) {
        const s = q.existingSale
        setFormData({
          total: initialTotal,
          comision: s.comision || 0,
          utilidad: s.utilidad || 0,
          bono_counter: s.bono_counter || 0,
          generar_voucher: false,
          numero_proforma: s.numero_proforma,
          fecha_viaje_desde: '',
          fecha_viaje_hasta: '',
          fecha_caducidad_voucher: '',
          notas_voucher: ''
        })
      } else {
        setFormData({
          total: initialTotal,
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
        setMilestones([
          { id: Date.now(), label: 'Pago Inicial / Reserva', amount: initialTotal, percent: 100, date: new Date().toISOString().split('T')[0], status: 'pagado' }
        ])
      }
    }
    window.addEventListener('open-sales-modal', handleOpen)
    return () => window.removeEventListener('open-sales-modal', handleOpen)
  }, [])

  const updateMilestone = (id, field, value) => {
    setMilestones(milestones.map(m => {
      if (m.id === id) {
        let newM = { ...m, [field]: value }
        if (field === 'percent') newM.amount = (value / 100) * formData.total
        else if (field === 'amount') newM.percent = (value / formData.total) * 100
        return newM
      }
      return m
    }))
  }

  const totalPaid = milestones.filter(m => m.status === 'pagado').reduce((acc, m) => acc + Number(m.amount), 0)
  const faltante = formData.total - totalPaid

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Mapeo inteligente para compatibilidad (usamos notas_seguimiento para guardar el cronograma como texto)
      const planPagosTexto = milestones.map(m => `${m.label}: $${m.amount} (${m.status.toUpperCase()}) - F: ${m.date}`).join(' | ')

      const payload = {
        total: formData.total,
        abono_tarjeta: milestones.filter(m => m.status === 'pagado' && m.label.toLowerCase().includes('tarjeta')).reduce((acc, m) => acc + Number(m.amount), 0),
        abono_1: milestones.filter(m => m.status === 'pagado' && !m.label.toLowerCase().includes('tarjeta'))[0]?.amount || 0,
        abono_2: milestones.filter(m => m.status === 'pagado' && !m.label.toLowerCase().includes('tarjeta')).slice(1).reduce((acc, m) => acc + Number(m.amount), 0),
        comision: formData.comision,
        utilidad: formData.utilidad,
        bono_counter: formData.bono_counter,
        notas_seguimiento: planPagosTexto, // Guardamos el cronograma aquí para que sea visible
        estado: 'activa'
      }

      let ventaId = quote.existingSale?.id
      if (quote.existingSale) {
        const { error } = await supabase.from('ventas').update(payload).eq('id', ventaId)
        if (error) throw error
      } else {
        const { data: venta, error: vError } = await supabase
          .from('ventas')
          .insert([{ ...payload, cotizacion_id: quote.id, operativo_id: quote.operativo_id, numero_proforma: quote.codigo }])
          .select().single()
        if (vError) throw vError
        ventaId = venta.id
        await supabase.from('cotizaciones').update({ estado: 'ganada' }).eq('id', quote.id)
      }

      if (formData.generar_voucher) {
        const inclusionText = Object.entries(inclusions).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(', ')
        
        const { error: vchError } = await supabase.from('vouchers').insert([{
          venta_id: ventaId,
          operativo_id: quote.operativo_id,
          codigo: `VCH-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          estado: 'activo',
          fecha_viaje_desde: formData.fecha_viaje_desde || null,
          fecha_viaje_hasta: formData.fecha_viaje_hasta || null,
          fecha_caducidad: formData.fecha_caducidad_voucher || null,
          notas: `INCLUYE: ${inclusionText}. ${formData.notas_voucher}`,
          agencia: quote.agencia,
          valor_total: formData.total,
          pasajeros: quote.nombres_pasajeros,
          destino: quote.destino
        }])
        if (vchError) throw vchError
        router.push('/dashboard/vouchers')
        return
      }
      window.location.reload()
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!quote) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in duration-300">
        
        <div className="bg-primary p-8 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Cierre y Emisión de Voucher</h2>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">Proforma: {quote.codigo}</p>
          </div>
          <button onClick={() => setQuote(null)} className="p-2 hover:rotate-90 transition-all"><X size={28} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={16} /> Cronograma de Cobros
              </h3>
              <button type="button" onClick={() => setMilestones([...milestones, { id: Date.now(), label: 'Nuevo Abono', amount: 0, percent: 0, date: '', status: 'pendiente' }])} className="text-[10px] font-black text-primary bg-primary/5 px-3 py-1.5 rounded-full">+ Agregar Fecha de Cobro</button>
            </div>

            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.id} className={`grid grid-cols-12 gap-2 p-3 rounded-2xl border transition-all ${m.status === 'pagado' ? 'bg-success/5 border-success/20' : 'bg-amber-50/50 border-amber-100'}`}>
                  <div className="col-span-4">
                    <input className="bg-transparent border-none text-[11px] font-black w-full" value={m.label} onChange={e => updateMilestone(m.id, 'label', e.target.value)} />
                  </div>
                  <div className="col-span-2 relative">
                    <span className="absolute left-1 top-2 text-[10px] text-gray-400">$</span>
                    <input type="number" className="bg-white border-none rounded-lg text-xs font-black w-full pl-4 py-1" value={m.amount} onChange={e => updateMilestone(m.id, 'amount', parseFloat(e.target.value))} />
                  </div>
                  <div className="col-span-3">
                    <input type="date" className={`bg-white border-none rounded-lg text-[10px] font-bold w-full py-1 px-2 ${!m.date && m.status === 'pendiente' ? 'ring-2 ring-amber-400' : ''}`} value={m.date} onChange={e => updateMilestone(m.id, 'date', e.target.value)} />
                  </div>
                  <div className="col-span-3 flex justify-end gap-2">
                    <button type="button" onClick={() => updateMilestone(m.id, 'status', m.status === 'pagado' ? 'pendiente' : 'pagado')} className={`p-2 rounded-lg transition-all ${m.status === 'pagado' ? 'text-success bg-white shadow-sm' : 'text-gray-300'}`}><CheckCircle2 size={20} /></button>
                    <button type="button" onClick={() => setMilestones(milestones.filter(x => x.id !== m.id))} className="text-gray-300 hover:text-danger"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-success/10 p-5 rounded-[2rem] border border-success/20">
                <p className="text-[10px] font-black text-success uppercase">Efectivo en Caja</p>
                <p className="text-2xl font-black text-gray-900">${totalPaid.toLocaleString()}</p>
              </div>
              <div className={`p-5 rounded-[2rem] border ${faltante > 0 ? 'bg-amber-100/50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                <p className={`text-[10px] font-black uppercase ${faltante > 0 ? 'text-amber-600' : 'text-gray-400'}`}>Saldo por Cobrar</p>
                <p className="text-2xl font-black text-gray-900">${faltante.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-[2.5rem] grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Comisión</label>
              <input type="number" step="0.01" className="bg-transparent border-none font-black text-success text-xl p-0 w-full" value={formData.comision} onChange={e => setFormData({...formData, comision: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Utilidad</label>
              <input type="number" step="0.01" className="bg-transparent border-none font-black text-success text-xl p-0 w-full" value={formData.utilidad} onChange={e => setFormData({...formData, utilidad: parseFloat(e.target.value)})} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-primary uppercase">Total Meta</p>
              <p className="text-xl font-black text-primary">${(formData.comision + formData.utilidad).toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-6">
            <label className="flex items-center gap-4 cursor-pointer bg-primary/5 p-6 rounded-3xl border border-primary/20">
              <input type="checkbox" className="w-8 h-8 rounded-xl" checked={formData.generar_voucher} onChange={e => setFormData({...formData, generar_voucher: e.target.checked})} />
              <div>
                <p className="text-lg font-black text-primary uppercase tracking-tighter">¿Emitir Voucher con Seguridad QR?</p>
                <p className="text-xs text-primary/60">Define qué incluye el servicio y las fechas de viaje.</p>
              </div>
            </label>

            {formData.generar_voucher && (
              <div className="space-y-8 animate-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-5 gap-3">
                  {['hotel', 'traslados', 'boletos', 'tours', 'seguro'].map(item => (
                    <button key={item} type="button" onClick={() => setInclusions({...inclusions, [item]: !inclusions[item]})} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${inclusions[item] ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}>
                      {item === 'hotel' && <Hotel size={20} />}
                      {item === 'traslados' && <Bus size={20} />}
                      {item === 'boletos' && <Plane size={20} />}
                      {item === 'tours' && <Map size={20} />}
                      {item === 'seguro' && <AlertCircle size={20} />}
                      <span className="text-[9px] font-black uppercase">{item}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[9px] font-black text-gray-400 uppercase">Inicio</label><input type="date" className="input font-bold" value={formData.fecha_viaje_desde} onChange={e => setFormData({...formData, fecha_viaje_desde: e.target.value})} /></div>
                  <div><label className="text-[9px] font-black text-gray-400 uppercase">Fin</label><input type="date" className="input font-bold" value={formData.fecha_viaje_hasta} onChange={e => setFormData({...formData, fecha_viaje_hasta: e.target.value})} /></div>
                  <div className="col-span-2"><label className="text-[10px] font-black text-gray-400 uppercase">Notas Pasajero</label><textarea className="input text-xs" placeholder="Indicaciones..." value={formData.notas_voucher} onChange={e => setFormData({...formData, notas_voucher: e.target.value})} /></div>
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full bg-primary text-white py-6 rounded-[2.5rem] text-xl font-black uppercase tracking-tighter shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all">
            {loading ? 'Procesando...' : 'Finalizar y Emitir Voucher'}
          </button>
        </form>
      </div>
    </div>
  )
}
