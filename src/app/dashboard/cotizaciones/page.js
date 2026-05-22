'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import QuotesTable from '@/components/QuotesTable'
import AIInsightCard from '@/components/AIInsightCard'
import { Search, Plus, Filter, CheckCircle2, Clock, XCircle, AlertCircle, AlertTriangle, TrendingUp, DollarSign, FileText, Download } from 'lucide-react'
import Link from 'next/link'
import { showToast } from '@/utils/toast'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts'

export default function CotizacionesPage() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const [selectedCity, setSelectedCity] = useState('todas')
  const { user, profile, isAdmin, loading: sessionLoading } = useUserSession()
  const [errorState, setErrorState] = useState(null)

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchQuotes()
    }
  }, [sessionLoading, user])

  async function fetchQuotes() {
    setLoading(true)
    setErrorState(null)
    try {
      let query = supabase
        .from('cotizaciones')
        .select('id, codigo, agencia, destino, numero_pasajeros, nombres_pasajeros, valor_total, valor_comision, valor_utilidad, comercial, estado, motivo_perdida, created_at, profiles!inner(nombre, ciudad), ventas(id, estado, vouchers(codigo))')
        .order('created_at', { ascending: false })

      if (!isAdmin) {
        query = query.eq('profiles.ciudad', profile.ciudad)
      }

      const { data, error } = await query
      if (error) throw error

      setQuotes(data || [])
    } catch (err) {
      console.error('Error fetching quotes:', err)
      setErrorState('No pudimos cargar la lista de cotizaciones. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportQuotes = () => {
    if (filtered.length === 0) {
      showToast('No hay datos para exportar con el filtro actual.', 'error')
      return
    }

    const escapeCSV = (val) => {
      if (val === undefined || val === null) return '""'
      return `"${val.toString().replace(/"/g, '""')}"`
    }

    const headers = [
      'Código',
      'Agencia',
      'Comercial',
      'Destino',
      'Pasajeros',
      'Valor Cotizado',
      'Estado Cotización',
      'Creado En',
      'Operativo Responsable',
      'Venta Total ($)',
      'Utilidad ($)',
      'Comisión ($)',
      'Total Cobrado ($)',
      'Total Pendiente ($)',
      'Plan de Pagos',
      'Código Voucher',
      'Estado Voucher',
      'Viaje Inicio',
      'Viaje Fin / Caducidad'
    ].join(',')

    const rows = filtered.map(q => {
      const codigo = q.codigo || 'N/A'
      const agencia = q.agencia || 'Directo'
      const comercial = q.comercial || 'N/A'
      const destino = q.destino || 'N/A'
      const pasajeros = q.numero_pasajeros || 0
      const valor = q.valor_total || 0
      const estado = q.estado || 'N/A'
      const fecha = q.created_at ? new Date(q.created_at).toLocaleDateString() : 'N/A'
      const operativo = q.profiles?.nombre || 'N/A'

      // Ventas y Voucher join data
      const venta = q.ventas?.[0]
      const ventaTotal = venta ? (Number(venta.total) || 0) : 0
      const utilidad = venta ? (Number(venta.utilidad) || 0) : 0
      const comision = venta ? (Number(venta.comision) || 0) : 0

      // Plan de pagos
      let totalCobrado = 0
      let totalPendiente = 0
      let planDePagosDesc = 'N/A'
      if (venta && Array.isArray(venta.plan_pagos)) {
        totalCobrado = venta.plan_pagos.filter(m => m.status === 'pagado').reduce((acc, m) => acc + (Number(m.amount) || 0), 0)
        totalPendiente = Math.max(0, ventaTotal - totalCobrado)
        planDePagosDesc = venta.plan_pagos.map(m => `${m.label}: $${m.amount} (${m.status === 'pagado' ? 'Pagado' : 'Pendiente'} - ${m.date || 'Sin fecha'})`).join(' | ')
      } else if (venta) {
        totalCobrado = ventaTotal
        totalPendiente = 0
        planDePagosDesc = 'Cobro Inicial Único'
      }

      // Voucher
      const voucher = venta?.vouchers?.[0]
      const voucherCodigo = voucher ? (voucher.codigo || 'N/A') : 'N/A'
      const voucherEstado = voucher ? (voucher.estado || 'N/A') : 'N/A'
      const viajeInicio = voucher ? (voucher.fecha_viaje_desde || 'N/A') : 'N/A'
      const viajeFin = voucher ? (voucher.fecha_viaje_hasta || 'N/A') : 'N/A'

      return [
        escapeCSV(codigo),
        escapeCSV(agencia),
        escapeCSV(comercial),
        escapeCSV(destino),
        pasajeros,
        valor,
        escapeCSV(estado),
        escapeCSV(fecha),
        escapeCSV(operativo),
        ventaTotal,
        utilidad,
        comision,
        totalCobrado,
        totalPendiente,
        escapeCSV(planDePagosDesc),
        escapeCSV(voucherCodigo),
        escapeCSV(voucherEstado),
        escapeCSV(viajeInicio),
        escapeCSV(viajeFin)
      ].join(',')
    })

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Reporte_General_Cotizaciones_CTB_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Métricas para el mini-dashboard
  const stats = useMemo(() => {
    const total = quotes.length
    const abiertas = quotes.filter(q => (q.estado || '').trim() === 'abierta').length
    const ganadas = quotes.filter(q => (q.estado || '').trim() === 'ganada').length
    const perdidas = quotes.filter(q => (q.estado || '').trim() === 'perdida').length
    const anuladas = quotes.filter(q => (q.estado || '').trim() === 'anulada').length
    const totalVenta = quotes.filter(q => (q.estado || '').trim() === 'ganada')
      .reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0)
    const totalAporte = quotes.filter(q => (q.estado || '').trim() === 'ganada')
      .reduce((acc, q) => acc + (Number(q.valor_comision) || 0) + (Number(q.valor_utilidad) || 0), 0)
    const conversion = total > 0 ? ((ganadas / total) * 100).toFixed(1) : 0

    return { total, abiertas, ganadas, perdidas, anuladas, totalVenta, totalAporte, conversion }
  }, [quotes])

  const chartData = [
    { name: 'En Proceso', value: stats.abiertas, color: '#0066CC' },
    { name: 'Cerradas ✓', value: stats.ganadas, color: '#16A34A' },
    { name: 'No Concretadas', value: stats.perdidas, color: '#F5A623' },
    { name: 'Canceladas', value: stats.anuladas, color: '#EF4444' },
  ]

  // Filtros combinados: estado + búsqueda de texto + ciudad (para admin)
  const filtered = useMemo(() => {
    let result = quotes
    if (statusFilter !== 'todas') {
      result = result.filter(q => (q.estado || '').trim() === statusFilter)
    }
    if (isAdmin && selectedCity !== 'todas') {
      result = result.filter(q => q.profiles?.ciudad === selectedCity)
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      result = result.filter(q =>
        q.codigo?.toLowerCase().includes(s) ||
        q.agencia?.toLowerCase().includes(s) ||
        q.destino?.toLowerCase().includes(s) ||
        q.comercial?.toLowerCase().includes(s) ||
        q.profiles?.nombre?.toLowerCase().includes(s)
      )
    }
    return result
  }, [quotes, statusFilter, selectedCity, search, isAdmin])

  const filterTabs = [
    { key: 'todas', label: 'Todas', icon: FileText, color: 'gray' },
    { key: 'abierta', label: 'En Proceso', icon: Clock, color: 'blue' },
    { key: 'ganada', label: 'Cerradas', icon: CheckCircle2, color: 'green' },
    { key: 'perdida', label: 'No Concretadas', icon: XCircle, color: 'amber' },
    { key: 'anulada', label: 'Canceladas', icon: AlertTriangle, color: 'red' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando cotizaciones...</p>
      </div>
    </div>
  )

  if (errorState) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <h3 className="text-xl font-bold text-gray-800 mb-2">Error de conexión</h3>
      <p className="text-gray-500 mb-6">{errorState}</p>
      <button onClick={fetchQuotes} className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition">
        Reintentar
      </button>
    </div>
  )

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">Mis Cotizaciones</h1>
          <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-1">Requerimientos en proceso de cierre</p>
        </div>
        <Link href="/dashboard/cotizaciones/nueva" className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20">
          <Plus size={18} /> Nueva Cotización
        </Link>
      </div>

      {/* MINI DASHBOARD DE STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Cotizaciones</p>
          <p className="text-4xl font-black text-gray-900 mt-2">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-2 font-bold">Este historial completo</p>
        </div>
        <div className="bg-primary/5 border border-primary/10 p-6 rounded-[2rem] flex flex-col justify-between">
          <p className="text-xs font-black text-primary/80 uppercase tracking-widest">En Proceso</p>
          <p className="text-4xl font-black text-primary mt-2">{stats.abiertas}</p>
          <p className="text-xs text-primary/60 mt-2 font-bold">Esperando cierre</p>
        </div>
        <div className="bg-success/5 border border-success/10 p-6 rounded-[2rem] flex flex-col justify-between">
          <p className="text-xs font-black text-success/80 uppercase tracking-widest">Ventas Cerradas</p>
          <p className="text-4xl font-black text-success mt-2">{stats.ganadas}</p>
          <p className="text-xs text-success/60 mt-2 font-bold">{stats.conversion}% de conversión</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-[2rem] text-white flex flex-col justify-between">
          <p className="text-xs font-black text-primary uppercase tracking-widest">Mi Ganancia Total</p>
          <p className="text-2xl font-black mt-2">${stats.totalAporte.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2 font-bold">Comisiones + Utilidades</p>
        </div>
      </div>


      {/* IA INSIGHT */}
      <AIInsightCard metricas={{
        total: stats.total,
        abiertas: stats.abiertas,
        ganadas: stats.ganadas,
        perdidas: stats.perdidas,
        conversion: stats.conversion,
        totalAporte: stats.totalAporte,
        topDestino: 'N/A'
      }} />

      {/* GRÁFICO DE ESTADO */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          <div className="flex-1">
            <h3 className="font-black text-lg uppercase tracking-tighter text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              Resumen Visual de Cotizaciones
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={50}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12, fontWeight: 900 }} allowDecimals={false} />

                  <Tooltip
                    cursor={{ fill: '#F8FAFC' }}
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        return (
                          <div className="bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-black">
                            <p className="text-primary uppercase tracking-widest text-xs">{payload[0].payload.name}</p>
                            <p className="text-xl mt-1">{payload[0].value} cotizaciones</p>
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
          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            {chartData.map((item) => (
              <div key={item.name} className="text-center p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: item.color }}></div>
                <p className="text-xs font-black text-gray-400 uppercase leading-tight">{item.name}</p>
                <p className="text-2xl font-black text-gray-900 mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* BARRA DE FILTROS REAL */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Filtros por estado */}
        <div className="flex overflow-x-auto pb-2 md:pb-0 hide-scrollbar gap-2 w-full md:w-auto">
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
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${isActive ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>
                  {tab.key === 'todas' ? stats.total
                    : tab.key === 'abierta' ? stats.abiertas
                    : tab.key === 'ganada' ? stats.ganadas
                    : tab.key === 'perdida' ? stats.perdidas
                    : stats.anuladas}
                </span>
              </button>

            )
          })}
        </div>

        {/* Filtro por ciudad (solo admin) */}
        {isAdmin && (
          <div className="relative w-full md:w-48">
            <select
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
            >
              <option value="todas">Todas las Ciudades</option>
              <option value="Quito">Quito</option>
              <option value="Guayaquil">Guayaquil</option>
              <option value="Cuenca">Cuenca</option>
              <option value="Manta">Manta</option>
              <option value="Loja">Loja</option>
            </select>
          </div>
        )}

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
          <button
            onClick={handleExportQuotes}
            className="flex items-center gap-2 bg-gray-900 hover:bg-primary text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:shadow-xl transition-all"
            title="Descargar reporte en Excel / CSV"
          >
            <Download size={14} /> Exportar XLS
          </button>
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
