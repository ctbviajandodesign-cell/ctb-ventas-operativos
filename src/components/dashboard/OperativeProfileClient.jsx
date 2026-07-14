'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Download, 
  Sparkles, 
  RefreshCw, 
  Target, 
  DollarSign, 
  PieChart as PieIcon,
  QrCode,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react'
import { showToast } from '@/utils/toast'
import { useUserSession } from '@/hooks/useUserSession'
import { getPeriodRange, getPeriodLabel, getEcuadorTime, isExpired } from '@/utils/dateHelpers'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'

export default function OperativeProfileClient({ operativeId }) {
  const router = useRouter()
  const { profile: loggedInProfile, loading: sessionLoading } = useUserSession()
  
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('resumen')
  const [loadingAi, setLoadingAi] = useState(false)
  const [aiInsight, setAiInsight] = useState(null)
  const [isExporting, setIsExporting] = useState(false)

  // Filtros dinámicos
  const [selectedPeriod, setSelectedPeriod] = useState('mes')
  const [focusDate, setFocusDate] = useState(getEcuadorTime())

  const handleNavigatePeriod = (dir) => {
    const newDate = new Date(focusDate)
    if (selectedPeriod === 'dia') newDate.setDate(newDate.getDate() + dir)
    else if (selectedPeriod === 'semana') newDate.setDate(newDate.getDate() + (dir * 7))
    else if (selectedPeriod === 'mes') newDate.setMonth(newDate.getMonth() + dir)
    else if (selectedPeriod === 'año') newDate.setFullYear(newDate.getFullYear() + dir)
    setFocusDate(newDate)
  }

  useEffect(() => {
    if (sessionLoading) return
    if (loggedInProfile && loggedInProfile.rol !== 'admin' && loggedInProfile.rol !== 'superadmin' && loggedInProfile.rol !== 'auditor') {
      showToast('Acceso denegado. Se requiere rol de administrador o auditor.', 'error')
      router.push('/dashboard')
      return
    }
    fetchOperativeData()
  }, [operativeId, sessionLoading, loggedInProfile, selectedPeriod, focusDate])

  async function fetchOperativeData() {
    setLoading(true)
    try {
      const { data: opProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', operativeId)
        .single()

      if (!opProfile) {
        showToast('Operativo no encontrado', 'error')
        router.push('/dashboard/usuarios')
        return
      }

      if (loggedInProfile?.rol === 'auditor' && loggedInProfile?.ciudad !== 'Nacional') {
        const auditorCities = (loggedInProfile?.ciudad || '').toLowerCase().split(',').map(c => c.trim())
        const userCity = (opProfile.ciudad || '').toLowerCase().trim()
        if (!auditorCities.includes(userCity)) {
          showToast('Acceso denegado. Este operativo pertenece a otra ciudad.', 'error')
          router.push('/dashboard/usuarios')
          return
        }
      }

      setProfile(opProfile)

      const { startIso, endIso } = getPeriodRange(selectedPeriod, focusDate)

      const [
        { data: ventas },
        { data: cots },
        { data: vouchersList }
      ] = await Promise.all([
        supabase.from('ventas')
          .select('*, cotizaciones(*)')
          .eq('operativo_id', operativeId)
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: false }),
        supabase.from('cotizaciones')
          .select('*, perfiles:operativo_id(nombre), ventas(id, estado, vouchers(codigo))')
          .eq('operativo_id', operativeId)
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: false }),
        supabase.from('vouchers')
          .select('*, ventas(id, cotizaciones(comercial))')
          .eq('operativo_id', operativeId)
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: false })
      ])

      const validVentas = ventas || []
      const validCots = cots || []
      
      const gananciaPeriodo = validVentas.filter(v => v.estado === 'activa').reduce((a,v) => a + (Number(v.comision)||0) + (Number(v.utilidad)||0), 0)
      const totalVendidoPeriodo = validVentas.filter(v => v.estado === 'activa').reduce((a,v) => a + (Number(v.total)||0), 0)
      const ganadas = validCots.filter(c => c.estado === 'ganada').length
      const abiertas = validCots.filter(c => c.estado === 'abierta' && !isExpired(c)).length
      const caducadas = validCots.filter(c => c.estado === 'abierta' && isExpired(c)).length
      const perdidas = validCots.filter(c => c.estado === 'perdida').length
      const anuladas = validCots.filter(c => c.estado === 'anulada').length
      const conversion = validCots.length > 0 ? ((ganadas / validCots.length) * 100).toFixed(1) : '0.0'

      const destMap = {}
      validCots.forEach(q => { if(q.destino) destMap[q.destino] = (destMap[q.destino] || 0) + 1 })
      const topDestino = Object.keys(destMap).sort((a,b) => destMap[b] - destMap[a])[0] || 'N/A'

      const panelMotivesMap = {}
      validCots.filter(c => ['perdida', 'anulada'].includes(c.estado)).forEach(q => {
        if (q.motivo_perdida) panelMotivesMap[q.motivo_perdida] = (panelMotivesMap[q.motivo_perdida] || 0) + 1
      })
      const topMotivosOp = Object.entries(panelMotivesMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([motivo, count]) => `${motivo} (${count})`)
        .join(', ') || 'Ninguno'

      let metaCalculada = opProfile.meta_mensual || 1000
      if (selectedPeriod === 'año') metaCalculada = metaCalculada * 12
      const porcentajeMeta = (gananciaPeriodo / metaCalculada) * 100

      setStats({
        ventas: validVentas,
        cotizaciones: validCots,
        vouchers: vouchersList || [],
        gananciaPeriodo,
        totalVendidoPeriodo,
        ganadas,
        abiertas,
        caducadas,
        perdidas,
        conversion,
        topDestino,
        topMotivosOp,
        metaCalculada,
        porcentajeMeta
      })

      generateAIInsight(opProfile, gananciaPeriodo, validCots.length, ganadas, perdidas, abiertas, conversion, topDestino, topMotivosOp, porcentajeMeta, caducadas, anuladas)

    } catch (err) {
      console.error(err)
      showToast('Error cargando información', 'error')
    } finally {
      setLoading(false)
    }
  }

  const generateAIInsight = async (p, g, tc, gn, pr, ab, conv, td, tm, cump, cad, anu) => {
    setLoadingAi(true)
    try {
      const res = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'INDIVIDUAL_ADMIN',
          metricas: {
            nombreAsesor: p.nombre,
            meta: p.meta_mensual,
            totalAporte: g,
            cumplimiento: cump,
            total: tc,
            ganadas: gn,
            perdidas: pr,
            abiertas: ab,
            caducadas: cad,
            anuladas: anu,
            conversion: conv,
            topDestino: td,
            topMotivos: tm
          }
        })
      })
      const data = await res.json()
      if (data.insight) setAiInsight(data.insight)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAi(false)
    }
  }

  const exportConsolidatedReport = async () => {
    if (!stats || !profile) return
    setIsExporting(true)
    try {
      const { startIso, endIso } = getPeriodRange(selectedPeriod, focusDate)
      const periodLabelStr = getPeriodLabel(selectedPeriod, focusDate)
      
      const response = await fetch('/api/export-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startIso,
          endDate: endIso,
          selectedOperative: profile.id,
          selectedCity: profile.ciudad || 'todas',
          selectedDestino: '',
          dateFilterText: periodLabelStr,
          operativeName: profile.nombre.replace(/\s+/g, '_')
        })
      })

      if (!response.ok) {
        if (response.status === 404) {
          showToast('No se encontraron registros en el período seleccionado.', 'error')
        } else {
          showToast(`Error del servidor: ${response.status}`, 'error')
        }
        return
      }

      const blob = await response.blob()
      saveAs(blob, `DataLake_CTB_${profile.nombre.replace(/\s+/g, '_')}_${periodLabelStr.replace(/\s/g, '_')}.xlsx`)
      showToast('Reporte Inteligente descargado con éxito.')
    } catch (error) {
      console.error(error)
      showToast('Error generando el reporte Excel.', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  if (!profile && !loading) return null

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* HEADER: Nombre y Filtros */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors shrink-0">
            <ArrowLeft size={20} />
          </button>
          {profile && (
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-primary rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-primary/30">
                {profile.nombre?.charAt(0) || '?'}
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  {profile.nombre}
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-600">
                    {profile.rol}
                  </span>
                </h1>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                  SEDE: {profile.ciudad} | META MENSUAL: ${profile.meta_mensual?.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CONTROLES DE FECHA Y EXPORTAR */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center bg-gray-50/80 p-1.5 rounded-[2rem] border border-gray-100 flex-1 sm:flex-initial">
            <div className="flex bg-white shadow-sm p-1 rounded-2xl mr-2">
              {[
                { key: 'dia', label: 'Día' },
                { key: 'semana', label: 'Sem' },
                { key: 'mes', label: 'Mes' },
                { key: 'año', label: 'Año' }
              ].map(mode => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setSelectedPeriod(mode.key)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    selectedPeriod === mode.key
                      ? 'bg-primary text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 px-2">
              <button onClick={() => handleNavigatePeriod(-1)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-gray-200 transition-all text-gray-500">
                <ChevronLeft size={16} />
              </button>
              <div className="relative flex items-center justify-center min-w-[140px] group cursor-pointer">
                <input
                  type="date"
                  value={format(focusDate, 'yyyy-MM-dd')}
                  onChange={(e) => e.target.value && setFocusDate(new Date(e.target.value + 'T12:00:00'))}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <span className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 group-hover:text-primary transition-colors">
                  <Calendar size={14} className="text-primary" />
                  {getPeriodLabel(selectedPeriod, focusDate)}
                </span>
              </div>
              <button onClick={() => handleNavigatePeriod(1)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-gray-200 transition-all text-gray-500">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <button 
            onClick={exportConsolidatedReport}
            disabled={isExporting}
            className="bg-gray-900 hover:bg-gray-800 disabled:opacity-70 disabled:hover:scale-100 text-white text-[10px] font-black uppercase tracking-widest px-6 py-4 rounded-[2rem] flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-xl shadow-gray-200 w-full sm:w-auto shrink-0"
          >
            {isExporting ? (
              <><RefreshCw size={14} className="animate-spin" /> Procesando Excel...</>
            ) : (
              <><Download size={14} /> Exportar Excel</>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* BARRA DE CUMPLIMIENTO DE META (Solo en Mes y Año) */}
          {stats && (selectedPeriod === 'mes' || selectedPeriod === 'año') && (
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><Award size={120} /></div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3 text-gray-900">
                  <Target className="text-primary" size={24} />
                  Cumplimiento de Meta ({selectedPeriod})
                </h3>
              </div>

              <div className="flex items-end justify-between mb-4 relative z-10">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Completado</p>
                  <p className="text-4xl font-black text-gray-900 tracking-tighter">${stats.gananciaPeriodo.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Objetivo</p>
                  <p className="text-2xl font-black text-gray-400">${stats.metaCalculada.toLocaleString()}</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-8 rounded-full overflow-hidden mb-6 p-1.5 border border-gray-50 relative z-10">
                <div className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.1)]" 
                     style={{ 
                       width: `${Math.min(stats.porcentajeMeta, 100)}%`,
                       background: stats.porcentajeMeta >= 100 ? '#16A34A' : stats.porcentajeMeta >= 60 ? '#0066CC' : '#F5A623'
                     }}>
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_2s_infinite]"></div>
                </div>
              </div>
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl relative z-10">
                <div className="flex items-center gap-2 text-sm font-black text-gray-800">
                  <TrendingUp size={18} className={stats.porcentajeMeta >= 100 ? 'text-success' : 'text-primary'} />
                  {stats.porcentajeMeta.toFixed(1)}% Cumplido
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase">
                  {stats.metaCalculada > stats.gananciaPeriodo ? `Restan $${(stats.metaCalculada - stats.gananciaPeriodo).toLocaleString()}` : '¡Meta Superada!'}
                </div>
              </div>
            </div>
          )}

          {/* KPIs PREMIUM */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 group hover:border-gray-200 transition-colors">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Total Ventas (Volumen)</p>
              <p className="text-3xl font-black text-gray-900">${stats.totalVendidoPeriodo.toLocaleString()}</p>
            </div>
            <div className="bg-success/5 p-6 rounded-[2.5rem] border border-success/10 group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 scale-150"><DollarSign size={80} className="text-success" /></div>
              <p className="text-[10px] font-black text-success uppercase tracking-widest mb-3 relative z-10">Aporte a CTB</p>
              <p className="text-3xl font-black text-success relative z-10">${stats.gananciaPeriodo.toLocaleString()}</p>
              <p className="text-[8px] text-success/60 font-black mt-2 uppercase tracking-widest relative z-10">Comisión + Utilidad</p>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Tasa de Cierre</p>
              <p className="text-3xl font-black text-gray-900">{stats.conversion}%</p>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Top Destino</p>
              <p className="text-2xl font-black text-primary truncate uppercase italic">{stats.topDestino}</p>
            </div>
          </div>


          {/* TABS Y DETALLES */}
          <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-50 bg-gray-50/50 px-4 pt-4 overflow-x-auto hide-scrollbar">
              {[
                { id: 'resumen', label: 'Resumen Cotizaciones', icon: PieIcon },
                { id: 'ventas', label: 'Vendidas Activas', icon: DollarSign, count: stats.ventas.filter(v => v.estado === 'activa').length },
                { id: 'cotizaciones', label: 'Todas las Cotizaciones', icon: FileText, count: stats.cotizaciones.length },
                { id: 'vouchers', label: 'Vouchers Generados', icon: QrCode, count: stats.vouchers.length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${
                    activeTab === tab.id
                      ? 'border-primary text-primary bg-white rounded-t-[1.5rem]'
                      : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-t-[1.5rem]'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ml-1 ${activeTab === tab.id ? 'bg-primary/10' : 'bg-gray-200'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-8">
              {activeTab === 'resumen' && (
                <div className="space-y-8">
                  <h3 className="font-black text-lg uppercase tracking-tighter text-gray-900">Estado del Embudo ({selectedPeriod})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                    {[
                      { label: 'Total Cotizadas', val: stats.cotizaciones.length, color: 'text-gray-900 bg-gray-50 border-gray-200' },
                      { label: 'Ganadas', val: stats.ganadas, color: 'text-success bg-success/5 border-success/20' },
                      { label: 'En Espera (Vigentes)', val: stats.abiertas, color: 'text-primary bg-primary/5 border-primary/20' },
                      { label: 'Caducadas', val: stats.caducadas, color: 'text-rose-500 bg-rose-50 border-rose-100' },
                      { label: 'Perdidas / Anuladas', val: stats.perdidas, color: 'text-amber-500 bg-amber-50 border-amber-100' },
                    ].map(item => (
                      <div key={item.label} className={`p-8 rounded-[2rem] border ${item.color} text-center hover:scale-[1.02] transition-transform`}>
                        <p className="text-5xl font-black">{item.val}</p>
                        <p className="text-[10px] font-black uppercase mt-3 tracking-widest opacity-80">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'ventas' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Agencia / Destino</th>
                        <th className="py-3 px-4 text-right">Aporte CTB</th>
                        <th className="py-3 px-4 text-right">Total Venta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {stats.ventas.filter(v => v.estado === 'activa').map(v => (
                        <tr key={v.id} className="hover:bg-gray-50/50">
                          <td className="py-4 px-4 text-gray-500 font-bold">{new Date(v.created_at).toLocaleDateString()}</td>
                          <td className="py-4 px-4 font-mono font-black text-primary">#{v.cotizaciones?.codigo || v.numero_proforma}</td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-gray-800">{v.cotizaciones?.agencia || 'Directo'}</div>
                            <div className="text-[10px] text-gray-400 uppercase">{v.cotizaciones?.destino}</div>
                          </td>
                          <td className="py-4 px-4 text-right font-black text-success">${(Number(v.comision) + Number(v.utilidad)).toLocaleString()}</td>
                          <td className="py-4 px-4 text-right font-black text-gray-900">${Number(v.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'cotizaciones' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Agencia / Destino</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {stats.cotizaciones.map(q => {
                        const status = (q.estado || '').toString().trim().toLowerCase()
                        const isGanada = status === 'ganada' || (Array.isArray(q.ventas) && q.ventas.some(v => v.estado !== 'anulada'))
                        return (
                          <tr key={q.id} className="hover:bg-gray-50/50">
                            <td className="py-4 px-4 text-gray-500 font-bold">{new Date(q.created_at).toLocaleDateString()}</td>
                            <td className="py-4 px-4 font-mono font-black text-primary">#{q.codigo}</td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-gray-800">{q.agencia || 'Directo'}</div>
                              <div className="text-[10px] text-gray-400 uppercase">{q.destino}</div>
                            </td>
                            <td className="py-4 px-4 text-right font-black text-gray-900">${Number(q.valor_total).toLocaleString()}</td>
                            <td className="py-4 px-4">
                              {isGanada ? (
                                <span className="bg-success/10 text-success px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider block text-center">VENDIDA</span>
                              ) : status === 'perdida' || status === 'anulada' ? (
                                <span className="bg-rose-100 text-rose-600 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider block text-center">CANCELADA</span>
                              ) : isExpired(q) ? (
                                <span className="bg-rose-50 text-rose-500 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider block text-center">CADUCADA</span>
                              ) : (
                                <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider block text-center">ACTIVA</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'vouchers' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                        <th className="py-3 px-4">Fecha Emisión</th>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Agencia / Destino</th>
                        <th className="py-3 px-4">Vigencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {stats.vouchers.map(vch => (
                        <tr key={vch.id} className="hover:bg-gray-50/50">
                          <td className="py-4 px-4 text-gray-500 font-bold">{new Date(vch.created_at).toLocaleDateString()}</td>
                          <td className="py-4 px-4 font-mono font-bold text-success">{vch.codigo}</td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-gray-800">{vch.agencia || 'Directo'}</div>
                            <div className="text-[10px] text-gray-400 uppercase">{vch.destino}</div>
                          </td>
                          <td className="py-4 px-4 text-gray-500 font-bold">
                            {vch.fecha_viaje_desde} al {vch.fecha_viaje_hasta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* AI INSIGHT */}
          <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-8 rounded-[3rem] text-white relative overflow-hidden border border-indigo-500/20 shadow-xl mt-8">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>
            <div className="flex flex-col md:flex-row gap-6 relative z-10 items-start">
              <div className="shrink-0 w-16 h-16 bg-primary/20 rounded-[1.5rem] flex items-center justify-center text-primary border border-primary/30 shadow-inner">
                <Sparkles size={32} />
              </div>
              <div className="flex-1 w-full">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs sm:text-sm font-black text-primary uppercase tracking-[0.2em]">Auditoría de IA — {selectedPeriod}</h3>
                  <button onClick={() => generateAIInsight(profile, stats.gananciaPeriodo, stats.cotizaciones.length, stats.ganadas, stats.perdidas, stats.abiertas, stats.conversion, stats.topDestino, stats.topMotivosOp)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                    <RefreshCw size={14} className={loadingAi ? 'animate-spin' : ''} />
                  </button>
                </div>
                {loadingAi ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-3 bg-white/10 rounded-full w-full"></div>
                    <div className="h-3 bg-white/10 rounded-full w-5/6"></div>
                    <div className="h-3 bg-white/10 rounded-full w-4/6"></div>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm leading-relaxed text-gray-200 font-medium">
                    {aiInsight || "No hay datos suficientes para generar un análisis."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
