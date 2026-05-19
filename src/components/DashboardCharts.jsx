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
import { BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react'

/**
 * DashboardCharts Component
 * Renders the global or individual performance charts for the dashboard.
 * 
 * @param {Object} props
 * @param {boolean} props.isAdmin - Whether the current user is an admin.
 * @param {string} props.selectedOperative - The currently selected operative ID or 'global'.
 * @param {Array} props.chartData - Data for the global leaderboard chart.
 * @param {Array} props.individualStats - Data for the individual funnel chart.
 * @param {Object} props.metrics - The dashboard metrics object.
 */
export default function DashboardCharts({ 
  isAdmin, 
  selectedOperative, 
  chartData, 
  individualStats, 
  metrics 
}) {
  return (
    <>
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
                <span className="text-xs font-black text-gray-400 uppercase">Ventas ($)</span>
              </div>
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
