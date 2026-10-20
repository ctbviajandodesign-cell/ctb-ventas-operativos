'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Timer, CheckCircle2, Rocket, Calendar } from 'lucide-react'

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

function calculateTimeLeft(fechaSalida) {
  const target = parseSafeDate(fechaSalida)
  if (!target) return null

  const now = new Date()
  const diffMs = target.getTime() - now.getTime()

  // Comprobar si hoy es exactamente el día del viaje
  const isToday =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()

  if (isToday) {
    return { isToday: true, isPast: false, totalDays: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  }

  if (diffMs < 0) {
    return { isToday: false, isPast: true, totalDays: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60)
  const seconds = Math.floor((diffMs / 1000) % 60)

  return {
    isToday: false,
    isPast: false,
    totalDays: days,
    days,
    hours,
    minutes,
    seconds
  }
}

export default function BloqueoCountdownTimer({ fechaSalida, className = '' }) {
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState(() => calculateTimeLeft(fechaSalida))

  useEffect(() => {
    setMounted(true)
    const initial = calculateTimeLeft(fechaSalida)
    setTime(initial)
    if (!initial || initial.isPast) {
      return
    }

    const interval = setInterval(() => {
      setTime(prev => {
        const next = calculateTimeLeft(fechaSalida)
        if (!prev && !next) return prev
        if (!prev || !next) return next
        if (next.isPast) {
          clearInterval(interval)
          return next
        }
        if (
          prev.seconds === next.seconds &&
          prev.minutes === next.minutes &&
          prev.hours === next.hours &&
          prev.days === next.days &&
          prev.isToday === next.isToday &&
          prev.isPast === next.isPast
        ) {
          return prev
        }
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [fechaSalida])

  if (!fechaSalida) return null

  // Parse target date safely
  const salidaDate = parseSafeDate(fechaSalida)
  let formattedDate = 'Por definir'
  let dayName = ''

  if (salidaDate) {
    try {
      formattedDate = format(salidaDate, "d MMM yyyy", { locale: es })
      dayName = format(salidaDate, "EEEE", { locale: es })
    } catch (e) {
      formattedDate = String(fechaSalida)
    }
  }

  // Skeleton / SSR safe rendering
  if (!mounted || !time) {
    return (
      <div className={`mt-3.5 bg-slate-50/80 rounded-2xl p-3 border border-slate-200/80 ${className}`}>
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80 text-[11px] text-slate-400 font-bold">
          <span>Salida: {formattedDate}</span>
          <span className="text-[9px] uppercase px-2 py-0.5 rounded-full bg-slate-200/60 text-slate-500">
            Calculando...
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 animate-pulse">
          <div className="h-14 bg-white rounded-xl border border-slate-200/60"></div>
          <div className="h-14 bg-white rounded-xl border border-slate-200/60"></div>
          <div className="h-14 bg-white rounded-xl border border-slate-200/60"></div>
          <div className="h-14 bg-white rounded-xl border border-slate-200/60"></div>
        </div>
      </div>
    )
  }

  // ESTADO 1: VIAJE CONCLUIDO
  if (time.isPast) {
    return (
      <div className={`mt-3.5 bg-gray-50/90 text-gray-700 rounded-2xl p-3 border border-gray-200/80 flex items-center justify-between shadow-sm ${className}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gray-200/80 text-gray-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block leading-tight">
              Historial de Vuelo
            </span>
            <span className="text-xs font-black text-gray-800">
              Viaje Concluido
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 pl-3 border-l border-gray-200">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
            Fecha Salida
          </span>
          <span className="text-xs font-black text-gray-700 block mt-0.5">
            {formattedDate}
          </span>
        </div>
      </div>
    )
  }

  // ESTADO 2: EL VIAJE ES HOY
  if (time.isToday) {
    return (
      <div className={`mt-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-white text-emerald-950 rounded-2xl p-3.5 border border-emerald-300 shadow-sm ${className}`}>
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-200/70">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
              Operación en Curso
            </span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm animate-pulse">
            🚀 ¡Despegue Hoy!
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <Rocket size={18} className="animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-900 tracking-tight">¡EL VIAJE ES HOY!</p>
              <p className="text-[10px] text-emerald-700 font-medium">Pasajeros en vuelo y operaciones activas.</p>
            </div>
          </div>
          <div className="text-right shrink-0 pl-3 border-l border-emerald-200">
            <span className="text-[9px] font-bold text-emerald-700/80 uppercase tracking-wider block">Fecha</span>
            <span className="text-xs font-black text-emerald-950 block mt-0.5">{formattedDate}</span>
          </div>
        </div>
      </div>
    )
  }

  // ESTADO 3: EN CUENTA REGRESIVA (Definición de temas ligeros y elegantes)
  const isUrgent = time.totalDays <= 7
  const isApproaching = time.totalDays > 7 && time.totalDays <= 20

  const theme = isUrgent
    ? {
        containerBg: 'bg-rose-50/40 border-rose-200/70',
        badge: 'bg-rose-100/80 text-rose-800 border-rose-200',
        statusLabel: 'Última semana',
        secondsHighlight: 'text-rose-600',
        secondsTileBorder: 'border-rose-200',
        dotBg: 'bg-rose-500',
        pulseBg: 'bg-rose-400'
      }
    : isApproaching
    ? {
        containerBg: 'bg-amber-50/40 border-amber-200/70',
        badge: 'bg-amber-100/80 text-amber-800 border-amber-200',
        statusLabel: 'Próximo a salir',
        secondsHighlight: 'text-amber-600',
        secondsTileBorder: 'border-amber-200/80',
        dotBg: 'bg-amber-500',
        pulseBg: 'bg-amber-400'
      }
    : {
        containerBg: 'bg-slate-50/80 border-slate-200/80',
        badge: 'bg-sky-50 text-sky-800 border-sky-200',
        statusLabel: 'En cronograma',
        secondsHighlight: 'text-sky-600',
        secondsTileBorder: 'border-slate-200/80',
        dotBg: 'bg-sky-500',
        pulseBg: 'bg-sky-400'
      }

  return (
    <div className={`mt-3.5 ${theme.containerBg} rounded-2xl p-3 sm:p-3.5 border shadow-sm transition-all ${className}`}>
      {/* Fila Superior: Fecha de Salida + Estado (distribución balanceada con amplio espacio) */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-slate-200/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar size={13} className="text-primary shrink-0" />
          <span className="text-[11px] font-medium text-slate-600 truncate">
            Salida: <strong className="text-slate-900 font-bold">{formattedDate}</strong>
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="text-[10px] text-slate-400 font-semibold capitalize hidden sm:inline">
            {dayName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.pulseBg}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.dotBg}`}></span>
          </span>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${theme.badge}`}>
            {theme.statusLabel}
          </span>
        </div>
      </div>

      {/* Fila Inferior: Cajas Digitales Uniformes en CSS Grid (NUNCA chocan con los bordes) */}
      <div className="grid grid-cols-4 gap-2 text-center font-mono select-none">
        {/* DÍAS */}
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-xl py-1.5 sm:py-2 px-1 flex flex-col items-center justify-center transition-all hover:border-slate-300">
          <span className="font-black text-base sm:text-lg text-slate-900 leading-none">
            {String(time.days).padStart(2, '0')}
          </span>
          <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
            DÍAS
          </span>
        </div>

        {/* HORAS */}
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-xl py-1.5 sm:py-2 px-1 flex flex-col items-center justify-center transition-all hover:border-slate-300">
          <span className="font-black text-base sm:text-lg text-slate-900 leading-none">
            {String(time.hours).padStart(2, '0')}
          </span>
          <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
            HORAS
          </span>
        </div>

        {/* MINUTOS */}
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-xl py-1.5 sm:py-2 px-1 flex flex-col items-center justify-center transition-all hover:border-slate-300">
          <span className="font-black text-base sm:text-lg text-slate-900 leading-none">
            {String(time.minutes).padStart(2, '0')}
          </span>
          <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
            MIN
          </span>
        </div>

        {/* SEGUNDOS (Live ticking con acento sutil) */}
        <div className={`bg-white border ${theme.secondsTileBorder} shadow-sm rounded-xl py-1.5 sm:py-2 px-1 flex flex-col items-center justify-center transition-all`}>
          <span className={`font-black text-base sm:text-lg leading-none ${theme.secondsHighlight}`}>
            {String(time.seconds).padStart(2, '0')}
          </span>
          <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
            SEG
          </span>
        </div>
      </div>
    </div>
  )
}
