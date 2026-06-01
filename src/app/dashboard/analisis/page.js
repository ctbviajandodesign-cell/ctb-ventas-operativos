'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import { Sparkles, Trophy, RefreshCw, AlertCircle, CheckCircle, TrendingUp, Download } from 'lucide-react'
import AIInsightCard from '@/components/AIInsightCard'

export default function AnalisisPage() {
  const { user, profile, isAdmin, loading: sessionLoading } = useUserSession()
  const [board, setBoard] = useState([])
  const [selectedOp, setSelectedOp] = useState('global')
  const [timeframe, setTimeframe] = useState('mes') // 'mes' | 'ano'
  const [loading, setLoading] = useState(true)
  const [rankingVendidos, setRankingVendidos] = useState([])
  const [rankingObjeciones, setRankingObjeciones] = useState([])
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

      const now = new Date()
      const ecTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Guayaquil" }))
      let startIso
      if (timeframe === 'mes') {
        startIso = new Date(Date.UTC(ecTime.getFullYear(), ecTime.getMonth(), 1, 5, 0, 0, 0)).toISOString()
      } else {
        startIso = new Date(Date.UTC(ecTime.getFullYear(), 0, 1, 5, 0, 0, 0)).toISOString()
      }

      let cotsQuery = supabase
        .from('cotizaciones')
        .select('estado, valor_total, valor_comision, valor_utilidad, destino, operativo_id, motivo_perdida')
        .gte('created_at', startIso)

      if (targetOp !== 'global') {
        cotsQuery = cotsQuery.eq('operativo_id', targetOp)
      }

      const { data: cots, error } = await cotsQuery
      if (error) throw error

      const total = cots?.length || 0
      const ganadas = cots?.filter(c => c.estado === 'ganada')?.length || 0
      const abiertas = cots?.filter(c => c.estado === 'abierta')?.length || 0
      const cotsPerdidas = cots?.filter(c => c.estado === 'perdida' || c.estado === 'cancelada') || []
      const perdidas = cotsPerdidas.length
      
      const ganancia = cots?.filter(c => c.estado === 'ganada').reduce((acc, curr) => {
        return acc + (Number(curr.valor_comision) || 0) + (Number(curr.valor_utilidad) || 0)
      }, 0) || 0
      const conversion = total > 0 ? ((ganadas / total) * 100).toFixed(1) : 0

      // Destino top
      const destMap = {}
      cots?.forEach(q => { if (q.destino) destMap[q.destino] = (destMap[q.destino] || 0) + 1 })
      const topDestino = Object.keys(destMap).sort((a,b) => destMap[b] - destMap[a])[0] || 'N/A'

      // Motivos de pérdida top
      const motivosMap = {}
      cotsPerdidas.forEach(q => { 
        if (q.motivo_perdida && q.motivo_perdida.trim() !== '') {
          motivosMap[q.motivo_perdida] = (motivosMap[q.motivo_perdida] || 0) + 1 
        }
      })
      const topMotivos = Object.entries(motivosMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([motivo, count]) => `${motivo} (${count})`)
        .join(', ') || 'Sin objeciones registradas'

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

      if (timeframe === 'ano') {
        meta = meta * 12
      }

      const porcentajeMeta = meta > 0 ? (ganancia / meta) * 100 : 0

      // 1. Destinos Más Vendidos (Ganadas)
      const destinosGanadosMap = {}
      cots?.filter(c => c.estado === 'ganada').forEach(c => {
        if (c.destino) {
          if (!destinosGanadosMap[c.destino]) {
            destinosGanadosMap[c.destino] = { count: 0, valor: 0 }
          }
          destinosGanadosMap[c.destino].count += 1
          destinosGanadosMap[c.destino].valor += Number(c.valor_total) || 0
        }
      })
      const rankingVendidosData = Object.entries(destinosGanadosMap)
        .map(([destino, data]) => ({ destino, ...data }))
        .sort((a, b) => b.count - a.count)

      // 2. Destinos con Más Objeciones (Perdidas / Canceladas)
      const destinosPerdidosMap = {}
      cots?.filter(c => c.estado === 'perdida' || c.estado === 'cancelada').forEach(c => {
        if (c.destino) {
          if (!destinosPerdidosMap[c.destino]) {
            destinosPerdidosMap[c.destino] = { count: 0, motivos: {} }
          }
          destinosPerdidosMap[c.destino].count += 1
          if (c.motivo_perdida) {
            destinosPerdidosMap[c.destino].motivos[c.motivo_perdida] = (destinosPerdidosMap[c.destino].motivos[c.motivo_perdida] || 0) + 1
          }
        }
      })
      const rankingObjecionesData = Object.entries(destinosPerdidosMap)
        .map(([destino, data]) => {
          const mainObjection = Object.entries(data.motivos)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin especificar'
          return { destino, count: data.count, mainObjection }
        })
        .sort((a, b) => b.count - a.count)

      setRankingVendidos(rankingVendidosData)
      setRankingObjeciones(rankingObjecionesData)

      setMetrics({
        total,
        abiertas,
        ganadas,
        perdidas,
        conversion,
        totalAporte: ganancia,
        topDestino,
        topMotivos,
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

  // Refetch cuando cambia el selectedOp, el timeframe o termina de cargar la sesión
  useEffect(() => {
    if (!sessionLoading) {
      fetchData()
    }
  }, [selectedOp, sessionLoading, timeframe])

  const modoIA = (profile?.rol === 'admin' || profile?.rol === 'superadmin') ? (selectedOp === 'global' ? 'GLOBAL_ADMIN' : 'INDIVIDUAL_ADMIN') : 'OPERATIVE'

  const exportCSV = (filename, headers, rows) => {
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n")
    const link = document.createElement("a")
    link.setAttribute("href", encodeURI(csvContent))
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportVendidos = () => {
    if (rankingVendidos.length === 0) return
    const headers = 'Ranking,Destino,Cotizaciones Vendidas,Valor Total ($)'
    const rows = rankingVendidos.map((item, i) => `${i+1},${item.destino},${item.count},${item.valor}`)
    exportCSV('Ranking_Destinos_Vendidos_CTB', headers, rows)
  }

  const handleExportObjeciones = () => {
    if (rankingObjeciones.length === 0) return
    const headers = 'Ranking,Destino,Cotizaciones Perdidas,Objecion Principal'
    const rows = rankingObjeciones.map((item, i) => `${i+1},${item.destino},${item.count},"${item.mainObjection}"`)
    exportCSV('Ranking_Objeciones_Destinos_CTB', headers, rows)
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-3 py-1 rounded-full">Análisis B2B</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Sparkles className="text-primary animate-pulse" size={28} />
            IA Comercial & Destinos
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-xl">
            Diagnóstico B2B para canales de agencias minoristas. Monitorea objeciones, cierres y volumen de cotización en tiempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto z-10">
          {/* Selector de Rango */}
          <div className="bg-gray-50 p-1.5 rounded-2xl border border-gray-100 flex items-center gap-1">
            <button
              onClick={() => setTimeframe('mes')}
              className={`text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all ${timeframe === 'mes' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Mes
            </button>
            <button
              onClick={() => setTimeframe('ano')}
              className={`text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all ${timeframe === 'ano' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Año
            </button>
          </div>

          {(profile?.rol === 'admin' || profile?.rol === 'superadmin') && (
            <div className="bg-gray-50 p-1.5 rounded-2xl border border-gray-100 flex items-center gap-2">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest pl-2">Asesor:</span>
              <select
                value={selectedOp}
                onChange={(e) => setSelectedOp(e.target.value)}
                className="bg-white border border-gray-200 text-xs font-black text-gray-800 uppercase tracking-widest py-2 px-4 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="global">🌐 Equipo Global</option>
                {board.map(u => (
                  <option key={u.id} value={u.id}>👤 {u.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-gray-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="text-primary animate-spin" size={32} />
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Cargando análisis comercial...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Tarjetas de Resumen Rápido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Cotizaciones</p>
                <p className="text-3xl font-black text-gray-900">{metrics.total}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <TrendingUp size={22} />
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">En Espera</p>
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
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Meta ({timeframe === 'mes' ? 'Mes' : 'Año'})</p>
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
                  <h2 className="text-2xl font-black tracking-tight">Recomendaciones & Feedback B2B</h2>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
                    Análisis sobre: <span className="text-primary font-bold">{metrics.nombreAsesor}</span> ({timeframe === 'mes' ? 'Mes' : 'Año'})
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
                  topMotivos: metrics.topMotivos,
                  globalGoal: metrics.globalGoal,
                  porcentajeMeta: metrics.porcentajeMeta,
                  nombreAsesor: metrics.nombreAsesor,
                  meta: metrics.globalGoal,
                  cumplimiento: metrics.porcentajeMeta
                }}
              />

              <div className="bg-white/5 border border-white/5 p-6 rounded-3xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Diagnóstico Automatizado B2B</p>
                  <p className="text-xs text-gray-400 max-w-xl leading-relaxed">
                    La IA evalúa automáticamente el balance de cotizaciones B2B abiertas, ganadas y las objeciones principales de las agencias minoristas al cambiar filtros o periodos.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rankings de Destinos y Objeciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Destinos Más Vendidos */}
            <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-success/15 text-success flex items-center justify-center text-sm font-bold">✓</span>
                  Destinos Más Vendidos B2B ({timeframe === 'mes' ? 'Mes' : 'Año'})
                </h3>
                <button onClick={handleExportVendidos} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-gray-900 hover:bg-primary text-white px-3 py-2 rounded-xl transition-all shadow-sm">
                  <Download size={12} /> XLS
                </button>
              </div>
              {rankingVendidos.length > 0 ? (
                <div className="space-y-4">
                  {rankingVendidos.slice(0, 5).map((item, idx) => (
                    <div key={item.destino} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-gray-400 w-5">#{idx + 1}</span>
                        <div>
                          <p className="text-sm font-black text-gray-800 uppercase tracking-tight">{item.destino}</p>
                          <p className="text-xs text-gray-400 font-bold uppercase">{item.count} {item.count === 1 ? 'cotización vendida' : 'cotizaciones vendidas'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-success">${item.valor.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic text-center py-8">No hay ventas registradas en este periodo.</p>
              )}
            </div>

            {/* Destinos con más Objeciones */}
            <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-sm font-bold">✕</span>
                  Destinos con más Objeciones B2B ({timeframe === 'mes' ? 'Mes' : 'Año'})
                </h3>
                <button onClick={handleExportObjeciones} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-gray-900 hover:bg-amber-600 text-white px-3 py-2 rounded-xl transition-all shadow-sm">
                  <Download size={12} /> XLS
                </button>
              </div>
              {rankingObjeciones.length > 0 ? (
                <div className="space-y-4">
                  {rankingObjeciones.slice(0, 5).map((item, idx) => (
                    <div key={item.destino} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-gray-400 w-5">#{idx + 1}</span>
                        <div>
                          <p className="text-sm font-black text-gray-800 uppercase tracking-tight">{item.destino}</p>
                          <p className="text-xs text-gray-400 font-bold uppercase">{item.count} {item.count === 1 ? 'cotización perdida' : 'cotizaciones perdidas'}</p>
                        </div>
                      </div>
                      <div className="text-right bg-amber-50 px-3 py-1 rounded-xl border border-amber-100 max-w-[200px] truncate">
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-0.5">Objeción principal</p>
                        <p className="text-xs font-black text-amber-900 truncate" title={item.mainObjection}>{item.mainObjection}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic text-center py-8">No hay objeciones registradas en este periodo.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
