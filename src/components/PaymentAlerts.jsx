'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, Clock, DollarSign, ArrowRight, CheckCircle2 } from 'lucide-react'
import { showToast } from '@/utils/toast'

export default function PaymentAlerts({ userId, isAdmin }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    fetchAlerts()
  }, [userId])


  async function fetchAlerts() {
    try {
      let query = supabase
        .from('ventas')
        .select(`
          id, 
          total, 
          plan_pagos, 
          numero_proforma,
          cotizaciones(nombres_pasajeros, destino)
        `)
        .not('plan_pagos', 'is', null)
        .eq('estado', 'activa')

      if (!isAdmin) {
        query = query.eq('operativo_id', userId)
      }

      const { data, error } = await query
      if (error) throw error

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const upcoming = []

      data.forEach(venta => {
        if (Array.isArray(venta.plan_pagos)) {
          venta.plan_pagos.forEach(milestone => {
            if (milestone.status === 'pendiente' && milestone.date) {
              const mDate = new Date(milestone.date)
              mDate.setHours(0, 0, 0, 0)

              // Si vence hoy o ya venció
              if (mDate <= today) {
                upcoming.push({
                  ventaId: venta.id,
                  proforma: venta.numero_proforma,
                  pasajero: venta.cotizaciones?.nombres_pasajeros || 'N/A',
                  monto: milestone.amount,
                  fecha: milestone.date,
                  label: milestone.label,
                  isOverdue: mDate < today
                })
              }
            }
          })
        }
      })

      // Ordenar por fecha (más antiguos primero)
      setAlerts(upcoming.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)))
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsPaid = async (ventaId, milestoneLabel) => {
    setUpdatingId(`${ventaId}-${milestoneLabel}`)
    try {
      // Obtener el plan de pagos actual
      const { data: venta, error: fetchErr } = await supabase
        .from('ventas')
        .select('plan_pagos')
        .eq('id', ventaId)
        .single()

      if (fetchErr) throw fetchErr

      const updatedPlan = (venta.plan_pagos || []).map(m => {
        if (m.label === milestoneLabel) {
          return { ...m, status: 'pagado' }
        }
        return m
      })

      const { error: updateErr } = await supabase
        .from('ventas')
        .update({ plan_pagos: updatedPlan })
        .eq('id', ventaId)

      if (updateErr) throw updateErr

      showToast('Hito de pago registrado como pagado', 'success')
      // Refrescar alertas
      fetchAlerts()
    } catch (err) {
      console.error('Error actualizando hito de pago:', err)
      showToast('Error al marcar como pagado: ' + err.message, 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) return null


  if (alerts.length === 0) return (
    <div className="card border-success/20 bg-success/5 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <div className="bg-success p-3 rounded-2xl text-white shadow-lg shadow-success/20">
          <CheckCircle2 size={24} />
        </div>
        <div>
          <h3 className="font-black text-success uppercase tracking-tighter leading-none">Cartera Limpia</h3>
          <p className="text-xs font-bold text-success/60 uppercase tracking-widest mt-1.5">No hay cobros pendientes para hoy</p>
        </div>

      </div>
    </div>
  )

  return (
    <div className="card border-amber-200 bg-amber-50/30 animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-amber-700 flex items-center gap-2 uppercase tracking-tighter">
          <AlertTriangle size={20} className="text-amber-500" />
          Radar de Cobros Pendientes
        </h3>
        <span className="bg-amber-100 text-amber-700 text-xs font-black px-2.5 py-1 rounded-full uppercase">
          {alerts.length} Alertas
        </span>
      </div>


      <div className="space-y-3">
        {alerts.slice(0, 4).map((alert, idx) => {
          const pasajeroName = Array.isArray(alert.pasajero) ? alert.pasajero[0] : alert.pasajero
          return (
            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-amber-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${alert.isOverdue ? 'bg-danger/10 text-danger' : 'bg-amber-100 text-amber-600'}`}>
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900 leading-none mb-1">
                    {pasajeroName?.split(',')[0] || 'N/A'}
                  </p>
                  <p className="text-xs font-bold text-gray-400 uppercase">
                    {alert.label} • {alert.proforma}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-sm font-black text-gray-900">${(Number(alert.monto) || 0).toLocaleString()}</p>
                  <p className={`text-xs font-black uppercase ${alert.isOverdue ? 'text-danger' : 'text-amber-600'}`}>
                    {alert.isOverdue ? 'Vencido' : 'Vence Hoy'}
                  </p>
                </div>
                <button
                  onClick={() => handleMarkAsPaid(alert.ventaId, alert.label)}
                  disabled={updatingId === `${alert.ventaId}-${alert.label}`}
                  className="p-2 bg-success/10 hover:bg-success text-success hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center disabled:opacity-50"
                  title="Marcar como Cobrado / Pagado"
                >
                  {updatingId === `${alert.ventaId}-${alert.label}` ? (
                    <div className="w-4 h-4 border-2 border-success border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </button>
              </div>

            </div>

          )
        })}
      </div>

      {alerts.length > 4 && (
        <p className="text-center text-xs font-bold text-gray-400 mt-4 uppercase">
          + {alerts.length - 4} cobros más pendientes
        </p>
      )}

    </div>
  )
}
