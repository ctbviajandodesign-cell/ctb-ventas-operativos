import { useState, useMemo } from 'react'
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
import { 
  BarChart3, 
  PieChart as PieIcon, 
  TrendingUp, 
  Users, 
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle
} from 'lucide-react'

/**
 * DashboardCharts Component
 * Renders the global or individual performance charts for the dashboard.
 */
export default function DashboardCharts({ 
  isAdmin, 
  selectedOperative, 
  chartData, 
  individualStats, 
  metrics,
  pipelineData = [],
  operatives = []
}) {
  const [viewMode, setViewMode] = useState('comparativa') // 'comparativa' o 'asesor'
  const [localOperativeId, setLocalOperativeId] = useState('')
  const [localPeriod, setLocalPeriod] = useState('mes') // 'hoy', 'semana', 'mes', 'año'

  // Inicializar localOperativeId con el primer operativo disponible
  useMemo(() => {
    if (!localOperativeId && operatives.length > 0) {
      setLocalOperativeId(operatives[0].id)
    }
  }, [operatives, localOperativeId])

  // Filtrar pipelineData en memoria para evitar llamadas de red
  const filteredData = useMemo(() => {
    if (!pipelineData || !localOperativeId) return []
    let result = pipelineData

    if (localOperativeId !== 'all') {
      result = result.filter(q => q.operativo_id === localOperativeId)
    }

    const now = new Date()
    return result.filter(q => {
      if (!q.created_at) return false
      const qDate = new Date(q.created_at)
      
      if (localPeriod === 'hoy') {
        return qDate.toDateString() === now.toDateString()
      }
      if (localPeriod === 'semana') {
        const diffTime = Math.abs(now - qDate)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays <= 7
      }
      if (localPeriod === 'mes') {
        return qDate.getMonth() === now.getMonth() && qDate.getFullYear() === now.getFullYear()
      }
      if (localPeriod === 'año') {
        return qDate.getFullYear() === now.getFullYear()
      }
      return true
    })
  }, [pipelineData, localOperativeId, localPeriod])

  // Calcular métricas locales del asesor seleccionado
  const advisorStats = useMemo(() => {
    const total = filteredData.length
    const vendidas = filteredData.filter(q => q._esVenta).length
    const abiertas = filteredData.filter(q => !q._esVenta && q.estado === 'abierta').length
    const perdidas = filteredData.filter(q => q.estado === 'perdida').length
    const anuladas = filteredData.filter(q => q.estado === 'anulada').length

    const conversion = total > 0 ? ((vendidas / total) * 100).toFixed(1) : '0.0'

    const totalVendido = filteredData
      .filter(q => q._esVenta)
      .reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0)

    const totalAporte = filteredData
      .filter(q => q._esVenta)
      .reduce((acc, q) => acc + (Number(q.valor_comision) || 0) + (Number(q.valor_utilidad) || 0), 0)

    return {
      total,
      vendidas,
      abiertas,
      perdidas,
      anuladas,
      conversion,
      totalVendido,
      totalAporte
    }
  }, [filteredData])

  return (
    <>
      {/* GRÁFICO DE RENDIMIENTO GLOBAL */}
      {isAdmin && selectedOperative === 'global' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 animate-in zoom-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h3 className="font-black text-xl uppercase tracking-tighter flex items-center gap-3">
              <BarChart3 className="text-primary" size={24} />
              Rendimiento por Asesor
            </h3>
            
            {/* TABS DE MODO DE VISTA */}
            <div className="flex bg-gray-100 p-1 rounded-2xl self-start sm:self-auto border border-gray-200">
              <button
                onClick={() => setViewMode('comparativa')}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  viewMode === 'comparativa' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                Comparativa
              </button>
              <button
                onClick={() => setViewMode('asesor')}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  viewMode === 'asesor' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                Detalle por Asesor
              </button>
            </div>
          </div>
          
          {/* MODO COMPARATIVA (Leaderboard) */}
          {viewMode === 'comparativa' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-end gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                  <span className="text-xs font-black text-gray-400 uppercase">Ventas ($)</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12, fontWeight: 900 }} />

                    <Tooltip cursor={{ fill: '#F8FAFC' }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                            <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">{payload[0].payload.nombre}</p>
                            <p className="text-xl font-black">${payload[0].value.toLocaleString()}</p>
                            <p className="text-xs font-bold text-gray-400 mt-1 uppercase italic">{payload[0].payload.cumplimiento.toFixed(1)}% de meta cumplida</p>
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

          {/* MODO DETALLE POR ASESOR */}
          {viewMode === 'asesor' && (
            <div className="space-y-6 animate-in fade-in duration-350">
              {/* SELECTORES INLINE */}
              <div className="flex flex-wrap items-center gap-4 bg-gray-50/50 p-4 rounded-3xl border border-gray-100">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 flex-1 sm:flex-initial">
                  <Users size={14} className="text-primary shrink-0" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Asesor:</span>
                  <select
                    value={localOperativeId}
                    onChange={(e) => setLocalOperativeId(e.target.value)}
                    className="appearance-none bg-transparent border-none font-black text-xs text-gray-800 outline-none pr-8 pl-1 py-0.5 cursor-pointer focus:ring-0 w-full sm:w-auto bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
                  >
                    {operatives.length === 0 && <option value="">No hay asesores cargados</option>}
                    {operatives.map(op => (
                      <option key={op.id} value={op.id}>{op.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 flex-1 sm:flex-initial">
                  <Calendar size={14} className="text-primary shrink-0" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Período:</span>
                  <select
                    value={localPeriod}
                    onChange={(e) => setLocalPeriod(e.target.value)}
                    className="appearance-none bg-transparent border-none font-black text-xs text-gray-800 outline-none pr-8 pl-1 py-0.5 cursor-pointer focus:ring-0 w-full sm:w-auto bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
                  >
                    <option value="hoy">Hoy</option>
                    <option value="semana">Esta Semana</option>
                    <option value="mes">Mes Actual</option>
                    <option value="año">Año Actual</option>
                  </select>
                </div>
              </div>

              {/* CONTENIDO DE ESTADÍSTICAS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* COLUMNA 1: CONVERSIÓN Y TOTALES */}
                <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 flex flex-col justify-between items-center text-center">
                  <div className="w-full">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Conversión</span>
                    <div className="relative w-28 h-28 flex items-center justify-center bg-white rounded-full shadow-md border-4 border-success mx-auto">
                      <div className="text-center">
                        <span className="text-2xl font-black text-gray-850 italic">{advisorStats.conversion}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full mt-6 space-y-3">
                    <div className="bg-white p-3 rounded-2xl border border-gray-100 flex justify-between items-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Total Vendido</span>
                      <span className="text-sm font-black text-gray-900">${advisorStats.totalVendido.toLocaleString()}</span>
                    </div>
                    <div className="bg-gray-900 text-white p-3 rounded-2xl flex justify-between items-center">
                      <span className="text-[10px] font-black text-primary uppercase">Ganancia CTB</span>
                      <span className="text-sm font-black text-white">${advisorStats.totalAporte.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* COLUMNA 2 y 3: DESGLOSE DE ESTADOS */}
                <div className="md:col-span-2 bg-white p-6 rounded-[2rem] border border-gray-100 flex flex-col justify-between">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Estado de las Cotizaciones ({advisorStats.total})</span>
                  
                  <div className="space-y-4 flex-1 flex flex-col justify-center">
                    {/* VENDIDAS */}
                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-black text-success uppercase flex items-center gap-1.5">
                          <CheckCircle2 size={12} /> Vendidas
                        </span>
                        <span className="font-bold text-gray-500">{advisorStats.vendidas}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-success h-full transition-all duration-550" 
                          style={{ width: `${advisorStats.total > 0 ? (advisorStats.vendidas / advisorStats.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* EN ESPERA */}
                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-black text-primary uppercase flex items-center gap-1.5">
                          <Clock size={12} /> En Espera
                        </span>
                        <span className="font-bold text-gray-500">{advisorStats.abiertas}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-550" 
                          style={{ width: `${advisorStats.total > 0 ? (advisorStats.abiertas / advisorStats.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* NO CONCRETADAS */}
                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-black text-amber-500 uppercase flex items-center gap-1.5">
                          <XCircle size={12} /> No Concretadas
                        </span>
                        <span className="font-bold text-gray-500">{advisorStats.perdidas}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full transition-all duration-550" 
                          style={{ width: `${advisorStats.total > 0 ? (advisorStats.perdidas / advisorStats.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* CANCELADAS */}
                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-black text-rose-500 uppercase flex items-center gap-1.5">
                          <AlertTriangle size={12} /> Canceladas
                        </span>
                        <span className="font-bold text-gray-500">{advisorStats.anuladas}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-rose-500 h-full transition-all duration-550" 
                          style={{ width: `${advisorStats.total > 0 ? (advisorStats.anuladas / advisorStats.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                <p className="text-xs font-black text-success uppercase">Conversión</p>
                <p className="text-lg font-black text-success">{metrics.conversionRate.toFixed(1)}%</p>
              </div>
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={individualStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }} width={80} />

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
                <p className="text-xs font-black text-primary uppercase tracking-[0.3em] mb-2">Market Share</p>
                <p className="text-6xl font-black text-white italic">
                  {metrics.globalGoal > 0 ? ((metrics.metaComputable / metrics.globalGoal) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-4 tracking-widest">De la meta global de CTB</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
