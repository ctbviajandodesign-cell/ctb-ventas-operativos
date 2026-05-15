'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import QuotesTable from '@/components/QuotesTable'
import { Search, Plus, Filter, CheckCircle2, Clock, XCircle, AlertCircle, TrendingUp, DollarSign, FileText } from 'lucide-react'
import Link from 'next/link'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts'

export default function CotizacionesPage() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    fetchQuotes()
  }, [])

  async function fetchQuotes() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(profileData)

    let query = supabase
      .from('cotizaciones')
      .select('*, profiles(nombre)')
      .order('created_at', { ascending: false })

    if (profileData?.rol !== 'admin') {
      query = query.eq('operativo_id', user.id)
    }

    const { data } = await query
    setQuotes(data || [])
    setLoading(false)
  }

  // Métricas para el mini-dashboard
  const stats = useMemo(() => {
    const total = quotes.length
    const abiertas = quotes.filter(q => (q.estado || '').trim() === 'abierta').length
    const ganadas = quotes.filter(q => (q.estado || '').trim() === 'ganada').length
    const perdidas = quotes.filter(q => ['perdida', 'anulada'].includes((q.estado || '').trim())).length
    const totalVenta = quotes.filter(q => (q.estado || '').trim() === 'ganada')
      .reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0)
    const totalAporte = quotes.filter(q => (q.estado || '').trim() === 'ganada')
      .reduce((acc, q) => acc + (Number(q.valor_comision) || 0) + (Number(q.valor_utilidad) || 0), 0)
    const conversion = total > 0 ? ((ganadas / total) * 100).toFixed(1) : 0

    return { total, abiertas, ganadas, perdidas, totalVenta, totalAporte, conversion }
  }, [quotes])

  const chartData = [
    { name: 'En Proceso', value: stats.abiertas, color: '#0066CC' },
    { name: 'Cerradas ✓', value: stats.ganadas, color: '#16A34A' },
    { name: 'No Concretadas', value: stats.perdidas, color: '#F5A623' },
  ]

  // Filtros combinados: estado + búsqueda de texto
  const filtered = useMemo(() => {
    let result = quotes
    if (statusFilter !== 'todas') {
      if (statusFilter === 'perdida') {
        result = result.filter(q => ['perdida', 'anulada'].includes((q.estado || '').trim()))
      } else {
        result = result.filter(q => (q.estado || '').trim() === statusFilter)
      }
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      result = result.filter(q =>
        q.codigo?.toLowerCase().includes(s) ||
        q.agencia?.toLowerCase().includes(s) ||
        q.destino?.toLowerCase().includes(s) ||
        q.profiles?.nombre?.toLowerCase().includes(s)
      )
    }
    return result
  }, [quotes, statusFilter, search])

  const filterTabs = [
    { key: 'todas', label: 'Todas', icon: FileText, color: 'gray' },
    { key: 'abierta', label: 'En Proceso', icon: Clock, color: 'blue' },
    { key: 'ganada', label: 'Cerradas', icon: CheckCircle2, color: 'green' },
    { key: 'perdida', label: 'No Concretadas', icon: XCircle, color: 'amber' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando proformas...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">Mis Proformas</h1>
          <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-1">Registro y seguimiento de todas las cotizaciones</p>
        </div>
        <Link href="/dashboard/cotizaciones/nueva" className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20">
          <Plus size={18} /> Nueva Proforma
        </Link>
      </div>

      {/* MINI DASHBOARD DE STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Proformas</p>
          <p className="text-4xl font-black text-gray-900 mt-2">{stats.total}</p>
          <p className="text-[9px] text-gray-400 mt-2 font-bold">Este historial completo</p>
        </div>
        <div className="bg-primary/5 border border-primary/10 p-6 rounded-[2rem] flex flex-col justify-between">
          <p className="text-[9px] font-black text-primary/70 uppercase tracking-widest">En Proceso</p>
          <p className="text-4xl font-black text-primary mt-2">{stats.abiertas}</p>
          <p className="text-[9px] text-primary/50 mt-2 font-bold">Esperando cierre</p>
        </div>
        <div className="bg-success/5 border border-success/10 p-6 rounded-[2rem] flex flex-col justify-between">
          <p className="text-[9px] font-black text-success/70 uppercase tracking-widest">Ventas Cerradas</p>
          <p className="text-4xl font-black text-success mt-2">{stats.ganadas}</p>
          <p className="text-[9px] text-success/50 mt-2 font-bold">{stats.conversion}% de conversión</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-[2rem] text-white flex flex-col justify-between">
          <p className="text-[9px] font-black text-primary uppercase tracking-widest">Mi Ganancia Total</p>
          <p className="text-2xl font-black mt-2">${stats.totalAporte.toLocaleString()}</p>
          <p className="text-[9px] text-gray-400 mt-2 font-bold">Comisiones + Utilidades</p>
        </div>
      </div>

      {/* GRÁFICO DE ESTADO */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          <div className="flex-1">
            <h3 className="font-black text-lg uppercase tracking-tighter text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              Resumen Visual de Proformas
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={50}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: '#F8FAFC' }}
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        return (
                          <div className="bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-black">
                            <p className="text-primary uppercase tracking-widest text-[9px]">{payload[0].payload.name}</p>
                            <p className="text-xl mt-1">{payload[0].value} proformas</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 md:w-64">
            {chartData.map((item) => (
              <div key={item.name} className="text-center p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: item.color }}></div>
                <p className="text-[8px] font-black text-gray-400 uppercase leading-tight">{item.name}</p>
                <p className="text-2xl font-black text-gray-900 mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS REAL */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Filtros por estado */}
        <div className="flex flex-wrap gap-2">
          {filterTabs.map(tab => {
            const Icon = tab.icon
            const isActive = statusFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-lg'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                <Icon size={14} />
                {tab.label}
                <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>
                  {tab.key === 'todas' ? quotes.length
                    : tab.key === 'abierta' ? stats.abiertas
                    : tab.key === 'ganada' ? stats.ganadas
                    : stats.perdidas}
                </span>
              </button>
            )
          })}
        </div>

        {/* Búsqueda de texto */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-3 text-gray-300" size={16} />
          <input
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-gray-300 transition-all"
            placeholder="Buscar por código, agencia o destino..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* TABLA DE RESULTADOS */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-black text-sm uppercase tracking-widest text-gray-500">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            {statusFilter !== 'todas' && ` · ${filterTabs.find(t => t.key === statusFilter)?.label}`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <QuotesTable
            quotes={filtered}
            isAdmin={profile?.rol === 'admin'}
            onUpdate={fetchQuotes}
          />
        </div>
      </div>
    </div>
  )
}
