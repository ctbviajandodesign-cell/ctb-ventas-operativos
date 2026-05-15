'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import StatsCard from '@/components/StatsCard'
import QuotesTable from '@/components/QuotesTable'
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
  ChevronRight
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
      const isAdmin = profileData.rol === 'admin'
      const activeOpId = (!isAdmin || selectedOperative === 'global') ? user.id : selectedOperative

      // Si es admin, cargar lista de operativos
      if (isAdmin && operatives.length === 0) {
        const { data: ops } = await supabase.from('profiles').select('id, nombre').eq('rol', 'operativo')
        setOperatives(ops || [])
      }

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      // 1. Ventas y Meta
      let ventasQuery = supabase.from('ventas').select('total, comision, utilidad, operativo_id, profiles(nombre)').eq('estado', 'activa')
      if (!isAdmin) ventasQuery = ventasQuery.eq('operativo_id', user.id)
      else if (selectedOperative !== 'global') ventasQuery = ventasQuery.eq('operativo_id', selectedOperative)
      ventasQuery = ventasQuery.gte('created_at', startOfMonth.toISOString())

      const { data: ventasData } = await ventasQuery
      const totalV = ventasData?.reduce((acc, v) => acc + Number(v.total), 0) || 0
      const totalMetaComp = ventasData?.reduce((acc, v) => acc + Number(v.comision) + Number(v.utilidad), 0) || 0

      // 2. Pipeline y Análisis de Estados (Solo si es individual)
      let quotesQuery = supabase.from('cotizaciones').select('*, profiles(nombre)').order('created_at', { ascending: false })
      let pipelineQuery = supabase.from('cotizaciones').select('valor_total, destino, estado').eq('estado', 'abierta')
      
      if (!isAdmin || selectedOperative !== 'global') {
        const targetId = !isAdmin ? user.id : selectedOperative
        quotesQuery = quotesQuery.eq('operativo_id', targetId)
        pipelineQuery = pipelineQuery.eq('operativo_id', targetId)

        // Análisis de estados para el gráfico individual
        const { data: statusData } = await supabase.from('cotizaciones').select('estado').eq('operativo_id', targetId)
        const stats = [
          { name: 'Ganadas', value: statusData?.filter(q => q.estado === 'ganada').length || 0, color: '#16A34A' },
          { name: 'Abiertas', value: statusData?.filter(q => q.estado === 'abierta').length || 0, color: '#0066CC' },
          { name: 'Perdidas', value: statusData?.filter(q => q.estado === 'perdida').length || 0, color: '#F5A623' },
          { name: 'Anuladas', value: statusData?.filter(q => q.estado === 'anulada').length || 0, color: '#DC2626' }
        ]
        setIndividualStats(stats)

        // Conteo de Vouchers
        const { count: vCount } = await supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('operativo_id', targetId)
        
        const totalQ = statusData?.length || 1
        const wonQ = statusData?.filter(q => q.estado === 'ganada').length || 0

        setMetrics(prev => ({
          ...prev,
          vouchersEmitidos: vCount || 0,
          conversionRate: (wonQ / totalQ) * 100
        }))
      }

      const { data: pipelineData } = await pipelineQuery
      const totalPipeline = pipelineData?.reduce((acc, q) => acc + Number(q.valor_total || 0), 0) || 0
      const popular = pipelineData?.map(q => q.destino).filter(Boolean).sort((a,b) => pipelineData.filter(v => v===a).length - pipelineData.filter(v => v===b).length).pop() || 'N/A'

      // 3. Leaderboard y Gráficos Globales
      if (isAdmin) {
        const { data: allOps } = await supabase.from('profiles').select('id, nombre, meta_mensual').eq('rol', 'operativo')
        const board = allOps?.map(op => {
          const opVentas = (ventasData || []).filter(v => v.operativo_id === op.id)
          const totalOp = opVentas.reduce((acc, v) => acc + Number(v.comision) + Number(v.utilidad), 0) || 0
          return {
            id: op.id,
            nombre: op.nombre.split(' ')[0],
            total: totalOp,
            cumplimiento: (totalOp / (op.meta_mensual || 5000)) * 100,
            avatar: op.nombre.charAt(0)
          }
        }).sort((a, b) => b.total - a.total)
        
        setLeaderboard(board || [])
        if (selectedOperative === 'global') setChartData(board || [])

        const globalM = allOps?.reduce((acc, op) => acc + Number(op.meta_mensual || 0), 0) || 50000
        setMetrics(prev => ({
          ...prev,
          totalVendido: totalV,
          metaComputable: totalMetaComp,
          pipeline: totalPipeline,
          topDestino: popular,
          globalGoal: globalM,
          porcentajeMeta: (totalMetaComp / (selectedOperative === 'global' ? globalM : (allOps.find(o => o.id === selectedOperative)?.meta_mensual || 5000))) * 100
        }))
      }

      const { data: quotesData } = await quotesQuery.limit(10)
      setQuotes(quotesData || [])

      if (!isAdmin) {
        setMetrics(prev => ({
          ...prev,
          totalVendido: totalV,
          metaComputable: totalMetaComp,
          porcentajeMeta: (totalMetaComp / (profileData?.meta_mensual || 5000)) * 100,
          pipeline: totalPipeline,
          topDestino: popular
        }))
      }
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

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      
      {/* HEADER & FILTROS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
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
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Venta Bruta"
          value={`$${metrics.totalVendido.toLocaleString()}`} 
          icon={DollarSign}
          color="primary"
        />
        <StatsCard 
          title="Pipeline (Abierto)" 
          value={`$${metrics.pipeline.toLocaleString()}`} 
          icon={Target}
          color="accent"
        />
        <StatsCard 
          title="Aporte Real" 
          value={`$${metrics.metaComputable.toLocaleString()}`} 
          icon={TrendingUp}
          color="success"
        />
        <StatsCard 
          title={selectedOperative === 'global' && isAdmin ? "Quotes Activas" : "Vouchers Emitidos"} 
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
                  Performance por Operativo
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
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 animate-in zoom-in duration-500">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-800">
                  <PieIcon className="text-primary" size={24} />
                  Status Breakdown & Conversión
                </h3>
                <div className="flex items-center gap-4">
                  <div className="bg-success/10 px-4 py-2 rounded-2xl">
                    <p className="text-[9px] font-black text-success uppercase">Conversión</p>
                    <p className="text-lg font-black text-success">{metrics.conversionRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              <div className="h-[300px] w-full">
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
              <div className="mt-6 grid grid-cols-4 gap-4">
                {individualStats.map((stat, i) => (
                  <div key={i} className="text-center p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">{stat.name}</p>
                    <p className="text-xl font-black text-gray-800 leading-none">{stat.value}</p>
                  </div>
                ))}
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
                Flujo de Expedientes {selectedOperative !== 'global' ? 'del Operativo' : ''}
              </h3>
              <button className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                Ver Todo <ChevronRight size={14} />
              </button>
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

          {/* LEADERBOARD (Solo Admin) */}
          {isAdmin && (
            <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-gray-100">
              <h3 className="font-black text-xl uppercase tracking-tighter mb-8 flex items-center gap-3"><Users size={22} className="text-primary" />Team Leaderboard</h3>
              <div className="space-y-6">
                {leaderboard.map((op, idx) => (
                  <div key={op.id} className="flex items-center justify-between group cursor-pointer" onClick={() => setSelectedOperative(op.id)}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all ${idx === 0 ? 'bg-amber-100 text-amber-600 shadow-lg shadow-amber-200' : 'bg-gray-50 text-gray-400'}`}>{op.avatar}</div>
                      <div><p className="text-sm font-black text-gray-900 leading-none mb-1 group-hover:text-primary transition-colors">{op.nombre}</p>
                        <div className="flex items-center gap-2"><div className="w-20 bg-gray-100 h-1.5 rounded-full overflow-hidden"><div className="h-full bg-success rounded-full" style={{ width: `${Math.min(op.cumplimiento, 100)}%` }}></div></div><span className="text-[9px] font-bold text-gray-400 uppercase">{op.cumplimiento.toFixed(0)}%</span></div>
                      </div>
                    </div>
                    <div className="text-right"><p className="text-sm font-black text-gray-900">${op.total.toLocaleString()}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INSIGHTS DINÁMICOS */}
          <div className="bg-gray-900 p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <h3 className="font-black text-2xl uppercase tracking-tighter mb-6 relative z-10 flex items-center gap-3"><PieIcon size={24} className="text-primary" />BI Insights</h3>
            <div className="space-y-8 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5"><p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Top Destino</p><p className="text-lg font-black uppercase italic truncate">{metrics.topDestino}</p></div>
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5"><p className="text-[9px] font-black text-success uppercase tracking-widest mb-1">Conversión</p><p className="text-2xl font-black">{metrics.conversionRate.toFixed(0)}%</p></div>
              </div>
              <div className="bg-primary/10 p-6 rounded-[2rem] border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="bg-primary p-2 rounded-xl text-white mt-1"><Target size={16} /></div>
                  <div><p className="text-[10px] font-black uppercase tracking-widest mb-1">Estrategia sugerida</p><p className="text-xs italic leading-relaxed text-gray-300">"El pipeline actual de **${metrics.pipeline.toLocaleString()}** indica una oportunidad de cierre agresivo. {selectedOperative === 'global' ? 'Asigna seguimientos prioritarios al Top Performers.' : 'Enfócate en las cotizaciones de mayor valor para llegar a tu meta.'}"</p></div>
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
