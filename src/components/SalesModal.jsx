'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { X, Save, QrCode, Calendar, CreditCard, DollarSign, Plus, Trash2, CheckCircle2, AlertCircle, Percent } from 'lucide-react'

export default function SalesModal() {
  const router = useRouter()
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [milestones, setMilestones] = useState([
    { id: Date.now(), label: 'Pago Inicial', amount: 0, percent: 0, date: '', status: 'pagado' }
  ])
  
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
        // Si tuviera hitos guardados los cargaríamos aquí
        if (s.plan_pagos) {
          setMilestones(s.plan_pagos)
        } else {
          setMilestones([
            { id: 1, label: 'Tarjeta', amount: s.abono_tarjeta || 0, percent: (s.abono_tarjeta/initialTotal)*100 || 0, date: '', status: 'pagado' },
            { id: 2, label: 'Efectivo/Transf 1', amount: s.abono_1 || 0, percent: (s.abono_1/initialTotal)*100 || 0, date: '', status: 'pagado' },
            { id: 3, label: 'Efectivo/Transf 2', amount: s.abono_2 || 0, percent: (s.abono_2/initialTotal)*100 || 0, date: '', status: 'pagado' }
          ].filter(m => m.amount > 0))
        }
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

  const addMilestone = () => {
    setMilestones([...milestones, { id: Date.now(), label: 'Nuevo Hito', amount: 0, percent: 0, date: '', status: 'pendiente' }])
  }

  const removeMilestone = (id) => {
    setMilestones(milestones.filter(m => m.id !== id))
  }

  const updateMilestone = (id, field, value) => {
    setMilestones(milestones.map(m => {
      if (m.id === id) {
        let newM = { ...m, [field]: value }
        // Cálculos cruzados entre % y $
        if (field === 'percent') {
          newM.amount = (value / 100) * formData.total
        } else if (field === 'amount') {
          newM.percent = (value / formData.total) * 100
        }
        return newM
      }
      return m
    }))
  }

  const totalPaid = milestones.filter(m => m.status === 'pagado').reduce((acc, m) => acc + Number(m.amount), 0)
  const totalPending = milestones.filter(m => m.status === 'pendiente').reduce((acc, m) => acc + Number(m.amount), 0)
  const faltante = formData.total - totalPaid

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Mapear hitos para compatibilidad con abono_tarjeta, abono_1, abono_2
      const abono_tarjeta = milestones.filter(m => m.status === 'pagado' && m.label.toLowerCase().includes('tarjeta')).reduce((acc, m) => acc + Number(m.amount), 0)
      const otrosPagos = milestones.filter(m => m.status === 'pagado' && !m.label.toLowerCase().includes('tarjeta'))
      const abono_1 = otrosPagos[0]?.amount || 0
      const abono_2 = otrosPagos.slice(1).reduce((acc, m) => acc + Number(m.amount), 0)

      const payload = {
        total: formData.total,
        abono_tarjeta,
        abono_1,
        abono_2,
        comision: formData.comision,
        utilidad: formData.utilidad,
        bono_counter: formData.bono_counter,
        plan_pagos: milestones, // Guardamos el JSON completo para el cronograma
        estado: 'activa'
      }

      if (quote.existingSale) {
        const { error } = await supabase.from('ventas').update(payload).eq('id', quote.existingSale.id)
        if (error) throw error
      } else {
        const { data: venta, error: vError } = await supabase
          .from('ventas')
          .insert([{ ...payload, cotizacion_id: quote.id, operativo_id: quote.operativo_id, numero_proforma: quote.codigo }])
          .select().single()
        
        if (vError) throw vError

        await supabase.from('cotizaciones').update({ estado: 'ganada' }).eq('id', quote.id)

        if (formData.generar_voucher) {
          const voucherCode = `VCH-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
          const { error: vchError } = await supabase.from('vouchers').insert([{
            venta_id: venta.id,
            operativo_id: quote.operativo_id,
            codigo: voucherCode,
            estado: 'activo',
            fecha_viaje_desde: formData.fecha_viaje_desde,
            fecha_viaje_hasta: formData.fecha_viaje_hasta,
            fecha_caducidad: formData.fecha_caducidad_voucher,
            notas: formData.notas_voucher,
            agencia: quote.agencia,
            valor_total: formData.total,
            pasajeros: quote.nombres_pasajeros,
            destino: quote.destino
          }])
          if (vchError) throw vchError
          router.push('/dashboard/vouchers')
          return
        }
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
        
        {/* Cabecera */}
        <div className="bg-primary p-8 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Cierre de Venta Inteligente</h2>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">Expediente: {quote.codigo}</p>
          </div>
          <button onClick={() => setQuote(null)} className="p-2 hover:rotate-90 transition-all"><X size={28} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* SECCIÓN 1: CRONOGRAMA DE PAGOS DINÁMICO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <CreditCard size={16} /> Cronograma de Pagos / Hitos
              </h3>
              <button type="button" onClick={addMilestone} className="text-[10px] font-black text-primary bg-primary/5 px-3 py-1.5 rounded-full hover:bg-primary/10 flex items-center gap-1 transition-all">
                <Plus size={12} /> Agregar Hito
              </button>
            </div>

            <div className="space-y-3">
              {milestones.map((m, i) => (
                <div key={m.id} className={`grid grid-cols-12 gap-3 p-4 rounded-2xl border transition-all ${m.status === 'pagado' ? 'bg-success/5 border-success/20' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="col-span-12 md:col-span-3">
                    <input className="input-minimal text-xs font-bold" placeholder="Nombre Hito (Ej: Reserva)" value={m.label} onChange={e => updateMilestone(m.id, 'label', e.target.value)} />
                  </div>
                  <div className="col-span-4 md:col-span-2 relative">
                    <span className="absolute left-2 top-2.5 text-[10px] font-bold text-gray-400">$</span>
                    <input type="number" className="input-minimal pl-5 text-xs font-black" value={m.amount} onChange={e => updateMilestone(m.id, 'amount', parseFloat(e.target.value))} />
                  </div>
                  <div className="col-span-3 md:col-span-2 relative">
                    <span className="absolute right-2 top-2.5 text-[10px] font-bold text-gray-400">%</span>
                    <input type="number" className="input-minimal pr-5 text-xs font-black text-right" value={m.percent} onChange={e => updateMilestone(m.id, 'percent', parseFloat(e.target.value))} />
                  </div>
                  <div className="col-span-5 md:col-span-3">
                    <input type="date" className="input-minimal text-[10px] uppercase font-bold" value={m.date} onChange={e => updateMilestone(m.id, 'date', e.target.value)} />
                  </div>
                  <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                    <button 
                      type="button" 
                      onClick={() => updateMilestone(m.id, 'status', m.status === 'pagado' ? 'pendiente' : 'pagado')}
                      className={`p-2 rounded-lg transition-all ${m.status === 'pagado' ? 'text-success bg-white shadow-sm' : 'text-gray-300 hover:text-amber-500'}`}
                      title={m.status === 'pagado' ? 'Marcar como Pendiente' : 'Marcar como Pagado'}
                    >
                      <CheckCircle2 size={20} />
                    </button>
                    <button type="button" onClick={() => removeMilestone(m.id)} className="p-2 text-gray-300 hover:text-danger"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen de Control de Caja */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-success/10 p-5 rounded-[2rem] border border-success/20 flex items-center gap-4">
                <div className="bg-success text-white p-3 rounded-2xl shadow-lg shadow-success/20"><DollarSign size={24} /></div>
                <div>
                  <p className="text-[10px] font-black text-success uppercase tracking-widest">Total Pagado</p>
                  <p className="text-2xl font-black text-gray-900">${totalPaid.toLocaleString()}</p>
                </div>
              </div>
              <div className={`p-5 rounded-[2rem] border flex items-center gap-4 ${faltante > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                <div className={`${faltante > 0 ? 'bg-amber-500' : 'bg-gray-400'} text-white p-3 rounded-2xl shadow-lg`}><AlertCircle size={24} /></div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${faltante > 0 ? 'text-amber-600' : 'text-gray-400'}`}>Saldo Pendiente</p>
                  <p className="text-2xl font-black text-gray-900">${faltante.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: RENTABILIDAD */}
          <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 space-y-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Percent size={14} /> Rentabilidad del Negocio
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="text-[10px] font-black text-success uppercase tracking-widest block mb-2">Comisión ($)</label>
                <input type="number" step="0.01" className="input font-bold" value={formData.comision} onChange={e => setFormData({...formData, comision: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-success uppercase tracking-widest block mb-2">Utilidad ($)</label>
                <input type="number" step="0.01" className="input font-bold" value={formData.utilidad} onChange={e => setFormData({...formData, utilidad: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Bono Counter ($)</label>
                <input type="number" step="0.01" className="input text-gray-500" value={formData.bono_counter} onChange={e => setFormData({...formData, bono_counter: parseFloat(e.target.value)})} />
              </div>
            </div>
            <div className="bg-success text-white p-6 rounded-[2rem] shadow-xl shadow-success/30 flex justify-between items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-tighter opacity-80">Aporte total a mi meta</p>
                <h4 className="text-4xl font-black tracking-tighter">${(formData.comision + formData.utilidad).toLocaleString()}</h4>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold opacity-60">Rentabilidad sobre Venta</p>
                <p className="text-xl font-black">{((formData.comision + formData.utilidad) / formData.total * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: VOUCHER OPCIONAL */}
          <div className="space-y-6 pt-4">
            <label className="flex items-center gap-4 cursor-pointer group bg-primary/5 p-6 rounded-3xl border border-primary/10 hover:bg-primary/10 transition-all">
              <input 
                type="checkbox" 
                className="w-8 h-8 rounded-xl border-gray-300 text-primary focus:ring-primary"
                checked={formData.generar_voucher}
                onChange={e => setFormData({...formData, generar_voucher: e.target.checked})}
              />
              <div>
                <p className="text-lg font-black text-primary uppercase tracking-tighter">¿Generar Voucher de Seguridad QR?</p>
                <p className="text-xs text-primary/60 font-medium">Activa este certificado para control en destino y seguridad del pasajero.</p>
              </div>
            </label>

            {formData.generar_voucher && (
              <div className="grid grid-cols-2 gap-6 bg-white p-8 rounded-[2.5rem] border-2 border-primary/10 animate-in slide-in-from-top-4 duration-300 shadow-xl">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Fecha Inicio Viaje</label>
                  <input type="date" required className="input font-bold" value={formData.fecha_viaje_desde} onChange={e => setFormData({...formData, fecha_viaje_desde: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Fecha Fin Viaje</label>
                  <input type="date" required className="input font-bold" value={formData.fecha_viaje_hasta} onChange={e => setFormData({...formData, fecha_viaje_hasta: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-danger uppercase tracking-widest block mb-2">Caducidad del Voucher</label>
                  <input type="date" required className="input font-bold border-danger/20" value={formData.fecha_caducidad_voucher} onChange={e => setFormData({...formData, fecha_caducidad_voucher: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Instrucciones Especiales</label>
                  <textarea className="input min-h-[100px] text-sm" placeholder="Ej: Presentar en recepción..." value={formData.notas_voucher} onChange={e => setFormData({...formData, notas_voucher: e.target.value})} />
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-6 rounded-[2rem] text-xl font-black uppercase tracking-tighter shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
          >
            {loading ? 'Procesando Venta...' : <><Save size={24} /> Finalizar y Cerrar Negocio</>}
          </button>
        </form>
      </div>

      <style jsx>{`
        .input-minimal {
          width: 100%;
          background: transparent;
          border: none;
          padding: 8px 4px;
          outline: none;
          transition: all 0.2s;
        }
        .input-minimal:focus {
          background: white;
          border-radius: 8px;
          padding: 8px 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
      `}</style>
    </div>
  )
}
