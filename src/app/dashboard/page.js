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
    totalGlobalEmpresa: 0
  })
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

      // Query dinámico para Ventas
      let ventasQuery = supabase.from('ventas').select('total, comision, utilidad').eq('estado', 'activa')
      if (!isAdmin) {
        ventasQuery = ventasQuery.eq('operativo_id', user.id)
      }
      ventasQuery = ventasQuery.gte('created_at', startOfMonth.toISOString())

      const { data: ventasData } = await ventasQuery

      const totalV = ventasData?.reduce((acc, v) => acc + Number(v.total), 0) || 0
      const totalMetaComp = ventasData?.reduce((acc, v) => acc + Number(v.comision) + Number(v.utilidad), 0) || 0

      // Query dinámico para Cotizaciones
      let quotesQuery = supabase
        .from('cotizaciones')
        .select('*, profiles(nombre)')
        .order('created_at', { ascending: false })
      
      if (!isAdmin) {
        quotesQuery = quotesQuery.eq('operativo_id', user.id)
      }
      
      const { data: quotesData } = await quotesQuery.limit(10)
      setQuotes(quotesData || [])

      // Contar abiertas (solo personales)
      const { count: openQuotes } = await supabase
        .from('cotizaciones')
        .select('*', { count: 'exact', head: true })
        .eq('operativo_id', user.id)
        .eq('estado', 'abierta')

      setMetrics({
        totalVendido: totalV,
        metaComputable: totalMetaComp,
        cotizacionesAbiertas: openQuotes || 0,
        porcentajeMeta: profileData ? (totalMetaComp / profileData.meta_mensual) * 100 : 0
      })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-center font-medium text-gray-500 animate-pulse">Cargando Inteligencia Operativa...</div>

  const isAdmin = profile?.rol === 'admin'

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {isAdmin ? 'Dashboard General' : `Bienvenido, ${profile?.nombre?.split(' ')[0]}`}
          </h1>
          <p className="text-gray-500 mt-1 font-medium italic">
            {isAdmin ? 'Métricas de rendimiento de todo el equipo' : 'Tu resumen de actividad comercial este mes.'}
          </p>
        </div>
        
        {isAdmin && (
          <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10 flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg text-white">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-primary uppercase">Cierre Global Mes</p>
              <p className="text-lg font-black text-primary">${metrics.metaComputable.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title={isAdmin ? "Total Ventas Equipo" : "Mis Ventas (Bruto)"}
          value={`$${metrics.totalVendido.toLocaleString()}`} 
          icon={DollarSign}
          color="primary"
        />
        <StatsCard 
          title={isAdmin ? "Aporte Global" : "Mi Aporte a Meta"} 
          value={`$${metrics.metaComputable.toLocaleString()}`} 
          icon={TrendingUp}
          color="success"
        />
        <StatsCard 
          title="Meta Mensual" 
          value={`$${profile?.meta_mensual?.toLocaleString()}`} 
          icon={Target}
          color="accent"
        />
        <StatsCard 
          title="Quotes Abiertas" 
          value={metrics.cotizacionesAbiertas} 
          icon={FileText}
          color="danger"
        />
      </div>

      {/* Sección de Meta y Progreso */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          
          {/* RADAR DE COBROS */}
          {profile && <PaymentAlerts userId={profile.id} isAdmin={isAdmin} />}

          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Trophy className="text-yellow-500" size={24} />
                Cumplimiento de Meta {isAdmin ? 'Personal' : ''}
              </h3>
              <span className="text-sm font-bold text-primary">{metrics.porcentajeMeta.toFixed(1)}%</span>
            </div>
            
            <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden mb-4">
              <div 
                className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,102,204,0.4)]"
                style={{ width: `${Math.min(metrics.porcentajeMeta, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 font-medium italic">
              * Calculado sobre Comisión + Utilidad
            </p>
          </div>

          <div className="card">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FileText size={20} className="text-gray-400" />
              Últimas Movimientos
            </h3>
            <QuotesTable 
              quotes={quotes} 
              isAdmin={isAdmin} 
              onUpdate={fetchDashboardData} 
            />
          </div>
        </div>

        <div className="space-y-6">
          {isAdmin && (
            <div className="card border-primary/20 bg-primary/5">
              <h3 className="font-bold text-primary flex items-center gap-2 mb-4">
                <Users size={20} />
                Panel Administrativo
              </h3>
              <div className="space-y-2">
                <a href="/dashboard/usuarios" className="block w-full text-center py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg transition-all">
                  Gestionar Operativos
                </a>
                <p className="text-[10px] text-gray-500 text-center px-4 italic">
                  Crea nuevas cuentas y asigna metas individuales para el equipo.
                </p>
              </div>
            </div>
          )}

          <div className="card bg-gray-900 text-white border-none shadow-xl">
            <h3 className="font-bold text-lg mb-2">KPI Rápido</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              Las cotizaciones de este mes muestran una tasa de conversión estimada del 24%.
            </p>
            <div className="border-t border-white/10 pt-4">
              <p className="text-[10px] uppercase font-bold text-accent mb-1 tracking-widest">Consejo</p>
              <p className="text-sm italic">"El seguimiento constante es la clave del cierre."</p>
            </div>
          </div>
        </div>
      </div>

      <SalesModal />
    </div>
  )
}
