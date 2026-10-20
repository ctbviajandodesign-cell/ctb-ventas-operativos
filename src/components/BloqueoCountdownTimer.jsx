'use client'

import React from 'react'
import { format, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, CheckCircle2, Rocket } from 'lucide-react'

function parseSafeDate(fechaStr) {
  if (!fechaStr) return null
  try {
    const str = String(fechaStr).trim()
    if (!str) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const d = new Date(str + 'T00:00:00')
      return isNaN(d.getTime()) ? null : d
    }
    const clean = str.replace(' ', 'T')
    const d = new Date(clean)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/**
 * Indicador ultra-rápido de tiempo restante para bloqueos.
 * Sin setInterval ni consumo de CPU/hilo principal. Renderizado estático instantáneo.
 */
export default function BloqueoCountdownTimer({ fechaSalida, className = '' }) {
  if (!fechaSalida) return null

  const target = parseSafeDate(fechaSalida)
  if (!target) return null

  const today = new Date()
  const daysDiff = differenceInCalendarDays(target, today)

  let formattedDate = ''
  try {
    formattedDate = format(target, "d 'de' MMMM", { locale: es })
  } catch {
    formattedDate = String(fechaSalida)
  }

  // 1. VIAJE CONCLUIDO
  if (daysDiff < 0) {
    const daysAgo = Math.abs(daysDiff)
    return (
      <div className={`mt-3 flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs ${className}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <CheckCircle2 size={14} className="text-gray-400 shrink-0" />
          <span className="font-bold text-gray-700 truncate">Viaje Concluido</span>
          <span className="text-gray-400 text-[11px] shrink-0">({daysAgo === 1 ? 'ayer' : `hace ${daysAgo}d`})</span>
        </div>
        <span className="text-[11px] text-gray-500 font-medium shrink-0 ml-2">{formattedDate}</span>
      </div>
    )
  }

  // 2. EL VIAJE ES HOY
  if (daysDiff === 0) {
    return (
      <div className={`mt-3 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs shadow-xs ${className}`}>
        <div className="flex items-center gap-2 font-black">
          <Rocket size={15} className="text-emerald-600" />
          <span>¡EL VIAJE SALE HOY!</span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
          Despegue Hoy
        </span>
      </div>
    )
  }

  // 3. SALIDA MAÑANA
  if (daysDiff === 1) {
    return (
      <div className={`mt-3 flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs ${className}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Clock size={14} className="text-amber-600 shrink-0" />
          <span className="font-black text-amber-900">Salida Mañana</span>
          <span className="text-amber-700 text-[11px] truncate">· Menos de 24h</span>
        </div>
        <span className="text-[11px] font-bold text-amber-800 shrink-0 ml-2">{formattedDate}</span>
      </div>
    )
  }

  // 4. FALTAN X DÍAS (LIGERO Y ELEGANTE)
  const isUrgent = daysDiff <= 7
  const isApproaching = daysDiff > 7 && daysDiff <= 20

  const badgeTheme = isUrgent
    ? 'bg-rose-50/70 border-rose-200/80 text-rose-950'
    : isApproaching
    ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
    : 'bg-blue-50/50 border-blue-200/70 text-blue-950'

  const clockColor = isUrgent ? 'text-rose-600' : isApproaching ? 'text-amber-600' : 'text-blue-600'
  const pillTheme = isUrgent
    ? 'bg-rose-100 text-rose-800 border-rose-200'
    : isApproaching
    ? 'bg-amber-100 text-amber-800 border-amber-200'
    : 'bg-blue-100 text-blue-800 border-blue-200'

  return (
    <div className={`mt-3 flex items-center justify-between px-3 py-2 rounded-xl border ${badgeTheme} text-xs transition-colors ${className}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Clock size={14} className={`${clockColor} shrink-0`} />
        <span className="font-bold tracking-tight text-gray-900 truncate">
          Falta{daysDiff === 1 ? '' : 'n'} <strong className="font-black underline decoration-2 underline-offset-2">{daysDiff} días</strong> para el viaje
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${pillTheme} hidden sm:inline`}>
          {isUrgent ? 'Última semana' : isApproaching ? 'Próximo' : 'En agenda'}
        </span>
        <span className="text-[11px] text-gray-500 font-semibold">{formattedDate}</span>
      </div>
    </div>
  )
}
