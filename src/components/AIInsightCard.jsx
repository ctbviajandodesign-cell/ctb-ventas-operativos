'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

export default function AIInsightCard({ metricas, modo = 'OPERATIVE' }) {
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchInsight = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricas, modo })
      })

      const data = await res.json()
      if (data.insight) {
        setInsight(data.insight)
      }
    } catch (err) {
      console.error('AI insight error:', err)
    } finally {
      setLoading(false)
    }
  }, [metricas, modo])

  // Cargar automáticamente cuando cambian las métricas o el modo
  useEffect(() => {
    let active = true
    async function autoLoad() {
      setLoading(true)
      try {
        const res = await fetch('/api/insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metricas, modo })
        })
        const data = await res.json()
        if (active && data.insight) {
          setInsight(data.insight)
        }
      } catch (err) {
        console.error('AI insight error:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    setInsight(null)
    if (metricas && (metricas.total !== undefined || metricas.ganadas !== undefined)) {
      autoLoad()
    }

    return () => {
      active = false
    }
  }, [metricas?.total, metricas?.ganadas, metricas?.abiertas, metricas?.caducadas, metricas?.perdidas, modo])

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-[2.5rem] text-white relative overflow-hidden border border-white/5 shadow-2xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-20 h-20 bg-purple-500/10 rounded-full -ml-6 -mb-6 blur-xl pointer-events-none"></div>
      
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary/20 p-2 rounded-xl border border-primary/30">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">IA Comercial CTB</p>
            <p className="text-xs text-gray-400 uppercase tracking-widest mt-0.5">
              {modo === 'GLOBAL_ADMIN' ? 'Análisis Ejecutivo Global' : modo === 'INDIVIDUAL_ADMIN' ? 'Auditoría de Asesor' : 'Coach de Ventas'}
            </p>
          </div>
        </div>
        {insight && (
          <button
            onClick={fetchInsight}
            disabled={loading}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            title="Actualizar consejo"
          >
            <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="relative z-10">
        {loading ? (
          <div className="space-y-2 py-2">
            <div className="h-3 bg-white/10 rounded-full animate-pulse w-full"></div>
            <div className="h-3 bg-white/10 rounded-full animate-pulse w-4/5"></div>
            <div className="h-3 bg-white/10 rounded-full animate-pulse w-3/5"></div>
          </div>
        ) : insight ? (
          <p className="text-sm leading-relaxed text-gray-200 italic font-medium">
            "{insight}"
          </p>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              No se pudo cargar el análisis automático o aún no hay datos suficientes para el análisis.
            </p>
            <button
              onClick={fetchInsight}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-all"
            >
              <RefreshCw size={14} />
              Reintentar Carga
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
