'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { showToast } from '@/utils/toast'
import StatsCard from '@/components/StatsCard'
import QuotesTable from '@/components/QuotesTable'
import GlobalSearch from '@/components/GlobalSearch'
import PaymentAlerts from '@/components/PaymentAlerts'
import AIInsightCard from '@/components/AIInsightCard'
import DashboardCharts from '@/components/DashboardCharts'
import { 
  DollarSign, 
  TrendingUp, 
  FileText, 
  Target,
  Trophy,
  Users,
  Search,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  ChevronRight,
  Plus,
  Download,
  AlertTriangle,
  RefreshCw,
  Sparkles
} from 'lucide-react'

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts'

export default function DashboardPage() {
  const [profile, setProfile] = useState(null)
  const [selectedOperative, setSelectedOperative] = useState('global')
  const [selectedCity, setSelectedCity] = useState('global')
  const [operatives, setOperatives] = useState([])
  const [operativePanel, setOperativePanel] = useState(null) // para drill-down de admin
  const [metrics, setMetrics] = useState({
    totalVendido: 0,
    metaComputable: 0,
    cotizacionesAbiertas: 0,
    porcentajeMeta: 0,
    pipeline: 0,
    topDestino: 'N/A',
    globalGoal: 50000,
    vouchersEmitidos: 0,
    conversionRate: 0
  })
  const [leaderboard, setLeaderboard] = useState([])
  const [chartData, setChartData] = useState([])
  const [individualStats, setIndividualStats] = useState([])
  const [quotes, setQuotes] = useState([])
  const [lostQuotes, setLostQuotes] = useState([])
  const [lostFilter, setLostFilter] = useState('ALL') // Filtro inteligente de perdidas
  const [loading, setLoading] = useState(true)
  const [loadingPanelAi, setLoadingPanelAi] = useState(false)
  const [errorState, setErrorState] = useState(null)


  useEffect(() => {
    fetchDashboardData()
  }, [selectedOperative, selectedCity])

  async function fetchDashboardData() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener Perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      setProfile(profileData)
      const isAdmin = profileData?.rol === 'admin'
      const activeOpId = isAdmin && selectedOperative !== 'global' ? selectedOperative : user.id

      // Si es admin, cargar lista de operativos
      if (isAdmin && operatives.length === 0) {
        const { data: ops } = await supabase.from('profiles').select('id, nombre, ciudad').eq('rol', 'operativo')
        setOperatives(ops || [])
      }

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const startIso = startOfMonth.toISOString()

      const targetIdForIndividual = (!isAdmin || selectedOperative !== 'global') ? (isAdmin ? selectedOperative : user.id) : null

      // CONSTRUIR QUERIES EN PARALELO
      const activeCityFilter = isAdmin ? selectedCity : profileData?.ciudad

      let ventasQuery = supabase.from('ventas').select('total, comision, utilidad, operativo_id, profiles!inner(ciudad)').eq('estado', 'activa').gte('created_at', startIso)
      let cotGanadasQuery = supabase.from('cotizaciones').select('valor_total, profiles!inner(ciudad)').eq('estado', 'ganada').gte('created_at', startIso)
      let quotesQuery = supabase.from('cotizaciones').select('*, profiles!inner(nombre, ciudad)').order('created_at', { ascending: false }).limit(10)
      let pipelineQuery = supabase.from('cotizaciones').select('valor_total, destino, estado, profiles!inner(ciudad)').eq('estado', 'abierta').gte('created_at', startIso)
      let openCountQuery = supabase.from('cotizaciones').select('id, profiles!inner(ciudad)', { count: 'exact', head: true }).eq('estado', 'abierta').gte('created_at', startIso)
      let lostQuery = supabase.from('cotizaciones').select('codigo, agencia, destino, motivo_perdida, notas_seguimiento, created_at, comercial, profiles!inner(nombre, ciudad)').in('estado', ['perdida', 'anulada']).gte('created_at', startIso).order('created_at', { ascending: false })

      if (activeCityFilter && activeCityFilter !== 'global') {
        ventasQuery = ventasQuery.eq('profiles.ciudad', activeCityFilter)
        cotGanadasQuery = cotGanadasQuery.eq('profiles.ciudad', activeCityFilter)
        quotesQuery = quotesQuery.eq('profiles.ciudad', activeCityFilter)
        pipelineQuery = pipelineQuery.eq('profiles.ciudad', activeCityFilter)
        openCountQuery = openCountQuery.eq('profiles.ciudad', activeCityFilter)
        lostQuery = lostQuery.eq('profiles.ciudad', activeCityFilter)
      }

      if (targetIdForIndividual) {
        ventasQuery = ventasQuery.eq('operativo_id', targetIdForIndividual)
        cotGanadasQuery = cotGanadasQuery.eq('operativo_id', targetIdForIndividual)
        quotesQuery = quotesQuery.eq('operativo_id', targetIdForIndividual)
        pipelineQuery = pipelineQuery.eq('operativo_id', targetIdForIndividual)
        openCountQuery = openCountQuery.eq('operativo_id', targetIdForIndividual)
        lostQuery = lostQuery.eq('operativo_id', targetIdForIndividual)
      }

      // EJECUTAR PROMISE.ALL PARA MAXIMA VELOCIDAD
      const [
        { data: ventasData },
        { data: cotGanadas },
        { data: quotesData },
        { data: pipelineData },
        { count: openCount },
        { data: lostData },
        resBoard
      ] = await Promise.all([
        ventasQuery,
        cotGanadasQuery,
        quotesQuery,
        pipelineQuery,
        openCountQuery,
        lostQuery,
        fetch('/api/leaderboard').then(r => r.json())
      ])

      const totalMetaComp = ventasData?.reduce((acc, v) => acc + (Number(v.comision) || 0) + (Number(v.utilidad) || 0), 0) || 0
      const totalV = cotGanadas?.reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0) || 0
      const totalPipeline = pipelineData?.reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0) || 0

      setQuotes(quotesData || [])
      setLostQuotes(lostData || [])

      const rawBoard = resBoard?.success ? resBoard.leaderboard : []
      const userCity = profileData?.ciudad
      const board = !isAdmin
        ? rawBoard.filter(op => op.ciudad && userCity && op.ciudad.trim().toLowerCase() === userCity.trim().toLowerCase())
        : (selectedCity !== 'global'
            ? rawBoard.filter(op => op.ciudad?.trim().toLowerCase() === selectedCity.trim().toLowerCase())
            : rawBoard)
      setLeaderboard(board || [])
      setChartData(board || [])

      if (targetIdForIndividual) {
        const [
          { count: vCount },
          { count: wonCount },
          { count: openCountInd },
          { count: lostCount },
          { count: anuladaCount },
          { count: totalQ }
        ] = await Promise.all([
          supabase.from('vouchers').select('id', { count: 'exact', head: true }).eq('operativo_id', targetIdForIndividual).gte('created_at', startIso),
          supabase.from('cotizaciones').select('id', { count: 'exact', head: true }).eq('operativo_id', targetIdForIndividual).eq('estado', 'ganada').gte('created_at', startIso),
          supabase.from('cotizaciones').select('id', { count: 'exact', head: true }).eq('operativo_id', targetIdForIndividual).eq('estado', 'abierta').gte('created_at', startIso),
          supabase.from('cotizaciones').select('id', { count: 'exact', head: true }).eq('operativo_id', targetIdForIndividual).eq('estado', 'perdida').gte('created_at', startIso),
          supabase.from('cotizaciones').select('id', { count: 'exact', head: true }).eq('operativo_id', targetIdForIndividual).eq('estado', 'anulada').gte('created_at', startIso),
          supabase.from('cotizaciones').select('id', { count: 'exact', head: true }).eq('operativo_id', targetIdForIndividual).gte('created_at', startIso)
        ])

        const stats = [
          { name: 'Ganadas', value: wonCount || 0, color: '#16A34A' },
          { name: 'Abiertas', value: openCountInd || 0, color: '#0066CC' },
          { name: 'Perdidas', value: lostCount || 0, color: '#F5A623' },
          { name: 'Anuladas', value: anuladaCount || 0, color: '#DC2626' }
        ]
        setIndividualStats(stats)

        setMetrics(prev => ({ 
          ...prev, 
          vouchersEmitidos: vCount || 0, 
          cotizacionesAbiertas: openCountInd || 0,
          conversionRate: totalQ > 0 ? ((wonCount || 0) / totalQ) * 100 : 0,
          total: totalQ || 0,
          abiertas: openCountInd || 0,
          ganadas: wonCount || 0,
          perdidas: lostCount || 0,
          conversion: totalQ > 0 ? (((wonCount || 0) / totalQ) * 100).toFixed(1) : 0
        }))
      } else {
        let wonAllQuery = supabase.from('cotizaciones').select('id, profiles!inner(ciudad)', { count: 'exact', head: true }).eq('estado', 'ganada').gte('created_at', startIso)
        let openAllQuery = supabase.from('cotizaciones').select('id, profiles!inner(ciudad)', { count: 'exact', head: true }).eq('estado', 'abierta').gte('created_at', startIso)
        let lostAllQuery = supabase.from('cotizaciones').select('id, profiles!inner(ciudad)', { count: 'exact', head: true }).eq('estado', 'perdida').gte('created_at', startIso)
        let totalAllQuery = supabase.from('cotizaciones').select('id, profiles!inner(ciudad)', { count: 'exact', head: true }).gte('created_at', startIso)

        if (activeCityFilter && activeCityFilter !== 'global') {
          wonAllQuery = wonAllQuery.eq('profiles.ciudad', activeCityFilter)
          openAllQuery = openAllQuery.eq('profiles.ciudad', activeCityFilter)
          lostAllQuery = lostAllQuery.eq('profiles.ciudad', activeCityFilter)
          totalAllQuery = totalAllQuery.eq('profiles.ciudad', activeCityFilter)
        }

        const [
          { count: wonAll },
          { count: openAll },
          { count: lostAll },
          { count: totalAll }
        ] = await Promise.all([
          wonAllQuery,
          openAllQuery,
          lostAllQuery,
          totalAllQuery
        ])

        setMetrics(prev => ({ 
          ...prev, 
          cotizacionesAbiertas: openAll || 0,
          conversionRate: totalAll > 0 ? ((wonAll || 0) / totalAll) * 100 : 0,
          total: totalAll || 0,
          abiertas: openAll || 0,
          ganadas: wonAll || 0,
          perdidas: lostAll || 0,
          conversion: totalAll > 0 ? (((wonAll || 0) / totalAll) * 100).toFixed(1) : 0
        }))
      }

      // Calcular motivos principales de pérdida para el periodo actual
      const motivesMap = {}
      lostData?.forEach(q => {
        if (q.motivo_perdida) {
          motivesMap[q.motivo_perdida] = (motivesMap[q.motivo_perdida] || 0) + 1
        }
      })
      const topMotivosText = Object.entries(motivesMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([motivo, count]) => `${motivo} (${count})`)
        .join(', ') || 'Ninguno registrado aún'

      // Optimización del destino más popular
      const destMap = {}
      pipelineData?.forEach(q => { if(q.destino) destMap[q.destino] = (destMap[q.destino] || 0) + 1 })
      const popular = Object.keys(destMap).sort((a,b) => destMap[b] - destMap[a])[0] || 'N/A'

      const globalM = board?.reduce((acc, op) => acc + (Number(op.meta) || 0), 0) || 50000
      const myMeta = !isAdmin
        ? (Number(profileData?.meta_mensual) || 5000)
        : selectedOperative === 'global'
        ? globalM
        : (Number(board?.find(o => o.id === selectedOperative)?.meta) || 5000)

      const metaBase = isAdmin && selectedOperative === 'global' ? globalM : myMeta

      setMetrics(prev => ({
        ...prev,
        totalVendido: totalV,
        metaComputable: totalMetaComp,
        pipeline: totalPipeline,
        topDestino: popular,
        globalGoal: metaBase,
        porcentajeMeta: metaBase > 0 ? (totalMetaComp / metaBase) * 100 : 0,
        totalAporte: totalMetaComp,
        topMotivos: topMotivosText
      }))

    } catch (error) {
      console.error('Error fetching data:', error)
      setErrorState('No pudimos cargar los datos del dashboard. Por favor, verifica tu conexión o intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // Función de Exportación a CSV / Excel de Ventas No Concretadas
  const handleExportLostQuotes = () => {
    const filtered = lostFilter === 'ALL' 
      ? lostQuotes 
      : lostQuotes.filter(q => (q.motivo_perdida || '').toLowerCase().includes(lostFilter.toLowerCase()))
    
    if (filtered.length === 0) {
      showToast('No hay datos para exportar con el filtro actual.', 'error')
      return
    }

    const headers = ['Codigo,Agencia,Destino,Motivo,Notas,Asesor,Fecha']
    const rows = filtered.map(q => {
      const fecha = new Date(q.created_at).toLocaleDateString()
      const asesor = q.profiles?.nombre || 'N/A'
      const notas = (q.notas_seguimiento || '').replace(/,/g, ';').replace(/\n/g, ' ')
      const motivo = (q.motivo_perdida || '').replace(/,/g, ';')
      const agencia = (q.agencia || 'Directo').replace(/,/g, ';')
      const destino = (q.destino || '').replace(/,/g, ';')
      return `${q.codigo},${agencia},${destino},${motivo},${notas},${asesor},${fecha}`
    })

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Analisis_Perdidas_CTB_${selectedOperative}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }



  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50/50">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="mt-6 text-gray-500 font-bold uppercase tracking-widest animate-pulse">Cargando métricas de éxito...</p>
      </div>
    )
  }

  if (errorState) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 p-6 text-center">
        <AlertTriangle size={64} className="text-red-500 mb-6" />
        <h2 className="text-2xl font-black text-gray-800 mb-2 uppercase">Error de Conexión</h2>
        <p className="text-gray-500 max-w-md mb-8">{errorState}</p>
        <button 
          onClick={() => { setErrorState(null); fetchDashboardData(); }}
          className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition-all uppercase tracking-widest text-sm flex items-center gap-2"
        >
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    )
  }

  const isAdmin = profile?.rol === 'admin'
  const handleOpenOperativePanel = async (op) => {
    if (!isAdmin) return
    // Carga detallada de ese operativo
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
    const [{ data: ventas }, { data: cots }, { count: vouchers }] = await Promise.all([
      supabase.from('ventas').select('total,comision,utilidad,created_at').eq('operativo_id', op.id).eq('estado','activa').gte('created_at', startOfMonth.toISOString()),
      supabase.from('cotizaciones').select('estado,valor_total,destino,motivo_perdida').eq('operativo_id', op.id),
      supabase.from('vouchers').select('id', { count:'exact', head:true }).eq('operativo_id', op.id)
    ])
    const ganancia = ventas?.reduce((a,v)=>a+(Number(v.comision)||0)+(Number(v.utilidad)||0),0)||0
    const totalVendido = cots?.filter(c=>c.estado==='ganada').reduce((a,c)=>a+(Number(c.valor_total)||0),0)||0
    const ganadas = cots?.filter(c=>c.estado==='ganada').length||0
    const abiertas = cots?.filter(c=>c.estado==='abierta').length||0
    const perdidas = cots?.filter(c=>['perdida','anulada'].includes(c.estado)).length||0
    const totalCots = cots?.length||0

    // Calcular destino favorito del operativo
    const destMap = {}
    cots?.forEach(q => { if(q.destino) destMap[q.destino] = (destMap[q.destino] || 0) + 1 })
    const topDestino = Object.keys(destMap).sort((a,b) => destMap[b] - destMap[a])[0] || 'N/A'

    // Calcular motivos principales de pérdida para el panel del operativo
    const panelMotivesMap = {}
    cots?.filter(c => ['perdida', 'anulada'].includes(c.estado)).forEach(q => {
      if (q.motivo_perdida) {
        panelMotivesMap[q.motivo_perdida] = (panelMotivesMap[q.motivo_perdida] || 0) + 1
      }
    })
    const topMotivosOp = Object.entries(panelMotivesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([motivo, count]) => `${motivo} (${count})`)
      .join(', ') || 'Ninguno registrado aún'

    const panelData = {
      ...op,
      ganancia,
      totalVendido,
      ganadas,
      abiertas,
      perdidas,
      totalCots,
      vouchers: vouchers||0,
      conversion: totalCots>0 ? ((ganadas/totalCots)*100).toFixed(1) : 0,
      topDestino,
      aiInsight: null
    }

    setOperativePanel(panelData)

    // Trigger AI insight generation automatically immediately after opening the panel
    try {
      setLoadingPanelAi(true)
      const res = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'INDIVIDUAL_ADMIN',
          metricas: {
            nombreAsesor: panelData.nombreCompleto || panelData.nombre,
            meta: panelData.meta,
            cumplimiento: panelData.cumplimiento,
            vouchers: panelData.vouchers || 0,
            total: panelData.totalCots,
            abiertas: panelData.abiertas,
            ganadas: panelData.ganadas,
            perdidas: panelData.perdidas,
            conversion: panelData.conversion,
            totalAporte: panelData.ganancia,
            topDestino: panelData.topDestino,
            topMotivos: topMotivosOp
          }
        })
      })
      const aiData = await res.json()
      if (aiData.insight) {
        setOperativePanel(prev => prev ? {...prev, aiInsight: aiData.insight} : null)
      }
    } catch (err) {
      console.error('Error generating AI audit:', err)
    } finally {
      setLoadingPanelAi(false)
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">

      {/* PANEL DRILL-DOWN DE OPERATIVO (ADMIN) */}
      {operativePanel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setOperativePanel(null)}>
          <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-300 my-8 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 text-white p-8 flex items-start justify-between shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg">{operativePanel.avatar}</div>
                <div>
                  <p className="text-xs font-black text-primary uppercase tracking-widest mb-1">Perfil de Operativo</p>
                  <h2 className="text-2xl font-black tracking-tight">{operativePanel.nombreCompleto}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Meta mensual: ${operativePanel.meta?.toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => setOperativePanel(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-xl font-black relative z-10">✕</button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto flex-1">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Cumplimiento de Meta (Mes)</span>
                  <span className={`text-xs font-black uppercase ${operativePanel.cumplimiento >= 100 ? 'text-success' : operativePanel.cumplimiento >= 60 ? 'text-primary' : 'text-amber-600'}`}>{Number(operativePanel.cumplimiento).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(operativePanel.cumplimiento, 100)}%`, background: operativePanel.cumplimiento >= 100 ? '#16A34A' : operativePanel.cumplimiento >= 60 ? '#0066CC' : '#F5A623' }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-success font-black">Ganancia: ${operativePanel.ganancia?.toLocaleString()}</span>
                  <span className="text-xs text-gray-400 font-bold">Restan: ${Math.max(0, (operativePanel.meta||0) - (operativePanel.ganancia||0)).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase">Total Vendido (Mes)</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">${operativePanel.totalVendido?.toLocaleString()}</p>
                </div>
                <div className="bg-success/5 p-5 rounded-2xl border border-success/10">
                  <p className="text-xs font-black text-success/80 uppercase">Ganancia (Mes)</p>
                  <p className="text-2xl font-black text-success mt-1">${operativePanel.ganancia?.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase">Tasa de Cierre</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{operativePanel.conversion}%</p>
                </div>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase">Vouchers Emitidos</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{operativePanel.vouchers}</p>
                </div>
              </div>

              {/* FEEDBACK DE OPENAI BAJO DEMANDA */}
              <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-6 rounded-3xl text-white relative overflow-hidden border border-indigo-500/20 shadow-xl">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-xl pointer-events-none"></div>
                <div className="flex items-center justify-between gap-4 mb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-xl border border-primary/30 text-primary">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">OpenAI Analytics</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Auditoría Inteligente de Asesor</p>
                    </div>
                  </div>
                  {operativePanel.aiInsight && (
                    <button
                      onClick={() => {
                        // Re-fetch insight
                        setLoadingPanelAi(true)
                        fetch('/api/insight', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            modo: 'INDIVIDUAL_ADMIN',
                            metricas: {
                              nombreAsesor: operativePanel.nombreCompleto || operativePanel.nombre,
                              meta: operativePanel.meta,
                              cumplimiento: operativePanel.cumplimiento,
                              vouchers: operativePanel.vouchers || 0,
                              total: operativePanel.totalCots,
                              abiertas: operativePanel.abiertas,
                              ganadas: operativePanel.ganadas,
                              perdidas: operativePanel.perdidas,
                              conversion: operativePanel.conversion,
                              totalAporte: operativePanel.ganancia,
                              topDestino: operativePanel.topDestino
                            }
                          })
                        })
                        .then(r => r.json())
                        .then(aiData => { if (aiData.insight) setOperativePanel(prev => prev ? {...prev, aiInsight: aiData.insight} : null) })
                        .finally(() => setLoadingPanelAi(false))
                      }}
                      disabled={loadingPanelAi}
                      className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                      title="Actualizar auditoría"
                    >
                      <RefreshCw size={14} className={`text-gray-400 ${loadingPanelAi ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
                <div className="relative z-10 min-h-[60px] flex items-center justify-center">
                  {loadingPanelAi ? (
                    <div className="space-y-2 w-full py-2">
                      <div className="h-2.5 bg-white/10 rounded-full animate-pulse w-full"></div>
                      <div className="h-2.5 bg-white/10 rounded-full animate-pulse w-5/6"></div>
                      <div className="h-2.5 bg-white/10 rounded-full animate-pulse w-2/3"></div>
                    </div>
                  ) : operativePanel.aiInsight ? (
                    <p className="text-xs sm:text-sm leading-relaxed text-gray-200 italic font-medium w-full">
                      "{operativePanel.aiInsight}"
                    </p>
                  ) : (
                    <div className="text-center py-2 space-y-3 w-full">
                      <p className="text-xs text-gray-400 max-w-sm mx-auto">
                        No se pudo cargar la auditoría automática.
                      </p>
                      <button
                        onClick={() => {
                          setLoadingPanelAi(true)
                          fetch('/api/insight', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              modo: 'INDIVIDUAL_ADMIN',
                              metricas: {
                                nombreAsesor: operativePanel.nombreCompleto || operativePanel.nombre,
                                meta: operativePanel.meta,
                                cumplimiento: operativePanel.cumplimiento,
                                vouchers: operativePanel.vouchers || 0,
                                total: operativePanel.totalCots,
                                abiertas: operativePanel.abiertas,
                                ganadas: operativePanel.ganadas,
                                perdidas: operativePanel.perdidas,
                                conversion: operativePanel.conversion,
                                totalAporte: operativePanel.ganancia,
                                topDestino: operativePanel.topDestino
                              }
                            })
                          })
                          .then(r => r.json())
                          .then(aiData => { if (aiData.insight) setOperativePanel(prev => prev ? {...prev, aiInsight: aiData.insight} : null) })
                          .finally(() => setLoadingPanelAi(false))
                        }}
                        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                      >
                        <RefreshCw size={14} />
                        Reintentar Carga
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Proformas (histórico total)</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Ganadas', val: operativePanel.ganadas, color: 'text-success bg-success/10 border-success/20' },
                    { label: 'En Proceso', val: operativePanel.abiertas, color: 'text-primary bg-primary/10 border-primary/20' },
                    { label: 'Perdidas', val: operativePanel.perdidas, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                  ].map(item => (
                    <div key={item.label} className={`p-3 rounded-2xl text-center border ${item.color}`}>
                      <p className="text-2xl font-black">{item.val}</p>
                      <p className="text-xs font-black uppercase mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
              <button
                onClick={() => { setSelectedOperative(operativePanel.id); setOperativePanel(null) }}
                className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-tighter text-sm hover:scale-[1.02] transition-all shadow-lg shadow-primary/20"
              >
                Ver Dashboard Completo de {operativePanel.nombre} →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER & FILTROS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="space-y-6 flex-1">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-primary p-2 rounded-xl text-white">
                <BarChart3 size={20} />
              </div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
                Control Center
              </h1>
            </div>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.2em] ml-1">
              {isAdmin ? 'Panel de Control de Operaciones Globales' : 'Tu Resumen de Inteligencia Comercial'}
            </p>
          </div>
          <GlobalSearch />
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[2rem] shadow-xl border border-gray-100">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
              <Filter size={16} className="text-primary" />
              <span className="text-xs font-black uppercase text-gray-400">Ciudad:</span>
            </div>

            <select 
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value)
                setSelectedOperative('global')
              }}
              className="bg-transparent border-none font-black text-sm text-gray-800 outline-none pr-8 cursor-pointer focus:ring-0"
            >
              <option value="global">Todas las Ciudades</option>
              <option value="Quito">Quito</option>
              <option value="Guayaquil">Guayaquil</option>
              <option value="Cuenca">Cuenca</option>
              <option value="Manta">Manta</option>
              <option value="Loja">Loja</option>
            </select>

            <div className="h-6 w-px bg-gray-200 hidden md:block" />

            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
              <Filter size={16} className="text-primary" />
              <span className="text-xs font-black uppercase text-gray-400">Operativo:</span>
            </div>

            <select 
              value={selectedOperative}
              onChange={(e) => setSelectedOperative(e.target.value)}
              className="bg-transparent border-none font-black text-sm text-gray-800 outline-none pr-8 cursor-pointer focus:ring-0"
            >
              <option value="global">Todos</option>
              {operatives
                .filter(op => selectedCity === 'global' || op.ciudad === selectedCity)
                .map(op => (
                  <option key={op.id} value={op.id}>{op.nombre}</option>
                ))}
            </select>
          </div>
        )}

        {/* QUICK ACTION — Nueva Cotización (visible para todos) */}
        <Link
          href="/dashboard/cotizaciones/nueva"
          className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-black text-sm uppercase tracking-tighter shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
        >
          <Plus size={18} /> Nueva Cotización
        </Link>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Vendido"
          value={`$${metrics.totalVendido.toLocaleString()}`} 
          icon={DollarSign}
          color="primary"
        />
        <StatsCard 
          title="Proformas en Negociación" 
          value={`$${metrics.pipeline.toLocaleString()}`} 
          icon={Target}
          color="accent"
        />
        <StatsCard 
          title={isAdmin && selectedOperative === 'global' ? 'Ganancia del Equipo' : 'Ganancia Total'} 
          value={`$${metrics.metaComputable.toLocaleString()}`} 
          icon={TrendingUp}
          color="success"
        />
        <StatsCard 
          title={selectedOperative === 'global' && isAdmin ? "Proformas Activas" : "Vouchers Emitidos"} 
          value={selectedOperative === 'global' && isAdmin ? metrics.cotizacionesAbiertas : metrics.vouchersEmitidos} 
          icon={selectedOperative === 'global' && isAdmin ? FileText : Trophy}
          color="danger"
        />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* COLUMNA IZQUIERDA: GRÁFICOS Y TABLA */}
        <div className="lg:col-span-2 space-y-10">
          <DashboardCharts 
            isAdmin={isAdmin}
            selectedOperative={selectedOperative}
            chartData={chartData}
            individualStats={individualStats}
            metrics={metrics}
          />


          {/* RADAR DE COBROS */}
          {profile && <PaymentAlerts userId={isAdmin && selectedOperative !== 'global' ? selectedOperative : profile.id} isAdmin={isAdmin && selectedOperative === 'global'} />}


          {/* TABLA DE EXPEDIENTES */}
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-800">
                <FileText size={22} className="text-gray-400" />
                Últimas Proformas
              </h3>
              <Link href="/dashboard/cotizaciones" className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                Ver Todo <ChevronRight size={14} />
              </Link>
            </div>
            <QuotesTable quotes={quotes} isAdmin={isAdmin} onUpdate={fetchDashboardData} />
          </div>

          {/* MÓDULO INTELIGENTE DE ANÁLISIS DE VENTAS NO CONCRETADAS (PÉRDIDAS) */}
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
              <div>
                <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-800">
                  <AlertTriangle size={22} className="text-amber-500" />
                  Análisis de Ventas No Concretadas
                </h3>
                <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-widest">
                  {selectedOperative === 'global' ? 'Monitoreo global de motivos de pérdida' : 'Causas de anulación de tu embudo'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select 
                  className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5 text-xs font-black text-gray-700 uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={lostFilter}
                  onChange={e => setLostFilter(e.target.value)}
                >
                  <option value="ALL">Todos los Motivos</option>
                  <option value="Precio">Precio</option>
                  <option value="No cerró Agencia">No cerró Agencia</option>
                  <option value="No contestó Operador">No contestó Operador</option>
                  <option value="Otro">Otros</option>
                </select>

                <button 
                  onClick={handleExportLostQuotes}
                  className="bg-gray-900 hover:bg-primary text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                  title="Descargar reporte en Excel / CSV"
                >
                  <Download size={16} /> Exportar XLS
                </button>
              </div>
            </div>

            {/* Listado de Pérdidas Filtradas */}
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
              {lostQuotes.filter(q => lostFilter === 'ALL' || (q.motivo_perdida || '').toLowerCase().includes(lostFilter.toLowerCase())).length === 0 ? (
                <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No se encontraron proformas perdidas con este filtro</p>
                </div>
              ) : (
                lostQuotes
                  .filter(q => lostFilter === 'ALL' || (q.motivo_perdida || '').toLowerCase().includes(lostFilter.toLowerCase()))
                  .map((q, i) => (
                    <div key={i} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-amber-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                            {q.motivo_perdida || 'Sin Motivo'}
                          </span>
                          <span className="text-xs font-black text-gray-900">{q.codigo}</span>
                          <span className="text-xs text-gray-400 font-bold">· {q.agencia || 'Directo'} {q.comercial ? `(${q.comercial})` : ''}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-700 italic pt-1">
                          "{q.notas_seguimiento || 'Sin observaciones registradas'}"
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-right border-t md:border-t-0 pt-2 md:pt-0 border-gray-200">
                        <div>
                          <p className="text-xs font-black text-gray-800 uppercase">{q.destino}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{q.profiles?.nombre || 'Asesor'}</p>
                        </div>
                        <div className="text-[10px] font-black text-gray-400 bg-white px-2.5 py-1.5 rounded-xl border border-gray-100 shadow-sm">
                          {q.created_at ? q.created_at.split('T')[0] : '---'}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>


        {/* COLUMNA DERECHA: META, LEADERBOARD, INSIGHTS */}
        <div className="space-y-10">
          
          {/* CUMPLIMIENTO DE META */}
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><Trophy size={120} /></div>
            <div className="flex items-center justify-between mb-10">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                <Trophy className="text-amber-500" size={24} />
                Meta {selectedOperative === 'global' ? 'Global' : 'Individual'}
              </h3>
              <div className="bg-primary/10 px-3 py-1 rounded-full"><span className="text-xs font-black text-primary uppercase">Mes Actual</span></div>
            </div>

            <div className="flex items-end justify-between mb-4">
              <div><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Completado</p><p className="text-4xl font-black text-gray-900 tracking-tighter">${metrics.metaComputable.toLocaleString()}</p></div>
              <div className="text-right"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Objetivo</p><p className="text-2xl font-black text-gray-400">${metrics.globalGoal.toLocaleString()}</p></div>
            </div>
            <div className="w-full bg-gray-100 h-8 rounded-full overflow-hidden mb-6 p-1.5 border border-gray-50">
              <div className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(0,102,204,0.3)] relative overflow-hidden" style={{ width: `${Math.min(metrics.porcentajeMeta, 100)}%` }}>
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-sm font-black text-gray-800"><TrendingUp size={18} className="text-success" />{metrics.porcentajeMeta.toFixed(1)}% Cumplido</div>
              <div className="text-xs font-bold text-gray-400 uppercase">Restan ${(metrics.globalGoal - metrics.metaComputable).toLocaleString()}</div>
            </div>
          </div>

          {/* RANKING DEL EQUIPO — visible para todos, con contexto motivacional */}
          <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                <Trophy size={22} className="text-amber-500" />Ranking del Equipo
              </h3>
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full">Mes Actual</span>
            </div>
            <div className="space-y-4">
              {leaderboard.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin datos este mes aún</p>
              )}
              {leaderboard.map((op, idx) => {
                const isMe = profile?.nombre?.split(' ')[0] === op.nombre || profile?.nombre === op.nombreCompleto
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`
                const barColor = op.cumplimiento >= 100 ? '#16A34A' : op.cumplimiento >= 60 ? '#0066CC' : '#F5A623'
                return (
                  <div
                    key={op.id}
                    className={`p-5 rounded-2xl border transition-all group ${
                      isMe
                        ? 'bg-primary/5 border-primary/20 ring-2 ring-primary/10'
                        : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'
                    } ${isAdmin ? 'cursor-pointer hover:shadow-md' : ''}`}
                    onClick={() => isAdmin && handleOpenOperativePanel(op)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{medal}</span>
                        <div>
                          <p className={`text-base font-black leading-none ${ isMe ? 'text-primary' : 'text-gray-800'} group-hover:text-primary transition-colors`}>
                            {op.nombre} {isMe && <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-1 uppercase">Tú</span>}
                          </p>
                          <p className="text-xs text-gray-400 font-bold uppercase mt-1">Meta: ${op.meta.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-gray-900">${op.total.toLocaleString()}</p>
                        <p className={`text-xs font-black uppercase ${ op.cumplimiento >= 100 ? 'text-success' : op.cumplimiento >= 60 ? 'text-primary' : 'text-amber-600'}`}>{op.cumplimiento.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(op.cumplimiento, 100)}%`, background: barColor }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

                   {/* INTELIGENCIA COMERCIAL */}
          <div className="bg-gray-900 p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <h3 className="font-black text-2xl uppercase tracking-tighter mb-6 relative z-10 flex items-center gap-3"><PieIcon size={24} className="text-primary" />Inteligencia Comercial</h3>
            <div className="space-y-8 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-5 rounded-3xl border border-white/5"><p className="text-xs font-black text-primary uppercase tracking-widest mb-1">Destino más pedido</p><p className="text-xl font-black uppercase italic truncate">{metrics.topDestino}</p></div>
                <div className="bg-white/5 p-5 rounded-3xl border border-white/5"><p className="text-xs font-black text-success uppercase tracking-widest mb-1">Tasa de Cierre</p><p className="text-3xl font-black">{metrics.conversionRate.toFixed(0)}%</p></div>
              </div>
              <div className="mt-4">
                <AIInsightCard 
                  modo={isAdmin && selectedOperative === 'global' ? 'GLOBAL_ADMIN' : 'OPERATIVE'}
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
                    topMotivos: metrics.topMotivos
                  }} 
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
