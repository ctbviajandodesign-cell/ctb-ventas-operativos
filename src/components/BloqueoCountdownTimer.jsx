'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Timer, CheckCircle2, Rocket, Calendar, Flame, Hourglass } from 'lucide-react'

function calculateTimeLeft(fechaSalida) {
  if (!fechaSalida) return null

  const now = new Date()
  const target = new Date(fechaSalida + 'T00:00:00')
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

export default function BloqueoCountdownTimer({ fechaSalida, compact = false, className = '' }) {
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState(() => calculateTimeLeft(fechaSalida))

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => {
      setTime(calculateTimeLeft(fechaSalida))
    }, 1000)
    return () => clearInterval(interval)
  }, [fechaSalida])

  if (!fechaSalida) return null

  // Safely parse target date
  let salidaDate
  try {
    salidaDate = new Date(fechaSalida + 'T00:00:00')
  } catch (e) {
    salidaDate = new Date()
  }

  const formattedDate = format(salidaDate, "d MMM yyyy", { locale: es })
  const dayName = format(salidaDate, "EEEE", { locale: es })

  // Avoid hydration mismatch before mount
  if (!mounted || !time) {
    return (
      <div className={`mt-3.5 bg-slate-950 text-white rounded-2xl p-3 border border-slate-800/80 shadow-md ${className}`}>
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Temporizador de Salida
          </span>
          <span className="text-[9px] font-bold text-slate-500 uppercase px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
            Calculando...
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-10 bg-slate-900 rounded-xl"></div>
            <div className="w-10 h-10 bg-slate-900 rounded-xl"></div>
            <div className="w-10 h-10 bg-slate-900 rounded-xl"></div>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-slate-500 block uppercase font-bold">Salida</span>
            <span className="text-xs font-black text-slate-400">{formattedDate}</span>
          </div>
        </div>
      </div>
    )
  }

  // ESTADO 1: VIAJE CONCLUIDO
  if (time.isPast) {
    return (
      <div className={`mt-3.5 bg-slate-50 text-slate-700 rounded-2xl p-3 border border-slate-200/90 flex items-center justify-between shadow-sm ${className}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-200/80 text-slate-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
              Estado del Bloqueo
            </span>
            <span className="text-xs font-black text-slate-800">
              Viaje Concluido
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 pl-3 border-l border-slate-200">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            Fecha Salida
          </span>
          <span className="text-xs font-black text-slate-700 block mt-0.5">
            {formattedDate}
          </span>
        </div>
      </div>
    )
  }

  // ESTADO 2: EL VIAJE ES HOY
  if (time.isToday) {
    return (
      <div className={`mt-3.5 bg-gradient-to-r from-emerald-950 via-slate-950 to-slate-950 text-white rounded-2xl p-3.5 border border-emerald-500/40 shadow-lg shadow-emerald-950/30 ${className}`}>
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Operación en Curso
            </span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 animate-pulse">
            🚀 ¡Despegue Hoy!
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Rocket size={20} className="animate-bounce" />
            </div>
            <div>
              <p className="text-sm font-black text-white tracking-tight">¡EL VIAJE ES HOY!</p>
              <p className="text-[10px] text-emerald-300/80 font-medium">Pasajeros en vuelo y actividades activas.</p>
            </div>
          </div>
          <div className="text-right shrink-0 pl-3 border-l border-emerald-900/50">
            <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-wider block">Fecha</span>
            <span className="text-xs font-black text-white block mt-0.5">{formattedDate}</span>
          </div>
        </div>
      </div>
    )
  }

  // ESTADO 3: EN CUENTA REGRESIVA (Definición de temas y urgencia)
  const isUrgent = time.totalDays <= 7
  const isApproaching = time.totalDays > 7 && time.totalDays <= 20

  const theme = isUrgent
    ? {
        pulseBg: 'bg-rose-400',
        dotBg: 'bg-rose-500',
        iconColor: 'text-rose-400',
        badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        statusLabel: 'Última semana',
        highlightBorder: 'border-rose-500/30',
        secondsHighlight: 'text-rose-400 font-bold',
        timerBorder: 'border-rose-500/20'
      }
    : isApproaching
    ? {
        pulseBg: 'bg-amber-400',
        dotBg: 'bg-amber-500',
        iconColor: 'text-amber-400',
        badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        statusLabel: 'Próximo a salir',
        highlightBorder: 'border-slate-800',
        secondsHighlight: 'text-amber-400 font-bold',
        timerBorder: 'border-slate-800/80'
      }
    : {
        pulseBg: 'bg-sky-400',
        dotBg: 'bg-sky-500',
        iconColor: 'text-sky-400',
        badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        statusLabel: 'En cronograma',
        highlightBorder: 'border-slate-800',
        secondsHighlight: 'text-sky-400 font-bold',
        timerBorder: 'border-slate-800/80'
      }

  return (
    <div className={`mt-3.5 bg-slate-950 text-white rounded-2xl p-3 sm:p-3.5 border ${theme.timerBorder} shadow-lg shadow-slate-950/30 ${className}`}>
      {/* Barra superior de encabezado: Título + Radar + Estado (sin colisiones) */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.pulseBg}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.dotBg}`}></span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate flex items-center gap-1">
            <Timer size={11} className={theme.iconColor} /> Temporizador de Salida
          </span>
        </div>
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${theme.badge}`}>
          {theme.statusLabel}
        </span>
      </div>

      {/* Cuerpo principal: Cajas digitales del temporizador + Fecha a la derecha */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {/* Temporizador Digital Segmentado */}
        <div className="flex items-center gap-1 sm:gap-1.5 font-mono select-none">
          {/* DÍAS */}
          <div className="flex flex-col items-center justify-center bg-slate-900/95 border border-slate-800/90 shadow-inner px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl min-w-[38px] sm:min-w-[42px]">
            <span className="font-black text-sm sm:text-base text-white tracking-tight leading-none">
              {String(time.days).padStart(2, '0')}
            </span>
            <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
              DÍAS
            </span>
          </div>

          <span className="text-slate-600 font-black text-xs sm:text-sm pb-2">:</span>

          {/* HORAS */}
          <div className="flex flex-col items-center justify-center bg-slate-900/95 border border-slate-800/90 shadow-inner px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-xl min-w-[34px] sm:min-w-[38px]">
            <span className="font-black text-sm sm:text-base text-white tracking-tight leading-none">
              {String(time.hours).padStart(2, '0')}
            </span>
            <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
              HRS
            </span>
          </div>

          <span className="text-slate-600 font-black text-xs sm:text-sm pb-2">:</span>

          {/* MINUTOS */}
          <div className="flex flex-col items-center justify-center bg-slate-900/95 border border-slate-800/90 shadow-inner px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-xl min-w-[34px] sm:min-w-[38px]">
            <span className="font-black text-sm sm:text-base text-white tracking-tight leading-none">
              {String(time.minutes).padStart(2, '0')}
            </span>
            <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
              MIN
            </span>
          </div>

          <span className="text-slate-600 font-black text-xs sm:text-sm pb-2">:</span>

          {/* SEGUNDOS (Live ticking) */}
          <div className={`flex flex-col items-center justify-center bg-slate-900/95 border ${isUrgent ? 'border-rose-500/30' : 'border-slate-800/90'} shadow-inner px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-xl min-w-[34px] sm:min-w-[38px]`}>
            <span className={`font-black text-sm sm:text-base tracking-tight leading-none ${theme.secondsHighlight}`}>
              {String(time.seconds).padStart(2, '0')}
            </span>
            <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
              SEG
            </span>
          </div>
        </div>

        {/* Fecha de salida estructurada e independiente (NUNCA colisiona) */}
        <div className="text-right shrink-0 pl-2.5 sm:pl-3 border-l border-slate-800/80">
          <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-end gap-1">
            <Calendar size={10} className="text-primary hidden sm:inline" /> Salida
          </span>
          <span className="text-xs sm:text-[13px] font-black text-white whitespace-nowrap block mt-0.5">
            {formattedDate}
          </span>
          <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 capitalize block leading-tight">
            {dayName}
          </span>
        </div>
      </div>
    </div>
  )
}
