'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import { Sparkles, Trophy, ArrowRight, RefreshCw, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react'
import AIInsightCard from '@/components/AIInsightCard'

export default function AnalisisPage() {
  const { user, profile, isAdmin, loading: sessionLoading } = useUserSession()
  const [board, setBoard] = useState([])
  const [selectedOp, setSelectedOp] = useState('global')
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    total: 0,
    abiertas: 0,
    ganadas: 0,
    perdidas: 0,
    conversion: 0,
    totalAporte: 0,
    topDestino: 'N/A',
    globalGoal: 50000,
    porcentajeMeta: 0
  })

  useEffect(() => {
    if (!sessionLoading) {
      fetchData()
    }
  }, [selectedOp, sessionLoading])

  async function fetchData() {
    setLoading(true)
    try {
      // Traer usuarios para el selector si es admin
      if (isAdmin && board.length === 0) {
        const { data: users } = await supabase.from('profiles').select('id, nombre, meta_mensual').eq('rol', 'operativo')
        setBoard(users || [])
      }

      // Determinar qué datos consultar
      const targetOp = isAdmin ? selectedOp : (user?.id || 'global')

      let cotsQuery = supabase.from('cotizaciones').select('estado, ganancia, destino, operativo_id')
      if (targetOp !== 'global') {
        cotsQuery = cotsQuery.eq('operativo_id', targetOp)
      }

      const { data: cots } = await cotsQuery

      const total = cots?.length || 0
      const ganadas = cots?.filter(c => c.estado === 'ganada')?.length || 0
      const abiertas = cots?.filter(c => c.estado === 'abierta')?.length || 0
      const perdidas = cots?.filter(c => c.estado === 'perdida' || c.estado === 'cancelada')?.length || 0
      const ganancia = cots?.filter(c => c.estado === 'ganada').reduce((acc, curr) => acc + (Number(curr.ganancia) || 0), 0) || 0
      const conversion = total > 0 ? ((ganadas / total) * 100).toFixed(1) : 0

      // Destino top
      const destMap = {}
      cots?.forEach(q => { if (q.destino) destMap[q.destino] = (destMap[q.destino] || 0) + 1 })
      const topDestino = Object.keys(destMap).sort((a,b) => destMap[b] - destMap[a])[0] || 'N/A'

      // Meta
      let meta = 50000
      if (targetOp === 'global') {
        // Suma de metas de todos los operativos
        const { data: allOps } = await supabase.from('profiles').select('meta_mensual').eq('rol', 'operativo')
        meta = allOps?.reduce((acc, curr) => acc + (Number(curr.meta_mensual) || 5000), 0) || 50000
      } else {
        const { data: singleOp } = await supabase.from('profiles').select('meta_mensual').eq('id', targetOp).single()
        meta = Number(singleOp?.meta_mensual) || 5000
      }

      const porcentajeMeta = meta > 0 ? (ganancia / meta) * 100 : 0

      setMetrics({
        total,
        abiertas,
        ganadas,
        perdidas,
        conversion,
        totalAporte: ganancia,
        topDestino,
        globalGoal: meta,
        porcentajeMeta,
        nombreAsesor: targetOp === 'global' ? 'Equipo Global' : board.find(u => u.id === targetOp)?.nombre || profile?.nombre
      })

    } catch (err) {
      console.error('Error fetching AI analysis data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Refetch cuando cambia el selectedOp
  useEffect(() => {
    if (profile) {
      fetchData()
    }
  }, [selectedOp])

  const modoIA = profile?.rol === 'admin' ? (selectedOp === 'global' ? 'GLOBAL_ADMIN' : 'INDIVIDUAL_ADMIN') : 'OPERATIVE'

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-3 py-1 rounded-full">Módulo Premium</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Sparkles className="text-primary animate-pulse" size={28} />
            IA Comercial & Sugerencias
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-xl">
            Diagnóstico avanzado impulsado por OpenAI. Analiza cuellos de botella, cotizaciones abiertas y rendimiento de cierre bajo demanda.
          </p>
        </div>

        {profile?.rol === 'admin' && (
          <div className="bg-gray-50 p-2 rounded-2xl border border-gray-100 flex items-center gap-2 w-full md:w-auto z-10">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest px-3">Filtrar IA:</span>
            <select
              value={selectedOp}
              onChange={(e) => setSelectedOp(e.target.value)}
              className="bg-white border border-gray-200 text-xs font-black text-gray-800 uppercase tracking-widest py-2.5 px-4 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="global">🌐 Equipo Global</option>
              {board.map(u => (
                <option key={u.id} value={u.id}>👤 {u.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-gray-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="text-primary animate-spin" size={32} />
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Cargando métricas para IA...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Tarjetas de Resumen Rápido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Proformas Totales</p>
                <p className="text-3xl font-black text-gray-900">{metrics.total}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <TrendingUp size={22} />
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">En Proceso</p>
                <p className="text-3xl font-black text-amber-500">{metrics.abiertas}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                <AlertCircle size={22} />
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-success uppercase tracking-widest mb-1">Ganadas (Cierre)</p>
                <p className="text-3xl font-black text-success">{metrics.ganadas} <span className="text-xs font-bold text-gray-400">({metrics.conversion}%)</span></p>
              </div>
              <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center text-success">
                <CheckCircle size={22} />
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Meta Asignada</p>
                <p className="text-3xl font-black text-gray-900">${metrics.globalGoal?.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500">
                <Trophy size={22} />
              </div>
            </div>
          </div>

          {/* TARJETA PRINCIPAL DE INTELIGENCIA ARTIFICIAL */}
          <div className="bg-gray-900 p-8 sm:p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-60 h-60 bg-primary/20 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full -ml-20 -mb-20 blur-2xl pointer-events-none"></div>

            <div className="relative z-10 max-w-3xl mx-auto space-y-8">
              <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                  <Sparkles size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Motor de Diagnóstico OpenAI</h2>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
                    Modo actual: <span className="text-primary font-bold">{modoIA === 'GLOBAL_ADMIN' ? 'Estratégico Global (Admin)' : modoIA === 'INDIVIDUAL_ADMIN' ? `Auditoría a ${metrics.nombreAsesor}` : 'Coach Personal (Operativo)'}</span>
                  </p>
                </div>
              </div>

              {/* Componente AIInsightCard pasándole las métricas exactas */}
              <AIInsightCard 
                modo={modoIA}
                metricas={{
                  total: metrics.total,
                  abiertas: metrics.abiertas,
                  ganadas: metrics.ganadas,
                  perdidas: metrics.perdidas,
                  conversion: metrics.conversion,
                  totalAporte: metrics.totalAporte,
                  topDestino: metrics.topDestino,
                  globalGoal: metrics.globalGoal,
                  porcentajeMeta: metrics.porcentajeMeta,
                  nombreAsesor: metrics.nombreAsesor,
                  meta: metrics.globalGoal,
                  cumplimiento: metrics.porcentajeMeta
                }}
              />

              <div className="bg-white/5 border border-white/5 p-6 rounded-3xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-black text-gray-300 uppercase tracking-widest">¿Cómo funciona este análisis?</p>
                  <p className="text-xs text-gray-400 max-w-xl leading-relaxed">
                    Al presionar el botón de generación, la IA evalúa el balance entre cotizaciones abiertas, perdidas y ganadas. Ningún token se consume automáticamente al navegar o cambiar de filtro.
                  </p>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                  <ArrowRight size={18} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
