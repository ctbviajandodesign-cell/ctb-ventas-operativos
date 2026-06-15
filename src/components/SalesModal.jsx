'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  X, Calendar, DollarSign, Plus, Trash2, 
  CheckCircle2, AlertCircle, Hotel, Bus, Plane, Map,
  QrCode, ExternalLink, Sparkles, User
} from 'lucide-react'
import Link from 'next/link'
import { showToast } from '@/utils/toast'

export default function SalesModal() {
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [existingVoucher, setExistingVoucher] = useState(null)
  const isEditing = !!quote?.existingSale

  const [milestones, setMilestones] = useState([
    { id: Date.now(), label: 'Primer Pago', amount: 0, percent: 0, date: new Date().toISOString().split('T')[0], status: 'pagado', method: 'efectivo' }
  ])
  const [inclusions, setInclusions] = useState({ hotel: true, traslados: false, boletos: false, tours: false, seguro: false })
  const [formData, setFormData] = useState({
    total: 0, comision: 0, utilidad: 0, bono_counter: 0,
    generar_voucher: false, numero_proforma: '',
    fecha_viaje_desde: '', fecha_viaje_hasta: '',
    fecha_caducidad_voucher: '', notas_voucher: '',
    pasajeros_voucher: '',
    recordatorio_dias_antes: '',
    recordatorio_texto: ''
  })

  useEffect(() => {
    const handleOpen = async (e) => {
      const q = e.detail
      setExistingVoucher(null)
      setQuote(q)
      const initialTotal = q.valor_total || q.total || 0

      if (q.existingSale) {
        const s = q.existingSale
        setFormData({
          total: s.total || initialTotal,
          comision: s.comision || 0,
          utilidad: s.utilidad || 0,
          bono_counter: s.bono_counter || 0,
          generar_voucher: false,
          numero_proforma: s.numero_proforma || q.codigo || '',
          fecha_viaje_desde: '', fecha_viaje_hasta: '',
          fecha_caducidad_voucher: '', notas_voucher: '',
          pasajeros_voucher: Array.isArray(q.nombres_pasajeros) ? q.nombres_pasajeros.join('\n') : (q.nombres_pasajeros || ''),
          agencia: q.cotizaciones?.agencia || q.agencia || '',
          destino: q.cotizaciones?.destino || q.destino || ''
        })
        if (s.plan_pagos?.length) setMilestones(s.plan_pagos)
        else setMilestones([{ id: Date.now(), label: 'Primer Pago', amount: s.total || 0, percent: 100, date: new Date().toISOString().split('T')[0], status: 'pagado', method: 'efectivo' }])

        // Cargar voucher existente
        const { data: voucher } = await supabase
          .from('vouchers')
          .select('id, codigo, estado, pasajeros')
          .eq('venta_id', s.id)
          .single()
        if (voucher) {
          setExistingVoucher(voucher)
          if (voucher.pasajeros) {
            setFormData(prev => ({ ...prev, pasajeros_voucher: Array.isArray(voucher.pasajeros) ? voucher.pasajeros.join('\n') : voucher.pasajeros }))
          }
        }
      } else {
        setFormData({
          total: initialTotal,
          comision: q.valor_comision || 0,
          utilidad: q.valor_utilidad || 0,
          bono_counter: q.valor_bono || 0,
          generar_voucher: false,
          numero_proforma: q.codigo || '',
          fecha_viaje_desde: q.fecha_viaje_desde || '',
          fecha_viaje_hasta: q.fecha_viaje_hasta || '',
          fecha_caducidad_voucher: '', notas_voucher: '',
          pasajeros_voucher: Array.isArray(q.nombres_pasajeros) ? q.nombres_pasajeros.join('\n') : (q.nombres_pasajeros || ''),
          agencia: q.cotizaciones?.agencia || q.agencia || '',
          destino: q.cotizaciones?.destino || q.destino || ''
        })
        setMilestones([
          { id: Date.now(), label: 'Primer Pago', amount: initialTotal, percent: 100, date: new Date().toISOString().split('T')[0], status: 'pagado', method: 'efectivo' }
        ])
      }
    }
    window.addEventListener('open-sales-modal', handleOpen)
    return () => window.removeEventListener('open-sales-modal', handleOpen)
  }, [])

  const updateMilestone = (id, field, value) => {
    setMilestones(milestones.map(m => {
      if (m.id !== id) return m
      const newM = { ...m, [field]: value }
      const t = Number(formData.total) || 0
      if (field === 'percent') newM.amount = ((Number(value) || 0) / 100) * t
      else if (field === 'amount') newM.percent = t > 0 ? ((Number(value) || 0) / t) * 100 : 0
      return newM
    }))
  }

  const totalPaid = milestones.filter(m => m.status === 'pagado').reduce((acc, m) => acc + (Number(m.amount) || 0), 0)
  const faltante = (Number(formData.total) || 0) - totalPaid

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión activa')

      const pasajerosArr = formData.pasajeros_voucher ? formData.pasajeros_voucher.split('\n').map(s => s.trim()).filter(Boolean) : []

      const payload = {
        total: Number(formData.total) || 0,
        comision: Number(formData.comision) || 0,
        utilidad: Number(formData.utilidad) || 0,
        bono_counter: Number(formData.bono_counter) || 0,
        plan_pagos: milestones,
        abono_tarjeta: milestones.filter(m => m.status === 'pagado' && m.method === 'tarjeta').reduce((acc, m) => acc + (Number(m.amount) || 0), 0),
        abono_1: milestones.filter(m => m.status === 'pagado' && m.method !== 'tarjeta')[0]?.amount || 0,
        abono_2: milestones.filter(m => m.status === 'pagado' && m.method !== 'tarjeta').slice(1).reduce((acc, m) => acc + (Number(m.amount) || 0), 0),
        estado: 'activa'
      }

      let ventaId = quote.existingSale?.id

      if (isEditing) {
        const { error } = await supabase.from('ventas').update(payload).eq('id', ventaId)
        if (error) throw error
        // Actualizar cotización original con los valores reales
        await supabase.from('cotizaciones').update({
          valor_total: Number(formData.total) || 0,
          valor_comision: Number(formData.comision) || 0,
          valor_utilidad: Number(formData.utilidad) || 0,
          valor_bono: Number(formData.bono_counter) || 0,
          nombres_pasajeros: pasajerosArr,
          numero_pasajeros: pasajerosArr.length > 0 ? pasajerosArr.length : (quote.numero_pasajeros || 1),
          agencia: formData.agencia,
          destino: formData.destino,
          codigo: formData.numero_proforma
        }).eq('id', quote.id)
      } else {
        const { data: venta, error: vError } = await supabase
          .from('ventas')
          .insert([{ ...payload, cotizacion_id: quote.id, operativo_id: user.id, numero_proforma: formData.numero_proforma }])
          .select().single()
        if (vError) throw vError
        ventaId = venta.id

        await supabase.from('cotizaciones').update({ 
          estado: 'ganada',
          valor_total: Number(formData.total) || 0,
          valor_comision: Number(formData.comision) || 0,
          valor_utilidad: Number(formData.utilidad) || 0,
          valor_bono: Number(formData.bono_counter) || 0,
          nombres_pasajeros: pasajerosArr,
          numero_pasajeros: pasajerosArr.length > 0 ? pasajerosArr.length : (quote.numero_pasajeros || 1),
          agencia: formData.agencia,
          destino: formData.destino,
          codigo: formData.numero_proforma
        }).eq('id', quote.id)
      }

      // ── Notificación Telegram (tanto para venta nueva como corregida) ──────────────────────────────
      try {
        const opId = quote.existingSale?.operativo_id || user.id
        const { data: profileData } = await supabase
          .from('profiles')
          .select('nombre, ciudad, meta_mensual')
          .eq('id', opId)
          .single()

        // Calcular % de meta del mes actual
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
        const { data: ventasMes } = await supabase
          .from('ventas')
          .select('comision, utilidad')
          .eq('operativo_id', opId)
          .eq('estado', 'activa')
          .gte('created_at', startOfMonth.toISOString())

        const aporteTotal = ventasMes?.reduce((a, v) => a + (Number(v.comision)||0) + (Number(v.utilidad)||0), 0) || 0
        const meta = Number(profileData?.meta_mensual || 5000)
        const metaPct = meta > 0 ? (aporteTotal / meta) * 100 : 0

        fetch('/api/notify/venta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operativo: profileData?.nombre || 'Asesor',
            ciudad: profileData?.ciudad || '',
            destino: quote.destino || 'N/A',
            agencia: quote.agencia || 'Directo',
            valorTotal: Number(formData.total) || 0,
            metaPct,
            meta,
            aporteVenta: Number(formData.comision || 0) + Number(formData.utilidad || 0),
            operativoId: opId,
            isEdit: isEditing
          })
        }).catch(err => console.warn('Telegram notify skipped:', err))
      } catch (notifyErr) {
        console.warn('Telegram notify error:', notifyErr)
      }

      // Solo crear voucher si es nueva venta y se marcó la opción
      if (!isEditing && formData.generar_voucher) {
        const { error: vchError } = await supabase.from('vouchers').insert([{
          venta_id: ventaId,
          operativo_id: user.id,
          codigo: `VCH-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          estado: 'activo',
          fecha_viaje_desde: formData.fecha_viaje_desde || null,
          fecha_viaje_hasta: formData.fecha_viaje_hasta || null,
          fecha_caducidad: formData.fecha_viaje_hasta || null,
          inclusiones: inclusions,
          notas: formData.notas_voucher,
          agencia: quote.agencia,
          valor_total: Number(formData.total) || 0,
          pasajeros: pasajerosArr,
          destino: quote.destino,
          recordatorio_dias_antes: formData.recordatorio_dias_antes ? Number(formData.recordatorio_dias_antes) : null,
          recordatorio_texto: formData.recordatorio_texto || null
        }])
        if (vchError) throw vchError
        window.location.href = '/dashboard/vouchers'
        return
      }


      window.location.reload()
    } catch (error) {
      console.error('Error en cierre:', error)
      showToast(error.message || 'Error desconocido', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!quote) return null

  const incIcons = { hotel: Hotel, traslados: Bus, boletos: Plane, tours: Map, seguro: AlertCircle }

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">

        {/* HEADER — diferente según modo */}
        <div className={`p-7 text-white flex justify-between items-start ${isEditing ? 'bg-gray-900' : 'bg-primary'}`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isEditing
                ? <span className="text-xs font-black bg-white/10 px-2.5 py-1 rounded-full uppercase tracking-widest">Editar Venta Existente</span>
                : <span className="text-xs font-black bg-white/20 px-2.5 py-1 rounded-full uppercase tracking-widest">✦ Nueva Venta</span>
              }
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">
              {isEditing ? 'Actualizar Venta' : 'Confirmar Venta'}
            </h2>
            <p className="text-xs opacity-90 uppercase tracking-widest mt-1.5">
              Ref: {quote.existingSale?.numero_proforma || quote.codigo}
              {quote.cotizaciones?.agencia || quote.agencia ? ` · ${quote.cotizaciones?.agencia || quote.agencia}` : ''}
            </p>

          </div>
          <button onClick={() => setQuote(null)} className="p-2 hover:rotate-90 hover:bg-white/10 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-7 space-y-7">

          {/* OBSERVACIONES DE LA COTIZACIÓN */}
          {(quote?.notas_iniciales || quote?.cotizaciones?.notas_iniciales) && (
            <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1.5">
                Observaciones / Especificaciones del Programa
              </p>
              <p className="text-xs text-gray-750 font-medium whitespace-pre-wrap break-words">
                {quote.notas_iniciales || quote.cotizaciones?.notas_iniciales}
              </p>
            </div>
          )}

          {/* VOUCHER EXISTENTE — solo en modo edición */}
          {isEditing && existingVoucher && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-5 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <QrCode size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Voucher emitido</p>
                  <p className="font-black text-gray-900">{existingVoucher.codigo}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase ${existingVoucher.estado === 'activo' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {existingVoucher.estado}
                </span>
                <Link href="/dashboard/vouchers" className="flex items-center gap-1.5 text-xs font-black text-primary bg-primary/10 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition-colors">
                  Ver Voucher <ExternalLink size={12} />
                </Link>
              </div>
            </div>

          )}

          {/* SIN VOUCHER — modo edición sin voucher creado */}
          {isEditing && !existingVoucher && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 p-4 rounded-2xl">
              <AlertCircle size={18} className="text-amber-500 shrink-0" />
              <p className="text-xs font-bold text-amber-700">Esta venta no tiene voucher emitido. Puedes guardar los cambios sin problema.</p>
            </div>
          )}

          {/* DATOS DE LA PROFORMA */}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Map size={16} /> Datos de la Proforma
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase mb-1">Ref / Código</p>
                <input 
                  type="text" 
                  className="bg-transparent border-none font-black text-gray-900 text-sm p-0 w-full outline-none" 
                  value={formData.numero_proforma} 
                  onChange={e => setFormData({ ...formData, numero_proforma: e.target.value })} 
                />
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase mb-1">Agencia / Cliente</p>
                <input 
                  type="text" 
                  className="bg-transparent border-none font-black text-gray-900 text-sm p-0 w-full outline-none" 
                  value={formData.agencia} 
                  onChange={e => setFormData({ ...formData, agencia: e.target.value })} 
                />
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase mb-1">Destino</p>
                <input 
                  type="text" 
                  className="bg-transparent border-none font-black text-gray-900 text-sm p-0 w-full outline-none" 
                  value={formData.destino} 
                  onChange={e => setFormData({ ...formData, destino: e.target.value })} 
                />
              </div>
            </div>
          </div>

          {/* VALORES FINANCIEROS */}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <DollarSign size={16} /> Valores Financieros
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase mb-1">Total Venta</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-gray-400 font-bold">$</span>
                  <input type="number" step="0.01" className="bg-transparent border-none font-black text-gray-900 text-xl p-0 w-full outline-none" value={formData.total} onChange={e => setFormData({ ...formData, total: e.target.value })} />
                </div>
              </div>
              <div className="bg-success/5 p-4 rounded-2xl border border-success/10">
                <p className="text-xs font-black text-success/80 uppercase mb-1">Comisión</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-success/80 font-bold">$</span>
                  <input type="number" step="0.01" className="bg-transparent border-none font-black text-success text-xl p-0 w-full outline-none" value={formData.comision} onChange={e => setFormData({ ...formData, comision: e.target.value })} />
                </div>
              </div>
              <div className="bg-success/5 p-4 rounded-2xl border border-success/10">
                <p className="text-xs font-black text-success/80 uppercase mb-1">Utilidad</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-success/80 font-bold">$</span>
                  <input type="number" step="0.01" className="bg-transparent border-none font-black text-success text-xl p-0 w-full outline-none" value={formData.utilidad} onChange={e => setFormData({ ...formData, utilidad: e.target.value })} />
                </div>
              </div>
              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                <p className="text-xs font-black text-primary/80 uppercase mb-1">Bono Counter</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-primary font-bold">$</span>
                  <input type="number" step="0.01" className="bg-transparent border-none font-black text-primary text-xl p-0 w-full outline-none" value={formData.bono_counter} onChange={e => setFormData({ ...formData, bono_counter: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* NOMBRES DE PASAJEROS */}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <User size={16} /> Nombres de Pasajeros / Nombre de Grupo
            </p>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <textarea 
                className="bg-transparent border-none font-black text-gray-900 text-sm p-0 w-full outline-none resize-y min-h-[60px]" 
                placeholder="Juan Pérez&#10;Familia García..." 
                value={formData.pasajeros_voucher} 
                onChange={e => setFormData({ ...formData, pasajeros_voucher: e.target.value })} 
              />
              <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Un nombre por línea. Esto actualizará la proforma original y el voucher si existe.</p>
            </div>
          </div>


          {/* PLAN DE PAGOS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={16} /> Plan de Pagos
              </p>
              <button type="button" onClick={() => {
                const count = milestones.length + 1
                let nextLabel = 'Pago ' + count
                if (count === 1) nextLabel = 'Primer Pago'
                else if (count === 2) nextLabel = 'Pago Dos'
                else if (count === 3) nextLabel = 'Pago Tres'
                else if (count === 4) nextLabel = 'Pago Cuatro'
                else if (count === 5) nextLabel = 'Pago Cinco'
                else if (count === 6) nextLabel = 'Pago Seis'
                else if (count === 7) nextLabel = 'Pago Siete'
                else if (count === 8) nextLabel = 'Pago Ocho'
                else if (count === 9) nextLabel = 'Pago Nueve'
                else if (count === 10) nextLabel = 'Pago Diez'
                setMilestones([...milestones, { id: Date.now(), label: nextLabel, amount: 0, percent: 0, date: '', status: 'pendiente', method: 'transferencia' }])
              }}
                className="text-xs font-black text-primary bg-primary/5 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors">
                + Añadir pago
              </button>
            </div>

            {/* Barra de progreso de pagos */}
            <div className="mb-3 bg-gray-100 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${Math.min((totalPaid / (Number(formData.total) || 1)) * 100, 100)}%` }}></div>
            </div>
            <div className="flex justify-between text-xs font-black uppercase mb-4">
              <span className="text-success">Cobrado: ${totalPaid.toLocaleString()}</span>
              <span className={faltante > 0 ? 'text-amber-600' : 'text-success'}>{faltante > 0 ? `Pendiente: $${faltante.toLocaleString()}` : '✓ Pagado completo'}</span>
            </div>

            <div className="space-y-2">
              {milestones.map(m => (
                <div key={m.id} className={`grid grid-cols-12 gap-2 p-3.5 rounded-2xl border transition-all ${m.status === 'pagado' ? 'bg-success/5 border-success/20' : 'bg-amber-50/50 border-amber-100'}`}>
                  <div className="col-span-3">
                    <input className="bg-transparent border-none text-xs font-black w-full outline-none" value={m.label} onChange={e => updateMilestone(m.id, 'label', e.target.value)} />
                  </div>
                  <div className="col-span-2 relative">
                    <span className="absolute left-1 top-2 text-xs text-gray-400">$</span>
                    <input type="number" className="bg-white border-none rounded-lg text-xs font-black w-full pl-4 py-1.5 outline-none" value={m.amount} onChange={e => updateMilestone(m.id, 'amount', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <input type="date" className="bg-white border-none rounded-lg text-xs font-bold w-full py-1.5 px-2 outline-none" value={m.date} onChange={e => updateMilestone(m.id, 'date', e.target.value)} />
                  </div>
                  <div className="col-span-3">
                    <select
                      className="bg-white border-none rounded-lg text-[10px] font-bold w-full py-1.5 px-1 outline-none text-gray-700"
                      value={m.method || 'transferencia'}
                      onChange={e => updateMilestone(m.id, 'method', e.target.value)}
                    >
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="transferencia">🏦 Transferencia</option>
                      <option value="tarjeta">💳 Tarjeta</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex justify-end gap-1 items-center">
                    <button type="button" onClick={() => updateMilestone(m.id, 'status', m.status === 'pagado' ? 'pendiente' : 'pagado')}
                      className={`p-1.5 rounded-lg transition-all ${m.status === 'pagado' ? 'text-success bg-white shadow-sm' : 'text-gray-300 hover:text-success'}`}>
                      <CheckCircle2 size={18} />
                    </button>
                    <button type="button" onClick={() => setMilestones(milestones.filter(x => x.id !== m.id))} className="text-gray-300 hover:text-danger p-1.5 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* OPCIÓN DE VOUCHER — solo si es nueva venta */}
          {!isEditing && (
            <div className="space-y-4">
              <label className="flex items-center gap-4 cursor-pointer bg-primary/5 p-5 rounded-2xl border border-primary/20 hover:border-primary/40 transition-colors">
                <input type="checkbox" className="w-6 h-6 rounded-lg accent-primary" checked={formData.generar_voucher} onChange={e => setFormData({ ...formData, generar_voucher: e.target.checked })} />
                <div>
                  <p className="font-black text-primary uppercase tracking-tighter flex items-center gap-2">
                    <QrCode size={16} /> Generar Voucher con código QR
                  </p>
                  <p className="text-xs text-primary/60 mt-0.5">Crea el voucher oficial para el pasajero</p>
                </div>
              </label>

              {formData.generar_voucher && (
                <div className="space-y-5 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(incIcons).map(([item, Icon]) => (
                      <button key={item} type="button" onClick={() => setInclusions({ ...inclusions, [item]: !inclusions[item] })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-xs ${inclusions[item] ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}>
                        <Icon size={18} />
                        <span className="text-xs font-black uppercase">{item}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-gray-400 uppercase">Inicio del viaje</label>
                      <input type="date" className="input font-bold mt-1 text-xs" value={formData.fecha_viaje_desde} onChange={e => setFormData({ ...formData, fecha_viaje_desde: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-400 uppercase">Fin del viaje</label>
                      <input type="date" className="input font-bold mt-1 text-xs" value={formData.fecha_viaje_hasta} onChange={e => setFormData({ ...formData, fecha_viaje_hasta: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-black text-gray-400 uppercase">Notas para el pasajero</label>
                      <textarea className="input text-xs mt-1 min-h-[70px]" placeholder="Indicaciones, observaciones..." value={formData.notas_voucher} onChange={e => setFormData({ ...formData, notas_voucher: e.target.value })} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs font-black text-gray-400 uppercase">Días para Aviso</label>
                      <input type="number" min="0" className="input font-bold mt-1 text-xs" placeholder="Ej: 5" value={formData.recordatorio_dias_antes} onChange={e => setFormData({ ...formData, recordatorio_dias_antes: e.target.value })} />
                      <p className="text-[10px] text-gray-400 mt-1">Aviso telegram antes de viaje</p>
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs font-black text-gray-400 uppercase">Nota de aviso</label>
                      <input type="text" className="input font-bold mt-1 text-xs" placeholder="Ej: Pago de hotel" value={formData.recordatorio_texto} onChange={e => setFormData({ ...formData, recordatorio_texto: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          <button type="submit" disabled={loading}
            className={`w-full py-5 rounded-2xl text-lg font-black uppercase tracking-tighter shadow-xl transition-all hover:scale-[1.01] active:scale-95 text-white ${isEditing ? 'bg-gray-900 shadow-gray-900/20' : 'bg-primary shadow-primary/30'}`}>
            {loading ? 'Guardando...' : isEditing ? '✓ Guardar Cambios' : formData.generar_voucher ? '✦ Confirmar Venta y Emitir Voucher' : '✓ Confirmar Venta'}
          </button>
        </form>
      </div>
    </div>
  )
}
