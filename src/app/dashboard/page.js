'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import StatsCard from '@/components/StatsCard'
import { 
  DollarSign, 
  TrendingUp, 
  FileText, 
  Target,
  Trophy
} from 'lucide-react'

export default function DashboardPage() {
  const [profile, setProfile] = useState(null)
  const [metrics, setMetrics] = useState({
    totalVendido: 0,
    metaComputable: 0,
    cotizacionesAbiertas: 0,
    porcentajeMeta: 0
  })
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

      // Obtener Ventas del Mes
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: ventasData } = await supabase
        .from('ventas')
        .select('total, meta_computable')
        .eq('operativo_id', user.id)
        .gte('created_at', startOfMonth.toISOString())

      const totalV = ventasData?.reduce((acc, v) => acc + Number(v.total), 0) || 0
      const totalMetaComp = ventasData?.reduce((acc, v) => acc + Number(v.meta_computable), 0) || 0

      // Obtener Cotizaciones Abiertas
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

  if (loading) return <div className="p-8 text-center font-medium text-gray-500">Cargando Dashboard...</div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bienvenido, {profile?.nombre}</h1>
        <p className="text-gray-500 mt-1">Aquí tienes el resumen de tu actividad comercial este mes.</p>
      </div>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Vendido (Bruto)" 
          value={`$${metrics.totalVendido.toLocaleString()}`} 
          icon={DollarSign}
          trend="+12.5%"
          color="primary"
        />
        <StatsCard 
          title="Aporte a Meta" 
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
          title="Cotizaciones Abiertas" 
          value={metrics.cotizacionesAbiertas} 
          icon={FileText}
          color="danger"
        />
      </div>

      {/* Sección de Meta y Progreso */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Trophy className="text-yellow-500" size={24} />
              Progreso hacia la Meta
            </h3>
            <span className="text-sm font-bold text-primary">{metrics.porcentajeMeta.toFixed(1)}%</span>
          </div>
          
          <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,102,204,0.4)]"
              style={{ width: `${Math.min(metrics.porcentajeMeta, 100)}%` }}
            ></div>
          </div>
          
          <p className="text-sm text-gray-500">
            {metrics.porcentajeMeta >= 100 
              ? '✅ ¡Has superado tu meta este mes! Felicidades.' 
              : `Te faltan $${(profile?.meta_mensual - metrics.metaComputable).toLocaleString()} para alcanzar tu objetivo.`}
          </p>
        </div>

        <div className="card bg-primary text-white border-none shadow-lg shadow-primary/20">
          <h3 className="font-bold text-lg mb-2">Consejo del día</h3>
          <p className="text-primary-foreground/80 text-sm leading-relaxed">
            Las cotizaciones que se responden en menos de 1 hora tienen un 40% más de probabilidad de cerrarse. ¡No dejes esperar a tus agencias!
          </p>
        </div>
      </div>
    </div>
  )
}
