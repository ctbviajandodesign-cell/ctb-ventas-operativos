'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

export default function AIInsightCard({ metricas }) {
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    if (metricas && !hasLoaded && metricas.total > 0) {
      fetchInsight()
    }
  }, [metricas?.total])

  async function fetchInsight() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricas })
      })
      const data = await res.json()
      if (data.insight) {
        setInsight(data.insight)
        setHasLoaded(true)
      }
    } catch (err) {
      console.error('AI insight error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Si no hay insight ni API key, no mostrar nada
  if (!loading && !insight && hasLoaded) return null
  if (!loading && !insight && metricas?.total === 0) return null

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
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">IA Comercial CTB</p>
            <p className="text-[8px] text-gray-400 uppercase tracking-widest">Consejo Personalizado</p>
          </div>
        </div>
        <button
          onClick={fetchInsight}
          disabled={loading}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          title="Actualizar consejo"
        >
          <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative z-10">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-white/10 rounded-full animate-pulse w-full"></div>
            <div className="h-3 bg-white/10 rounded-full animate-pulse w-4/5"></div>
            <div className="h-3 bg-white/10 rounded-full animate-pulse w-3/5"></div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-gray-200 italic">
            "{insight}"
          </p>
        )}
      </div>
    </div>
  )
}
