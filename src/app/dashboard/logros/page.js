'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Trophy, Star, TrendingUp, DollarSign, 
  CheckCircle2, XCircle, Target, AlertCircle,
  BarChart3, Award
} from 'lucide-react'
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Cell, PieChart, Pie
} from 'recharts'

export default function LogrosPage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    ganadas: 0, abiertas: 0, perdidas: 0, anuladas: 0,
    totalVendido: 0, ganancia: 0, vouchers: 0,
    meta: 5000, cumplimiento: 0
  })
  const [monthlyData, setMonthlyData] = useState([])
  const [allOps, setAllOps] = useState([]) // para ranking completo

  useEffect(() => { fetchLogros() }, [])

  async function fetchLogros() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)

      // Stats personales históricas
      const { data: cots } = await supabase.from('cotizaciones').select('estado, valor_total, created_at').eq('operativo_id', user.id)
      const { data: ventas } = await supabase.from('ventas').select('comision, utilidad, created_at').eq('operativo_id', user.id).eq('estado', 'activa')
      const { count: vCount } = await supabase.from('vouchers').select('id', { count: 'exact', head: true }).eq('operativo_id', user.id)

      // Mes actual para ventas
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
      const gananciaTotal = ventas?.reduce((a, v) => a + (Number(v.comision)||0) + (Number(v.utilidad)||0), 0) || 0
      const gananciaDelMes = ventas?.filter(v => new Date(v.created_at) >= startOfMonth)
        .reduce((a, v) => a + (Number(v.comision)||0) + (Number(v.utilidad)||0), 0) || 0
      const totalVendidoMes = cots?.filter(c => c.estado === 'ganada' && new Date(c.created_at) >= startOfMonth)
        .reduce((a, c) => a + (Number(c.valor_total)||0), 0) || 0

      const meta = Number(p?.meta_mensual) || 5000

      setStats({
        ganadas: cots?.filter(c => c.estado === 'ganada').length || 0,
        abiertas: cots?.filter(c => c.estado === 'abierta').length || 0,
        perdidas: cots?.filter(c => c.estado === 'perdida').length || 0,
        anuladas: cots?.filter(c => c.estado === 'anulada').length || 0,
        totalVendido: totalVendidoMes,
        ganancia: gananciaDelMes,
        gananciaTotal,
        vouchers: vCount || 0,
        meta,
        cumplimiento: meta > 0 ? (gananciaDelMes / meta) * 100 : 0
      })

      // Datos mensuales para gráfico (últimos 6 meses)
      const meses = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        const label = d.toLocaleDateString('es', { month: 'short' }).toUpperCase()
        const ventasMes = ventas?.filter(v => {
          const dt = new Date(v.created_at)
          return dt >= start && dt <= end
        }) || []
        const ganMes = ventasMes.reduce((a, v) => a + (Number(v.comision)||0) + (Number(v.utilidad)||0), 0)
        const cerradasMes = cots?.filter(c => {
          const dt = new Date(c.created_at)
          return c.estado === 'ganada' && dt >= start && dt <= end
        }).length || 0
        meses.push({ mes: label, ganancia: ganMes, cerradas: cerradasMes })
      }
      setMonthlyData(meses)

      // Ranking completo de operativos para comparación
      const { data: ops } = await supabase.from('profiles').select('id, nombre, meta_mensual').eq('rol', 'operativo')
      const { data: allVentas } = await supabase.from('ventas').select('comision, utilidad, operativo_id').eq('estado', 'activa').gte('created_at', startOfMonth.toISOString())
      const board = ops?.map(op => {
        const opV = (allVentas||[]).filter(v => v.operativo_id === op.id)
        const g = opV.reduce((a, v) => a + (Number(v.comision)||0) + (Number(v.utilidad)||0), 0)
        const m = Number(op.meta_mensual) || 5000
        return { id: op.id, nombre: op.nombre?.split(' ')[0] || '?', nombreCompleto: op.nombre, ganancia: g, meta: m, cumplimiento: m > 0 ? (g / m) * 100 : 0, avatar: op.nombre?.charAt(0)?.toUpperCase() || '?', isMe: op.id === user.id }
      }).sort((a, b) => b.cumplimiento - a.cumplimiento) || []
      setAllOps(board)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Cargando tus logros...</p>
      </div>
    </div>
  )

  const pieData = [
    { name: 'Ganadas', value: stats.ganadas, color: '#16A34A' },
    { name: 'Abiertas', value: stats.abiertas, color: '#0066CC' },
    { name: 'Perdidas', value: stats.perdidas, color: '#F5A623' },
    { name: 'Anuladas', value: stats.anuladas, color: '#DC2626' },
  ].filter(d => d.value > 0)

  const totalCots = stats.ganadas + stats.abiertas + stats.perdidas + stats.anuladas
  const myRank = allOps.findIndex(op => op.isMe) + 1

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-amber-400 p-2 rounded-xl text-white"><Star size={18} /></div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">Mis Logros</h1>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-1">
            Tu rendimiento personal — {profile?.nombre}
          </p>
        </div>
        {myRank > 0 && (
          <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl text-center shadow-xl">
            <p className="text-[9px] font-black text-primary uppercase tracking-widest">Tu Posición</p>
            <p className="text-3xl font-black">{myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`}</p>
            <p className="text-[9px] text-gray-400 uppercase font-bold">de {allOps.length} asesores</p>
          </div>
        )}
      </div>

      {/* BARRA META DEL MES */}
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Meta del Mes Actual</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-gray-900">${stats.ganancia.toLocaleString()}</span>
              <span className="text-gray-400 font-bold text-sm">de ${stats.meta.toLocaleString()}</span>
            </div>
          </div>
          <div className={`text-right`}>
            <p className={`text-5xl font-black ${stats.cumplimiento >= 100 ? 'text-success' : stats.cumplimiento >= 60 ? 'text-primary' : 'text-amber-500'}`}>
              {stats.cumplimiento.toFixed(1)}%
            </p>
            <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Cumplido</p>
          </div>
        </div>
        <div className="w-full bg-gray-100 h-5 rounded-full overflow-hidden p-1">
          <div
            className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
            style={{
              width: `${Math.min(stats.cumplimiento, 100)}%`,
              background: stats.cumplimiento >= 100 ? '#16A34A' : stats.cumplimiento >= 60 ? '#0066CC' : '#F5A623'
            }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[9px] text-gray-400 font-bold uppercase">Faltan: ${Math.max(0, stats.meta - stats.ganancia).toLocaleString()}</span>
          {stats.cumplimiento >= 100 && <span className="text-[9px] text-success font-black uppercase">🎉 ¡Meta cumplida!</span>}
        </div>
      </div>

      {/* KPIs personales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Vendido (Mes)', val: `$${stats.totalVendido.toLocaleString()}`, sub: 'De cotizaciones ganadas', color: 'bg-primary/5 border-primary/10', text: 'text-primary', icon: DollarSign },
          { label: 'Mi Ganancia (Mes)', val: `$${stats.ganancia.toLocaleString()}`, sub: 'Comisión + utilidad', color: 'bg-success/5 border-success/10', text: 'text-success', icon: TrendingUp },
          { label: 'Vouchers Emitidos', val: stats.vouchers, sub: 'Total histórico', color: 'bg-white border-gray-100', text: 'text-gray-900', icon: Award },
          { label: 'Ganancia Histórica', val: `$${stats.gananciaTotal.toLocaleString()}`, sub: 'Desde el inicio', color: 'bg-gray-900 border-transparent', text: 'text-white', icon: Star, darkMode: true },
        ].map(kpi => (
          <div key={kpi.label} className={`p-6 rounded-[2rem] border shadow-sm ${kpi.color}`}>
            <div className="flex items-center gap-2 mb-3">
              <kpi.icon size={14} className={kpi.darkMode ? 'text-primary' : kpi.text} />
              <p className={`text-[9px] font-black uppercase tracking-widest ${kpi.darkMode ? 'text-primary' : 'text-gray-400'}`}>{kpi.label}</p>
            </div>
            <p className={`text-2xl font-black ${kpi.darkMode ? 'text-white' : kpi.text}`}>{kpi.val}</p>
            <p className={`text-[9px] mt-1 font-bold ${kpi.darkMode ? 'text-gray-400' : 'text-gray-400'}`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ESTADO DE COTIZACIONES PIE */}
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart3 size={13} className="text-primary" /> Mis Cotizaciones por Estado
          </h3>
          {totalCots === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-30">
              <AlertCircle size={40} />
              <p className="text-xs font-black uppercase mt-3">Sin cotizaciones registradas</p>
            </div>
          ) : (
            <>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(val) => [`${val} cotizaciones`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: 'Ganadas', val: stats.ganadas, color: 'bg-success text-white', pct: totalCots > 0 ? ((stats.ganadas/totalCots)*100).toFixed(0) : 0 },
                  { label: 'En Proceso', val: stats.abiertas, color: 'bg-primary text-white', pct: totalCots > 0 ? ((stats.abiertas/totalCots)*100).toFixed(0) : 0 },
                  { label: 'Perdidas', val: stats.perdidas, color: 'bg-amber-500 text-white', pct: totalCots > 0 ? ((stats.perdidas/totalCots)*100).toFixed(0) : 0 },
                  { label: 'Anuladas', val: stats.anuladas, color: 'bg-danger text-white', pct: totalCots > 0 ? ((stats.anuladas/totalCots)*100).toFixed(0) : 0 },
                ].map(item => (
                  <div key={item.label} className={`flex items-center justify-between p-3 rounded-2xl ${item.color}`}>
                    <div>
                      <p className="text-[9px] font-black uppercase opacity-80">{item.label}</p>
                      <p className="text-xl font-black">{item.val}</p>
                    </div>
                    <p className="text-lg font-black opacity-60">{item.pct}%</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* TENDENCIA DE GANANCIA ÚLTIMOS 6 MESES */}
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp size={13} className="text-primary" /> Mi Ganancia — Últimos 6 Meses
          </h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 900 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: '#F8FAFC' }}
                  content={({ active, payload }) => {
                    if (active && payload?.length) {
                      return (
                        <div className="bg-gray-900 text-white p-3 rounded-2xl shadow-2xl">
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest">{payload[0].payload.mes}</p>
                          <p className="text-lg font-black">${payload[0].value.toLocaleString()}</p>
                          <p className="text-[9px] text-gray-400">{payload[0].payload.cerradas} cotizaciones ganadas</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="ganancia" radius={[8, 8, 0, 0]}>
                  {monthlyData.map((entry, i) => (
                    <Cell key={i} fill={i === monthlyData.length - 1 ? '#0066CC' : '#CBD5E1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* RANKING COMPLETO DEL EQUIPO */}
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Trophy size={13} className="text-amber-500" /> Ranking Completo del Equipo — Mes Actual
          </h3>
          <span className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-full uppercase tracking-widest">
            {allOps.length} asesores
          </span>
        </div>
        {allOps.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos disponibles</p>
        ) : (
          <div className="space-y-3">
            {allOps.map((op, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`
              const barColor = op.cumplimiento >= 100 ? '#16A34A' : op.cumplimiento >= 60 ? '#0066CC' : '#F5A623'
              return (
                <div
                  key={op.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    op.isMe
                      ? 'bg-primary/5 border-primary/20 ring-2 ring-primary/10'
                      : 'bg-gray-50/50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{medal}</span>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm bg-gray-200 text-gray-600">
                        {op.avatar}
                      </div>
                      <div>
                        <p className={`font-black text-sm ${op.isMe ? 'text-primary' : 'text-gray-800'}`}>
                          {op.nombreCompleto}
                          {op.isMe && <span className="ml-2 text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase font-black">Tú</span>}
                        </p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">Meta: ${op.meta.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-gray-900">${op.ganancia.toLocaleString()}</p>
                      <p className={`text-[9px] font-black uppercase ${op.cumplimiento >= 100 ? 'text-success' : op.cumplimiento >= 60 ? 'text-primary' : 'text-amber-600'}`}>
                        {op.cumplimiento.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(op.cumplimiento, 100)}%`, background: barColor }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
