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
  Users
} from 'lucide-react'

export default function DashboardPage() {
  const [profile, setProfile] = useState(null)
  const [metrics, setMetrics] = useState({
    totalVendido: 0,
    metaComputable: 0,
    cotizacionesAbiertas: 0,
    porcentajeMeta: 0,
    pipeline: 0,
    topDestino: 'N/A'
  })
  const [leaderboard, setLeaderboard] = useState([])
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

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
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      // 1. Ventas y Meta
      let ventasQuery = supabase.from('ventas').select('total, comision, utilidad, operativo_id').eq('estado', 'activa')
      if (!isAdmin) ventasQuery = ventasQuery.eq('operativo_id', user.id)
      ventasQuery = ventasQuery.gte('created_at', startOfMonth.toISOString())

      const { data: ventasData } = await ventasQuery
      const totalV = ventasData?.reduce((acc, v) => acc + Number(v.total), 0) || 0
      const totalMetaComp = ventasData?.reduce((acc, v) => acc + Number(v.comision) + Number(v.utilidad), 0) || 0

      // 2. Pipeline (Cotizaciones Abiertas)
      let pipelineQuery = supabase.from('cotizaciones').select('valor_total, destino').eq('estado', 'abierta')
      if (!isAdmin) pipelineQuery = pipelineQuery.eq('operativo_id', user.id)
      
      const { data: pipelineData } = await pipelineQuery
      const totalPipeline = pipelineData?.reduce((acc, q) => acc + Number(q.valor_total || 0), 0) || 0

      // Encontrar destino más popular
      const destinos = pipelineData?.map(q => q.destino).filter(Boolean)
      const popular = destinos?.length > 0 
        ? destinos.sort((a,b) => destinos.filter(v => v===a).length - destinos.filter(v => v===b).length).pop()
        : 'N/A'

      // 3. Leaderboard (Solo Admin)
      if (isAdmin) {
        const { data: allOperatives } = await supabase.from('profiles').select('id, nombre, meta_mensual').eq('rol', 'operativo')
        
        const board = allOperatives?.map(op => {
          const opVentas = ventasData?.filter(v => v.operativo_id === op.id) || []
          const totalOp = opVentas.reduce((acc, v) => acc + Number(v.comision) + Number(v.utilidad), 0) || 0
          return {
            id: op.id,
            nombre: op.nombre,
            total: totalOp,
            cumplimiento: (totalOp / op.meta_mensual) * 100,
            avatar: op.nombre.charAt(0)
          }
        }).sort((a, b) => b.total - a.total)
        
        setLeaderboard(board || [])
      }

      // 4. Últimas Cotizaciones
      let quotesQuery = supabase.from('cotizaciones').select('*, profiles(nombre)').order('created_at', { ascending: false })
      if (!isAdmin) quotesQuery = quotesQuery.eq('operativo_id', user.id)
      
      const { data: quotesData } = await quotesQuery.limit(10)
      setQuotes(quotesData || [])

      // Contar abiertas (solo personales)
      const { count: openQuotesCount } = await supabase
        .from('cotizaciones')
        .select('*', { count: 'exact', head: true })
        .eq('operativo_id', user.id)
        .eq('estado', 'abierta')

      setMetrics({
        totalVendido: totalV,
        metaComputable: totalMetaComp,
        cotizacionesAbiertas: openQuotesCount || 0,
        porcentajeMeta: profileData ? (totalMetaComp / profileData.meta_mensual) * 100 : 0,
        pipeline: totalPipeline,
        topDestino: popular
      })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#F5F7FA]">
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Cargando Inteligencia Operativa...</p>
      </div>
    </div>
  )

  const isAdmin = profile?.rol === 'admin'

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic">
            {isAdmin ? 'Intelligence Hub' : `Bienvenido, ${profile?.nombre?.split(' ')[0]}`}
          </h1>
          <p className="text-gray-400 mt-1 font-bold text-xs uppercase tracking-widest">
            {isAdmin ? 'Monitor global de rendimiento y proyecciones' : 'Tu resumen de actividad comercial este mes.'}
          </p>
        </div>
        
        {isAdmin && (
          <div className="bg-white px-6 py-4 rounded-3xl border border-gray-100 shadow-xl flex items-center gap-4 animate-in slide-in-from-right-4">
            <div className="bg-success/10 p-3 rounded-2xl text-success">
              <Trophy size={24} />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Cierre Global Mes</p>
              <p className="text-2xl font-black text-gray-900 leading-none">${metrics.metaComputable.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Grid de Métricas Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title={isAdmin ? "Venta Total Bruta" : "Mis Ventas (Bruto)"}
          value={`$${metrics.totalVendido.toLocaleString()}`} 
          icon={DollarSign}
          color="primary"
        />
        <StatsCard 
          title="Pipeline (Proyección)" 
          value={`$${metrics.pipeline.toLocaleString()}`} 
          icon={Target}
          color="accent"
        />
        <StatsCard 
          title="Aporte a Meta" 
          value={`$${metrics.metaComputable.toLocaleString()}`} 
          icon={TrendingUp}
          color="success"
        />
        <StatsCard 
          title="Quotes Abiertas" 
          value={metrics.cotizacionesAbiertas} 
          icon={FileText}
          color="danger"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* RADAR DE COBROS */}
          {profile && <PaymentAlerts userId={profile.id} isAdmin={isAdmin} />}

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                <Trophy className="text-amber-500" size={24} />
                Cumplimiento de Meta {isAdmin ? 'Global' : ''}
              </h3>
              <div className="text-right">
                <span className="text-3xl font-black text-primary leading-none">{metrics.porcentajeMeta.toFixed(1)}%</span>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Progreso Actual</p>
              </div>
            </div>
            
            <div className="w-full bg-gray-100 h-6 rounded-full overflow-hidden mb-4 p-1">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(0,102,204,0.3)] relative overflow-hidden"
                style={{ width: `${Math.min(metrics.porcentajeMeta, 100)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic text-center">
              * Meta calculada sobre Comisión + Utilidad Mensual
            </p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
            <h3 className="font-black text-xl uppercase tracking-tighter mb-6 flex items-center gap-3">
              <FileText size={22} className="text-gray-400" />
              Expedientes Recientes
            </h3>
            <QuotesTable 
              quotes={quotes} 
              isAdmin={isAdmin} 
              onUpdate={fetchDashboardData} 
            />
          </div>
        </div>

        <div className="space-y-8">
          {/* LEADERBOARD (Solo Admin) */}
          {isAdmin && (
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100">
              <h3 className="font-black text-xl uppercase tracking-tighter mb-6 flex items-center gap-3">
                <Trophy size={20} className="text-amber-500" />
                Top Performers
              </h3>
              <div className="space-y-5">
                {leaderboard.length > 0 ? leaderboard.map((op, idx) => (
                  <div key={op.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                        {op.avatar}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900 leading-none mb-1">{op.nombre.split(' ')[0]}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{op.cumplimiento.toFixed(0)}% de Meta</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-900">${op.total.toLocaleString()}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-gray-400 italic text-center">No hay actividad este mes</p>
                )}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="bg-primary p-8 rounded-[3rem] text-white shadow-2xl shadow-primary/40">
              <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 mb-6">
                <Users size={24} />
                Gestión
              </h3>
              <div className="space-y-3">
                <a href="/dashboard/usuarios" className="block w-full text-center py-4 bg-white text-primary rounded-2xl font-black text-sm hover:scale-[1.02] transition-all shadow-lg">
                  Panel de Operativos
                </a>
                <p className="text-[9px] text-white/60 text-center px-4 font-bold uppercase tracking-widest italic">
                  Configura metas y permisos
                </p>
              </div>
            </div>
          )}

          {/* KPI Dinámico Card */}
          <div className="bg-gray-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <h3 className="font-black text-2xl uppercase tracking-tighter mb-4 relative z-10">Business Insights</h3>
            <div className="space-y-6 relative z-10">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">Top Destino</p>
                <p className="text-lg font-black uppercase italic">{metrics.topDestino}</p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="text-[9px] font-black text-success uppercase tracking-[0.2em] mb-1">Conversión Est.</p>
                <p className="text-3xl font-black">24%</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-widest italic">Tip de Gestión</p>
                <p className="text-xs italic leading-relaxed text-gray-300">"Las cotizaciones en estado 'Abierta' representan un potencial de ${metrics.pipeline.toLocaleString()} este mes. Prioriza el seguimiento."</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SalesModal />
    </div>
  )
}
