'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import StatsCard from '@/components/StatsCard'
import QuotesTable from '@/components/QuotesTable'
import GlobalSearch from '@/components/GlobalSearch'
import SalesModal from '@/components/SalesModal'
import PaymentAlerts from '@/components/PaymentAlerts'
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
  Plus
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [selectedOperative])

  async function fetchDashboardData() {
    try {
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
        const { data: ops } = await supabase.from('profiles').select('id, nombre').eq('rol', 'operativo')
        setOperatives(ops || [])
      }

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      // 1. Ventas del mes (comision+utilidad = ganancia)
      let ventasQuery = supabase.from('ventas').select('total, comision, utilidad, operativo_id').eq('estado', 'activa')
      if (!isAdmin) ventasQuery = ventasQuery.eq('operativo_id', user.id)
      else if (selectedOperative !== 'global') ventasQuery = ventasQuery.eq('operativo_id', selectedOperative)
      ventasQuery = ventasQuery.gte('created_at', startOfMonth.toISOString())
      const { data: ventasData } = await ventasQuery
      const totalMetaComp = ventasData?.reduce((acc, v) => acc + (Number(v.comision) || 0) + (Number(v.utilidad) || 0), 0) || 0

      // 2. Total Vendido: desde cotizaciones ganadas (más confiable que ventas.total que puede ser 0)
      const targetForTotal = !isAdmin ? user.id : selectedOperative !== 'global' ? selectedOperative : null
      let cotGanadasQuery = supabase.from('cotizaciones').select('valor_total').eq('estado', 'ganada').gte('created_at', startOfMonth.toISOString())
      if (targetForTotal) cotGanadasQuery = cotGanadasQuery.eq('operativo_id', targetForTotal)
      const { data: cotGanadas } = await cotGanadasQuery
      const totalV = cotGanadas?.reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0) || 0

      // 3. Pipeline y cotizaciones abiertas
      let quotesQuery = supabase.from('cotizaciones').select('*, profiles(nombre)').order('created_at', { ascending: false })
      let pipelineQuery = supabase.from('cotizaciones').select('valor_total, destino, estado').eq('estado', 'abierta')
      let openCountQuery = supabase.from('cotizaciones').select('id', { count: 'exact', head: true }).eq('estado', 'abierta')

      const targetIdForIndividual = (!isAdmin || selectedOperative !== 'global') ? (isAdmin ? selectedOperative : user.id) : null

      if (targetIdForIndividual) {
        quotesQuery = quotesQuery.eq('operativo_id', targetIdForIndividual)
        pipelineQuery = pipelineQuery.eq('operativo_id', targetIdForIndividual)
        openCountQuery = openCountQuery.eq('operativo_id', targetIdForIndividual)

        const { data: statusData } = await supabase.from('cotizaciones').select('estado').eq('operativo_id', targetIdForIndividual)
        const stats = [
          { name: 'Ganadas', value: statusData?.filter(q => q.estado === 'ganada').length || 0, color: '#16A34A' },
          { name: 'Abiertas', value: statusData?.filter(q => q.estado === 'abierta').length || 0, color: '#0066CC' },
          { name: 'Perdidas', value: statusData?.filter(q => q.estado === 'perdida').length || 0, color: '#F5A623' },
          { name: 'Anuladas', value: statusData?.filter(q => q.estado === 'anulada').length || 0, color: '#DC2626' }
        ]
        setIndividualStats(stats)

        const { count: vCount } = await supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('operativo_id', targetIdForIndividual)
        const totalQ = statusData?.length || 0
        const wonQ = statusData?.filter(q => q.estado === 'ganada').length || 0
        setMetrics(prev => ({ ...prev, vouchersEmitidos: vCount || 0, conversionRate: totalQ > 0 ? (wonQ / totalQ) * 100 : 0 }))
      } else {
        // Admin global: contar todas las abiertas
        const { count: openCount } = await openCountQuery
        setMetrics(prev => ({ ...prev, cotizacionesAbiertas: openCount || 0 }))
      }

      const { data: pipelineData } = await pipelineQuery
      const totalPipeline = pipelineData?.reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0) || 0
      
      // Optimización del destino más popular
      const destMap = {}
      pipelineData?.forEach(q => { if(q.destino) destMap[q.destino] = (destMap[q.destino] || 0) + 1 })
      const popular = Object.keys(destMap).sort((a,b) => destMap[b] - destMap[a])[0] || 'N/A'

      // 3. Leaderboard — llamar a la API que usa service_role para saltar RLS
      const resBoard = await fetch('/api/leaderboard')
      const boardData = await resBoard.json()
      const board = boardData.success ? boardData.leaderboard : []


      setLeaderboard(board || [])
      // Siempre actualizar chartData para gráfico de barras
      setChartData(board || [])

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
        porcentajeMeta: metaBase > 0 ? (totalMetaComp / metaBase) * 100 : 0
      }))

      const { data: quotesData } = await quotesQuery.limit(10)
      setQuotes(quotesData || [])

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#F5F7FA]">
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Sincronizando Business Intelligence...</p>
      </div>
    </div>
  )

  const isAdmin = profile?.rol === 'admin'

  // Abrir panel de operativo (admin drill-down)
  const handleOpenOperativePanel = async (op) => {
    if (!isAdmin) return
    // Carga detallada de ese operativo
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
    const [{ data: ventas }, { data: cots }, { count: vouchers }] = await Promise.all([
      supabase.from('ventas').select('total,comision,utilidad,created_at').eq('operativo_id', op.id).eq('estado','activa').gte('created_at', startOfMonth.toISOString()),
      supabase.from('cotizaciones').select('estado,valor_total').eq('operativo_id', op.id),
      supabase.from('vouchers').select('id', { count:'exact', head:true }).eq('operativo_id', op.id)
    ])
    const ganancia = ventas?.reduce((a,v)=>a+(Number(v.comision)||0)+(Number(v.utilidad)||0),0)||0
    const totalVendido = cots?.filter(c=>c.estado==='ganada').reduce((a,c)=>a+(Number(c.valor_total)||0),0)||0
    const ganadas = cots?.filter(c=>c.estado==='ganada').length||0
    const abiertas = cots?.filter(c=>c.estado==='abierta').length||0
    const perdidas = cots?.filter(c=>['perdida','anulada'].includes(c.estado)).length||0
    const totalCots = cots?.length||0
    setOperativePanel({
      ...op,
      ganancia,
      totalVendido,
      ganadas,
      abiertas,
      perdidas,
      totalCots,
      vouchers: vouchers||0,
      conversion: totalCots>0 ? ((ganadas/totalCots)*100).toFixed(1) : 0
    })
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">

      {/* PANEL DRILL-DOWN DE OPERATIVO (ADMIN) */}
      {operativePanel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={() => setOperativePanel(null)}>
          <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 text-white p-8 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg">{operativePanel.avatar}</div>
                <div>
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Perfil de Operativo</p>
                  <h2 className="text-2xl font-black tracking-tight">{operativePanel.nombreCompleto}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Meta mensual: ${operativePanel.meta?.toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => setOperativePanel(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-xl font-black">✕</button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cumplimiento de Meta (Mes)</span>
                  <span className={`text-[10px] font-black uppercase ${operativePanel.cumplimiento >= 100 ? 'text-success' : operativePanel.cumplimiento >= 60 ? 'text-primary' : 'text-amber-600'}`}>{Number(operativePanel.cumplimiento).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(operativePanel.cumplimiento, 100)}%`, background: operativePanel.cumplimiento >= 100 ? '#16A34A' : operativePanel.cumplimiento >= 60 ? '#0066CC' : '#F5A623' }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-success font-black">Ganancia: ${operativePanel.ganancia?.toLocaleString()}</span>
                  <span className="text-[9px] text-gray-400 font-bold">Restan: ${Math.max(0, (operativePanel.meta||0) - (operativePanel.ganancia||0)).toLocaleString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Total Vendido (Mes)</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">${operativePanel.totalVendido?.toLocaleString()}</p>
                </div>
                <div className="bg-success/5 p-5 rounded-2xl border border-success/10">
                  <p className="text-[9px] font-black text-success/70 uppercase">Ganancia (Mes)</p>
                  <p className="text-2xl font-black text-success mt-1">${operativePanel.ganancia?.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Tasa de Cierre</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{operativePanel.conversion}%</p>
                </div>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Vouchers Emitidos</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{operativePanel.vouchers}</p>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Proformas (histórico total)</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Ganadas', val: operativePanel.ganadas, color: 'text-success bg-success/10 border-success/20' },
                    { label: 'En Proceso', val: operativePanel.abiertas, color: 'text-primary bg-primary/10 border-primary/20' },
                    { label: 'Perdidas', val: operativePanel.perdidas, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                  ].map(item => (
                    <div key={item.label} className={`p-3 rounded-2xl text-center border ${item.color}`}>
                      <p className="text-2xl font-black">{item.val}</p>
                      <p className="text-[9px] font-black uppercase mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
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
            <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.3em] ml-1">
              {isAdmin ? 'Panel de Control de Operaciones Globales' : 'Tu Resumen de Inteligencia Comercial'}
            </p>
          </div>
          <GlobalSearch />
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[2rem] shadow-xl border border-gray-100">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
              <Filter size={16} className="text-primary" />
              <span className="text-[10px] font-black uppercase text-gray-400">Filtrar por Operativo:</span>
            </div>
            <select 
              value={selectedOperative}
              onChange={(e) => setSelectedOperative(e.target.value)}
              className="bg-transparent border-none font-black text-sm text-gray-800 outline-none pr-8 cursor-pointer focus:ring-0"
            >
              <option value="global">Vista Global (Todo el equipo)</option>
              {operatives.map(op => (
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
          title={isAdmin ? 'Ganancia del Equipo' : 'Mi Ganancia Total'} 
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
          
          {/* GRÁFICO DE RENDIMIENTO GLOBAL */}
          {isAdmin && selectedOperative === 'global' && (
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 animate-in zoom-in duration-500">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                    <BarChart3 className="text-primary" size={24} />
                    Rendimiento por Asesor
                  </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase">Ventas ($)</span>
                  </div>
                </div>
              </div>
              
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 900 }} />
                    <Tooltip cursor={{ fill: '#F8FAFC' }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{payload[0].payload.nombre}</p>
                            <p className="text-xl font-black">${payload[0].value.toLocaleString()}</p>
                            <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase italic">{payload[0].payload.cumplimiento.toFixed(1)}% de meta cumplida</p>
                          </div>
                        )
                      }
                      return null
                    }} />
                    <Bar dataKey="total" radius={[10, 10, 10, 10]} barSize={40}>
                      {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#0066CC' : '#E2E8F0'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* GRÁFICO DE RENDIMIENTO INDIVIDUAL (OPERATIVO) */}
          {(selectedOperative !== 'global' || !isAdmin) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in duration-500">
              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-800">
                    <PieIcon className="text-primary" size={24} />
                    Embudo de Venta
                  </h3>
                  <div className="bg-success/10 px-4 py-2 rounded-2xl">
                    <p className="text-[9px] font-black text-success uppercase">Conversión</p>
                    <p className="text-lg font-black text-success">{metrics.conversionRate.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={individualStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }} width={80} />
                      <Tooltip cursor={{ fill: '#F8FAFC' }} />
                      <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={35}>
                        {individualStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10"><TrendingUp size={140} /></div>
                <h3 className="font-black text-xl uppercase tracking-tighter mb-8 relative z-10">Tu Aporte al Equipo</h3>
                <div className="flex items-center justify-center h-[180px] relative z-10">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2">Market Share</p>
                    <p className="text-6xl font-black text-white italic">
                      {metrics.globalGoal > 0 ? ((metrics.metaComputable / metrics.globalGoal) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-4 tracking-widest">De la meta global de CTB</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RADAR DE COBROS */}
          {profile && <PaymentAlerts userId={profile.id} isAdmin={isAdmin} />}

          {/* TABLA DE EXPEDIENTES */}
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-50">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-800">
                <FileText size={22} className="text-gray-400" />
                Últimas Proformas
              </h3>
              <Link href="/dashboard/cotizaciones" className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                Ver Todo <ChevronRight size={14} />
              </Link>
            </div>
            <QuotesTable quotes={quotes} isAdmin={isAdmin} onUpdate={fetchDashboardData} />
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
              <div className="bg-primary/10 px-3 py-1 rounded-full"><span className="text-[10px] font-black text-primary uppercase">Mes Actual</span></div>
            </div>
            <div className="flex items-end justify-between mb-4">
              <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Completado</p><p className="text-4xl font-black text-gray-900 tracking-tighter">${metrics.metaComputable.toLocaleString()}</p></div>
              <div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Objetivo</p><p className="text-xl font-black text-gray-400">${metrics.globalGoal.toLocaleString()}</p></div>
            </div>
            <div className="w-full bg-gray-100 h-8 rounded-full overflow-hidden mb-6 p-1.5 border border-gray-50">
              <div className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(0,102,204,0.3)] relative overflow-hidden" style={{ width: `${Math.min(metrics.porcentajeMeta, 100)}%` }}>
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-xs font-black text-gray-800"><TrendingUp size={16} className="text-success" />{metrics.porcentajeMeta.toFixed(1)}% Cumplido</div>
              <div className="text-[9px] font-bold text-gray-400 uppercase">Restan ${(metrics.globalGoal - metrics.metaComputable).toLocaleString()}</div>
            </div>
          </div>

          {/* RANKING DEL EQUIPO — visible para todos, con contexto motivacional */}
          <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                <Trophy size={22} className="text-amber-500" />Ranking del Equipo
              </h3>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full">Mes Actual</span>
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
                    className={`p-4 rounded-2xl border transition-all group ${
                      isMe
                        ? 'bg-primary/5 border-primary/20 ring-2 ring-primary/10'
                        : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'
                    } ${isAdmin ? 'cursor-pointer hover:shadow-md' : ''}`}
                    onClick={() => isAdmin && handleOpenOperativePanel(op)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{medal}</span>
                        <div>
                          <p className={`text-sm font-black leading-none ${ isMe ? 'text-primary' : 'text-gray-800'} group-hover:text-primary transition-colors`}>
                            {op.nombre} {isMe && <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-1 uppercase">Tú</span>}
                          </p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Meta: ${op.meta.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-900">${op.total.toLocaleString()}</p>
                        <p className={`text-[9px] font-black uppercase ${ op.cumplimiento >= 100 ? 'text-success' : op.cumplimiento >= 60 ? 'text-primary' : 'text-amber-600'}`}>{op.cumplimiento.toFixed(0)}%</p>
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
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5"><p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Destino más pedido</p><p className="text-lg font-black uppercase italic truncate">{metrics.topDestino}</p></div>
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5"><p className="text-[9px] font-black text-success uppercase tracking-widest mb-1">Tasa de Cierre</p><p className="text-2xl font-black">{metrics.conversionRate.toFixed(0)}%</p></div>
              </div>
              <div className="bg-primary/10 p-6 rounded-[2rem] border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="bg-primary p-2 rounded-xl text-white mt-1"><Target size={16} /></div>
                  <div><p className="text-[10px] font-black uppercase tracking-widest mb-1">Consejo del sistema</p><p className="text-xs italic leading-relaxed text-gray-300">{`Hay $${metrics.pipeline.toLocaleString()} en proformas por cerrar. ${selectedOperative === 'global' ? 'Dale seguimiento al equipo y prioriza los casos de mayor valor.' : 'Enfócate en cerrar las proformas de mayor valor para alcanzar tu meta.'}`}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SalesModal />
    </div>
  )
}
