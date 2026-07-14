'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Download, 
  Sparkles, 
  RefreshCw, 
  Trophy, 
  Target, 
  DollarSign, 
  PieChart as PieIcon,
  AlertTriangle,
  QrCode,
  FileText
} from 'lucide-react'
import { showToast } from '@/utils/toast'
import { useUserSession } from '@/hooks/useUserSession'

const isExpired = (q) => {
  if (q.fecha_caducidad) {
    const timeStr = q.hora_caducidad ? q.hora_caducidad : '23:59:59'
    const expiryDate = new Date(`${q.fecha_caducidad}T${timeStr}`)
    return expiryDate < new Date()
  }
  if (q.created_at) {
    const hours = (new Date() - new Date(q.created_at)) / (1000 * 60 * 60)
    return hours > 24
  }
  return false
}

export default function OperativeProfileClient({ operativeId }) {
  const router = useRouter()
  const { profile: loggedInProfile, loading: sessionLoading } = useUserSession()
  
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('resumen')
  const [loadingAi, setLoadingAi] = useState(false)
  const [aiInsight, setAiInsight] = useState(null)

  useEffect(() => {
    if (sessionLoading) return
    if (loggedInProfile && loggedInProfile.rol !== 'admin' && loggedInProfile.rol !== 'superadmin') {
      showToast('Acceso denegado. Se requiere rol de administrador.', 'error')
      router.push('/dashboard')
      return
    }
    fetchOperativeData()
  }, [operativeId, sessionLoading, loggedInProfile])

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
      setProfile(opProfile)

      // Obtener TODO el historial (sin filtro de fechas)
      const [
        { data: ventas },
        { data: cots },
        { data: vouchersList }
      ] = await Promise.all([
        supabase.from('ventas').select('*, cotizaciones(*)').eq('operativo_id', operativeId).order('created_at', { ascending: false }),
        supabase.from('cotizaciones').select('*, perfiles:operativo_id(nombre), ventas(id, estado, vouchers(codigo))').eq('operativo_id', operativeId).order('created_at', { ascending: false }),
        supabase.from('vouchers').select('*, ventas(id, cotizaciones(comercial))').eq('operativo_id', operativeId).order('created_at', { ascending: false })
      ])

      const validVentas = ventas || []
      const validCots = cots || []
      
      const gananciaHistorica = validVentas.filter(v => v.estado === 'activa').reduce((a,v) => a + (Number(v.comision)||0) + (Number(v.utilidad)||0), 0)
      const totalVendidoHistorico = validVentas.filter(v => v.estado === 'activa').reduce((a,v) => a + (Number(v.total)||0), 0)
      const ganadas = validCots.filter(c => c.estado === 'ganada').length
      const abiertas = validCots.filter(c => c.estado === 'abierta' && !isExpired(c)).length
      const caducadas = validCots.filter(c => c.estado === 'abierta' && isExpired(c)).length
      const perdidas = validCots.filter(c => ['perdida', 'anulada'].includes(c.estado)).length
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

      setStats({
        ventas: validVentas,
        cotizaciones: validCots,
        vouchers: vouchersList || [],
        gananciaHistorica,
        totalVendidoHistorico,
        ganadas,
        abiertas,
        caducadas,
        perdidas,
        conversion,
        topDestino,
        topMotivosOp
      })

      // Llamar a IA para análisis histórico
      generateAIInsight(opProfile, gananciaHistorica, validCots.length, ganadas, perdidas, abiertas, conversion, topDestino, topMotivosOp)

    } catch (err) {
      console.error(err)
      showToast('Error cargando información', 'error')
    } finally {
      setLoading(false)
    }
  }

  const generateAIInsight = async (p, g, tc, gn, pr, ab, conv, td, tm) => {
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
            totalAporte: g, // Usamos histórico
            total: tc,
            ganadas: gn,
            perdidas: pr,
            abiertas: ab,
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

  const exportConsolidatedReport = () => {
    if (!stats) return

    const headers = ['Tipo,Codigo,Fecha,Agencia,Destino,Valor Total,Aporte CTB,Estado']
    const rows = []

    // Cotizaciones/Ventas
    stats.cotizaciones.forEach(c => {
      const isGanada = c.estado === 'ganada' || (Array.isArray(c.ventas) && c.ventas.some(v => v.estado !== 'anulada'))
      const tipo = isGanada ? 'VENTA' : 'COTIZACION'
      const codigo = c.codigo || 'N/A'
      const fecha = new Date(c.created_at).toLocaleDateString()
      const agencia = (c.agencia || 'Directo').replace(/,/g, ';')
      const destino = (c.destino || '').replace(/,/g, ';')
      
      let valorTotal = c.valor_total || 0
      let aporteCTB = (Number(c.valor_comision) || 0) + (Number(c.valor_utilidad) || 0)

      if (isGanada && c.ventas && c.ventas.length > 0) {
        const v = c.ventas.find(ve => ve.estado === 'activa')
        if (v) {
          valorTotal = v.total || valorTotal
          aporteCTB = (Number(v.comision) || 0) + (Number(v.utilidad) || 0)
        }
      }
      
      const estado = isGanada ? 'GANADA' : isExpired(c) && c.estado === 'abierta' ? 'CADUCADA' : (c.estado || '').toUpperCase()
      rows.push(`${tipo},${codigo},${fecha},${agencia},${destino},${valorTotal},${aporteCTB},${estado}`)
    })

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Reporte_Consolidado_${profile?.nombre?.replace(/\s/g, '_')}_CTB.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-32 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando historial...</p>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              {profile.nombre}
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                profile.rol === 'superadmin' ? 'bg-indigo-100 text-indigo-700' :
                profile.rol === 'admin' ? 'bg-amber-100 text-amber-600' :
                profile.rol === 'comercial' ? 'bg-emerald-100 text-emerald-600' :
                'bg-blue-100 text-blue-600'
              }`}>
                {profile.rol}
              </span>
            </h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
              Sede: {profile.ciudad} | Meta Mensual: ${profile.meta_mensual?.toLocaleString()}
            </p>
          </div>
        </div>
        
        <button 
          onClick={exportConsolidatedReport}
          className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-black uppercase tracking-widest px-5 py-3 rounded-2xl flex items-center gap-2 hover:scale-[1.02] transition-all shadow-xl"
        >
          <Download size={16} /> Exportar Histórico (CSV)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Ventas (Volumen)</p>
          <p className="text-3xl font-black text-gray-900 mt-2">${stats.totalVendidoHistorico.toLocaleString()}</p>
          <p className="text-xs text-gray-400 font-bold mt-2 uppercase">Histórico Global</p>
        </div>
        <div className="bg-success/5 p-6 rounded-[2rem] border border-success/10">
          <p className="text-xs font-black text-success uppercase tracking-widest">Aporte a CTB</p>
          <p className="text-3xl font-black text-success mt-2">${stats.gananciaHistorica.toLocaleString()}</p>
          <p className="text-xs text-success/70 font-bold mt-2 uppercase">Comisión + Utilidad (Histórico)</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Tasa de Cierre</p>
          <p className="text-3xl font-black text-gray-900 mt-2">{stats.conversion}%</p>
          <p className="text-xs text-gray-400 font-bold mt-2 uppercase">Histórico Global</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Top Destino</p>
          <p className="text-xl font-black text-primary mt-3 truncate uppercase italic">{stats.topDestino}</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-8 rounded-[3rem] text-white relative overflow-hidden border border-indigo-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>
        <div className="flex flex-col md:flex-row gap-6 relative z-10">
          <div className="shrink-0 w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/30">
            <Sparkles size={32} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em] mb-2">Análisis de IA sobre el Asesor</h3>
            {loadingAi ? (
              <div className="space-y-3 animate-pulse mt-4">
                <div className="h-3 bg-white/10 rounded-full w-full"></div>
                <div className="h-3 bg-white/10 rounded-full w-5/6"></div>
                <div className="h-3 bg-white/10 rounded-full w-4/6"></div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-gray-200 font-medium">
                {aiInsight || "No hay datos suficientes para generar un análisis."}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-50 bg-gray-50/50 px-4 pt-4 overflow-x-auto">
          {[
            { id: 'resumen', label: 'Resumen Cotizaciones', icon: PieIcon },
            { id: 'ventas', label: 'Vendidas Activas', icon: DollarSign, count: stats.ventas.filter(v => v.estado === 'activa').length },
            { id: 'cotizaciones', label: 'Todas las Cotizaciones', icon: FileText, count: stats.cotizaciones.length },
            { id: 'vouchers', label: 'Vouchers Generados', icon: QrCode, count: stats.vouchers.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-white rounded-t-2xl'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-t-2xl'
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
              <h3 className="font-black text-lg uppercase tracking-tighter text-gray-900">Estado del Embudo Histórico</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Ganadas', val: stats.ganadas, color: 'text-success bg-success/5 border-success/20' },
                  { label: 'En Espera (Vigentes)', val: stats.abiertas, color: 'text-primary bg-primary/5 border-primary/20' },
                  { label: 'Caducadas', val: stats.caducadas, color: 'text-rose-500 bg-rose-50 border-rose-100' },
                  { label: 'Perdidas / Anuladas', val: stats.perdidas, color: 'text-amber-500 bg-amber-50 border-amber-100' },
                ].map(item => (
                  <div key={item.label} className={`p-6 rounded-[2rem] border ${item.color} text-center`}>
                    <p className="text-4xl font-black">{item.val}</p>
                    <p className="text-[11px] font-black uppercase mt-2">{item.label}</p>
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
    </div>
  )
}
