'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, Clock, DollarSign, ArrowRight } from 'lucide-react'

export default function PaymentAlerts({ userId, isAdmin }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

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

  if (loading || alerts.length === 0) return null

  return (
    <div className="card border-amber-200 bg-amber-50/30 animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-amber-700 flex items-center gap-2 uppercase tracking-tighter">
          <AlertTriangle size={20} className="text-amber-500" />
          Radar de Cobros Pendientes
        </h3>
        <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-full uppercase">
          {alerts.length} Alertas
        </span>
      </div>

      <div className="space-y-3">
        {alerts.slice(0, 4).map((alert, idx) => (
          <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-amber-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${alert.isOverdue ? 'bg-danger/10 text-danger' : 'bg-amber-100 text-amber-600'}`}>
                <Clock size={16} />
              </div>
              <div>
                <p className="text-[11px] font-black text-gray-900 leading-none mb-1">
                  {alert.pasajero.split(',')[0]}
                </p>
                <p className="text-[9px] font-bold text-gray-400 uppercase">
                  {alert.label} • {alert.proforma}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-gray-900">${alert.monto.toLocaleString()}</p>
              <p className={`text-[9px] font-black uppercase ${alert.isOverdue ? 'text-danger' : 'text-amber-600'}`}>
                {alert.isOverdue ? 'Vencido' : 'Vence Hoy'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {alerts.length > 4 && (
        <p className="text-center text-[10px] font-bold text-gray-400 mt-4 uppercase">
          + {alerts.length - 4} cobros más pendientes
        </p>
      )}
    </div>
  )
}
