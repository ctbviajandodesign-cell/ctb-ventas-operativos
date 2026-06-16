'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import QuotesTable from '@/components/QuotesTable'
import AIInsightCard from '@/components/AIInsightCard'
import { Search, Plus, Filter, CheckCircle2, Clock, XCircle, AlertCircle, AlertTriangle, TrendingUp, DollarSign, FileText, Download, ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react'
import Link from 'next/link'
import { showToast } from '@/utils/toast'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts'

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

export default function CotizacionesPage() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const [selectedCity, setSelectedCity] = useState('todas')
  const [selectedOperative, setSelectedOperative] = useState('todas')
  const [operatives, setOperatives] = useState([])
  const [dateFilter, setDateFilter] = useState('mes')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const { user, profile, isAdmin, loading: sessionLoading } = useUserSession()
  const [errorState, setErrorState] = useState(null)

  useEffect(() => {
    if (isAdmin) {
      supabase.from('profiles').select('id, nombre, ciudad').eq('rol', 'operativo').then(({ data }) => {
        setOperatives(data || [])
      })
    }
  }, [isAdmin])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, selectedCity, dateFilter, selectedOperative, customStartDate, customEndDate])

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchQuotes()
    }
  }, [sessionLoading, user])

  async function fetchQuotes() {
    setLoading(true)
    setErrorState(null)
    try {
      const selectStr = isAdmin
        ? 'id, operativo_id, codigo, agencia, destino, numero_pasajeros, nombres_pasajeros, valor_total, valor_comision, valor_utilidad, comercial, estado, motivo_perdida, created_at, notas_iniciales, fecha_caducidad, hora_caducidad, profiles!left(nombre, ciudad), ventas(id, estado, vouchers(codigo))'
        : 'id, operativo_id, codigo, agencia, destino, numero_pasajeros, nombres_pasajeros, valor_total, valor_comision, valor_utilidad, comercial, estado, motivo_perdida, created_at, notas_iniciales, fecha_caducidad, hora_caducidad, profiles!inner(nombre, ciudad), ventas(id, estado, vouchers(codigo))'

      let query = supabase
        .from('cotizaciones')
        .select(selectStr)
        .order('created_at', { ascending: false })

      if (!isAdmin) {
        query = query.eq('operativo_id', user.id)
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
        planDePagosDesc = venta.plan_pagos.map(m => `${m.label}: $${m.amount} (${m.status === 'pagado' ? 'Pagado' : 'Pendiente'} - ${m.method ? m.method.toUpperCase() : 'TRANSFERENCIA'} - ${m.date || 'Sin fecha'})`).join(' | ')
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

  // Enriquecer cotizaciones con estado real basado en si tienen ventas asociadas (ganada/vendida)
  const enrichedQuotes = useMemo(() => {
    return quotes.map(q => {
      const hasActiveVenta = Array.isArray(q.ventas) && q.ventas.some(v => v.estado !== 'anulada')
      let computedEstado = (q.estado || '').trim()
      if (computedEstado !== 'anulada' && computedEstado !== 'perdida' && hasActiveVenta) {
        computedEstado = 'ganada'
      }
      return {
        ...q,
        estado: computedEstado,
        _esCaducada: computedEstado === 'abierta' && isExpired(q)
      }
    })
  }, [quotes])

  const dateFilteredQuotes = useMemo(() => {
    let result = enrichedQuotes
    if (isAdmin && selectedCity !== 'todas') {
      result = result.filter(q => q.profiles?.ciudad === selectedCity)
    }
    if (isAdmin && selectedOperative !== 'todas') {
      result = result.filter(q => q.operativo_id === selectedOperative)
    }
    // Date Filtering (Ecuador Timezone)
    if (dateFilter !== 'todas') {
      const now = new Date()
      const ecTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Guayaquil" }))

      result = result.filter(q => {
        if (!q.created_at) return false
        const date = new Date(q.created_at)
        const qTime = new Date(date.toLocaleString("en-US", { timeZone: "America/Guayaquil" }))
        const diffTime = Math.abs(ecTime - qTime)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (dateFilter === 'hoy') {
          return qTime.toDateString() === ecTime.toDateString()
        }
        if (dateFilter === '24horas') {
          return diffTime <= 24 * 60 * 60 * 1000
        }
        if (dateFilter === 'semana') {
          return diffDays <= 7
        }
        if (dateFilter === 'mes') {
          return qTime.getMonth() === ecTime.getMonth() && qTime.getFullYear() === ecTime.getFullYear()
        }
        if (dateFilter === 'año') {
          return qTime.getFullYear() === ecTime.getFullYear()
        }
        if (dateFilter === 'especifica') {
          if (!customStartDate) return true
          const targetDateStr = new Date(customStartDate + 'T12:00:00').toDateString()
          return qTime.toDateString() === targetDateStr
        }
        if (dateFilter === 'rango') {
          const qTimeMs = new Date(qTime).setHours(0,0,0,0)
          if (customStartDate) {
            const startLimit = new Date(customStartDate + 'T00:00:00').setHours(0,0,0,0)
            if (qTimeMs < startLimit) return false
          }
          if (customEndDate) {
            const endLimit = new Date(customEndDate + 'T00:00:00').setHours(0,0,0,0)
            if (qTimeMs > endLimit) return false
          }
          return true
        }
        return true
      })
    }
    return result
  }, [enrichedQuotes, dateFilter, customStartDate, customEndDate, selectedCity, selectedOperative, isAdmin])

  // Métricas para el mini-dashboard
  const stats = useMemo(() => {
    const total = dateFilteredQuotes.length
    const abiertas = dateFilteredQuotes.filter(q => (q.estado || '').trim() === 'abierta' && !q._esCaducada).length
    const caducadas = dateFilteredQuotes.filter(q => (q.estado || '').trim() === 'abierta' && q._esCaducada).length
    const ganadas = dateFilteredQuotes.filter(q => (q.estado || '').trim() === 'ganada').length
    const perdidas = dateFilteredQuotes.filter(q => (q.estado || '').trim() === 'perdida').length
    const anuladas = dateFilteredQuotes.filter(q => (q.estado || '').trim() === 'anulada').length
    const totalVenta = dateFilteredQuotes.filter(q => (q.estado || '').trim() === 'ganada')
      .reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0)
    const totalAporte = dateFilteredQuotes.filter(q => (q.estado || '').trim() === 'ganada')
      .reduce((acc, q) => acc + (Number(q.valor_comision) || 0) + (Number(q.valor_utilidad) || 0), 0)
    const conversion = total > 0 ? ((ganadas / total) * 100).toFixed(1) : 0

    return { total, abiertas, caducadas, ganadas, perdidas, anuladas, totalVenta, totalAporte, conversion }
  }, [dateFilteredQuotes])

  const chartData = [
    { name: 'En Espera', value: stats.abiertas, color: '#0066CC' },
    { name: 'Caducadas', value: stats.caducadas, color: '#EF4444' },
    { name: 'Vendidas ✓', value: stats.ganadas, color: '#16A34A' },
    { name: 'No Concretadas', value: stats.perdidas, color: '#F5A623' },
    { name: 'Canceladas', value: stats.anuladas, color: '#DC2626' },
  ]

  // Filtros combinados: estado + búsqueda de texto
  const filtered = useMemo(() => {
    let result = dateFilteredQuotes
    if (statusFilter !== 'todas') {
      if (statusFilter === 'abierta') {
        result = result.filter(q => (q.estado || '').trim() === 'abierta' && !q._esCaducada)
      } else if (statusFilter === 'caducada') {
        result = result.filter(q => (q.estado || '').trim() === 'abierta' && q._esCaducada)
      } else {
        result = result.filter(q => (q.estado || '').trim() === statusFilter)
      }
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      result = result.filter(q => {
        const computedEstado = (
          q.estado === 'ganada' ? 'vendida' :
          q.estado === 'perdida' || q.estado === 'anulada' ? 'cancelada' :
          q._esCaducada ? 'caducada' : 'activa en espera'
        ).toLowerCase()

        const passengerNames = Array.isArray(q.nombres_pasajeros)
          ? q.nombres_pasajeros.join(' ').toLowerCase()
          : typeof q.nombres_pasajeros === 'string'
            ? q.nombres_pasajeros.toLowerCase()
            : ''

        const createdDate = q.created_at ? new Date(q.created_at) : null
        const dayStr = createdDate ? createdDate.getDate().toString() : ''
        const dayStrPadded = createdDate ? createdDate.getDate().toString().padStart(2, '0') : ''
        const monthName = createdDate ? createdDate.toLocaleDateString('es-ES', { month: 'long' }).toLowerCase() : ''
        const monthNameShort = createdDate ? createdDate.toLocaleDateString('es-EC', { month: 'short' }).toLowerCase() : ''
        const dateSlashNoYear = createdDate ? `${dayStrPadded}/${(createdDate.getMonth() + 1).toString().padStart(2, '0')}` : ''
        const dateTextNoYear = createdDate ? `${dayStr} de ${monthName}` : ''

        const hasYearInQuery = s.includes('2026') || (s.includes('26') && s.length >= 4)

        const matchesDate = hasYearInQuery
          ? (
              (createdDate?.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).toLowerCase() || '').includes(s) ||
              (createdDate?.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) || '').includes(s) ||
              (q.created_at || '').split('T')[0].includes(s)
            )
          : (
              dayStr === s ||
              dayStrPadded === s ||
              monthName.includes(s) ||
              monthNameShort.includes(s) ||
              dateSlashNoYear.includes(s) ||
              dateTextNoYear.includes(s)
            )

        // Evitar que búsquedas cortas numéricas coincidan con el año "2026" de la cotización
        const matchesCode = q.codigo && (() => {
          const c = q.codigo.toLowerCase()
          if (s.length <= 3 && /^\d+$/.test(s)) {
            const stripped = c.replace(/^(ctb-)?\d{4}-/, '')
            return stripped.includes(s)
          }
          return c.includes(s)
        })()

        return (
          matchesCode ||
          (q.agencia || '').toLowerCase().includes(s) ||
          (q.destino || '').toLowerCase().includes(s) ||
          (q.comercial || '').toLowerCase().includes(s) ||
          passengerNames.includes(s) ||
          (q.profiles?.nombre || '').toLowerCase().includes(s) ||
          computedEstado.includes(s) ||
          matchesDate
        )
      })
    }
    return result
  }, [dateFilteredQuotes, statusFilter, search])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filtered.slice(startIndex, startIndex + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  const filterTabs = [
    { key: 'todas', label: 'Todas', icon: FileText, color: 'gray' },
    { key: 'abierta', label: 'En Espera', icon: Clock, color: 'blue' },
    { key: 'caducada', label: 'Caducadas', icon: AlertTriangle, color: 'red' },
    { key: 'ganada', label: 'Vendidas', icon: CheckCircle2, color: 'green' },
    { key: 'perdida', label: 'No Concretadas', icon: XCircle, color: 'amber' },
    { key: 'anulada', label: 'Canceladas', icon: AlertCircle, color: 'red' },
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Cotizaciones</p>
          <p className="text-4xl font-black text-gray-900 mt-2">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-2 font-bold">{dateFilter === 'mes' ? 'Este Mes' : dateFilter === 'todas' ? 'Este historial completo' : dateFilter === 'hoy' ? 'El día de Hoy' : 'Este Período'}</p>
        </div>
        <div className="bg-primary/5 border border-primary/10 p-6 rounded-[2rem] flex flex-col justify-between">
          <p className="text-xs font-black text-primary/80 uppercase tracking-widest">En Espera</p>
          <p className="text-4xl font-black text-primary mt-2">{stats.abiertas}</p>
          <p className="text-xs text-primary/60 mt-2 font-bold">Esperando cierre</p>
        </div>
        <div className="bg-rose-50/60 border border-rose-100 p-6 rounded-[2rem] text-rose-600 flex flex-col justify-between">
          <p className="text-xs font-black text-rose-500 uppercase tracking-widest">Caducadas</p>
          <p className="text-4xl font-black text-rose-600 mt-2">{stats.caducadas}</p>
          <p className="text-xs text-rose-450 mt-2 font-bold">Fecha límite pasada</p>
        </div>
        <div className="bg-success/5 border border-success/10 p-6 rounded-[2rem] flex flex-col justify-between">
          <p className="text-xs font-black text-success/80 uppercase tracking-widest">Vendidas</p>
          <p className="text-4xl font-black text-success mt-2">{stats.ganadas}</p>
          <p className="text-xs text-success/60 mt-2 font-bold">{stats.conversion}% de conversión</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-[2rem] text-white flex flex-col justify-between col-span-2 md:col-span-1">
          <p className="text-xs font-black text-primary uppercase tracking-widest">Mi Ganancia Total</p>
          <p className="text-2xl font-black mt-2">${stats.totalAporte.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-2 font-bold">Comisiones + Utilidades</p>
        </div>
      </div>


      {/* IA INSIGHT */}
      <AIInsightCard metricas={{
        total: stats.total,
        abiertas: stats.abiertas,
        caducadas: stats.caducadas,
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
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
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
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${isActive ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>
                  {tab.key === 'todas' ? stats.total
                    : tab.key === 'abierta' ? stats.abiertas
                    : tab.key === 'caducada' ? stats.caducadas
                    : tab.key === 'ganada' ? stats.ganadas
                    : tab.key === 'perdida' ? stats.perdidas
                    : stats.anuladas}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
          {/* Filtro por fecha */}
          <div className="relative w-full md:w-auto md:min-w-[13.5rem] flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 hover:bg-gray-100/50 transition-colors">
            <Calendar size={14} className="text-primary shrink-0" />
            <select
              className="w-full appearance-none bg-transparent border-none pr-8 pl-1 py-1 text-xs font-black text-gray-800 outline-none focus:ring-0 cursor-pointer uppercase tracking-wider bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
              value={dateFilter}
              onChange={e => {
                setDateFilter(e.target.value)
                setCustomStartDate('')
                setCustomEndDate('')
              }}
            >
              <option value="todas">Todas las Fechas</option>
              <option value="hoy">Hoy</option>
              <option value="24horas">Últimas 24 Horas</option>
              <option value="semana">Esta Semana</option>
              <option value="mes">Este Mes</option>
              <option value="año">Este Año</option>
              <option value="especifica">Fecha Específica...</option>
              <option value="rango">Rango Personalizado...</option>
            </select>
          </div>

          {/* Selector de Fecha Específica */}
          {dateFilter === 'especifica' && (
            <div className="relative w-full md:w-auto flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 hover:bg-gray-100/50 transition-colors animate-in slide-in-from-left-2 duration-300">
              <Calendar size={14} className="text-primary shrink-0" />
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="bg-transparent border-none text-xs font-black text-gray-800 outline-none focus:ring-0 cursor-pointer"
              />
            </div>
          )}

          {/* Rango Personalizado */}
          {dateFilter === 'rango' && (
            <div className="flex flex-wrap md:flex-nowrap gap-2 items-center w-full md:w-auto animate-in slide-in-from-left-2 duration-300">
              <div className="relative flex-1 md:flex-initial flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 hover:bg-gray-100/50 transition-colors">
                <span className="text-[10px] font-black uppercase text-gray-400">Desde:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-black text-gray-800 outline-none focus:ring-0 cursor-pointer"
                />
              </div>
              <div className="relative flex-1 md:flex-initial flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 hover:bg-gray-100/50 transition-colors">
                <span className="text-[10px] font-black uppercase text-gray-400">Hasta:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-black text-gray-800 outline-none focus:ring-0 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Filtro por ciudad (solo admin) */}
          {isAdmin && (
            <div className="relative w-full md:w-auto md:min-w-[13.5rem] flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 hover:bg-gray-100/50 transition-colors">
              <Filter size={14} className="text-primary shrink-0" />
              <select
                className="w-full appearance-none bg-transparent border-none pr-8 pl-1 py-1 text-xs font-black text-gray-800 outline-none focus:ring-0 cursor-pointer uppercase tracking-wider bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
                value={selectedCity}
                onChange={e => {
                  setSelectedCity(e.target.value)
                  setSelectedOperative('todas')
                }}
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

          {/* Filtro por operativo (solo admin) */}
          {isAdmin && (
            <div className="relative w-full md:w-auto md:min-w-[13.5rem] flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 hover:bg-gray-100/50 transition-colors animate-in fade-in duration-300">
              <Users size={14} className="text-primary shrink-0" />
              <select
                className="w-full appearance-none bg-transparent border-none pr-8 pl-1 py-1 text-xs font-black text-gray-800 outline-none focus:ring-0 cursor-pointer uppercase tracking-wider bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
                value={selectedOperative}
                onChange={e => setSelectedOperative(e.target.value)}
              >
                <option value="todas">Todos los Operativos</option>
                {operatives
                  .filter(op => selectedCity === 'todas' || op.ciudad === selectedCity)
                  .map(op => (
                    <option key={op.id} value={op.id}>{op.nombre}</option>
                  ))}
              </select>
            </div>
          )}

          {/* Búsqueda de texto */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-3.5 text-gray-300" size={14} />
            <input
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-[16px] sm:text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-gray-300 transition-all"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
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
            quotes={paginatedData}
            isAdmin={profile?.rol === 'admin' || profile?.rol === 'superadmin'}
            isSuperAdmin={profile?.rol === 'superadmin'}
            currentUserId={user?.id}
            onUpdate={fetchQuotes}
          />
        </div>
      </div>

      {/* PAGINACIÓN */}
      {filtered.length > itemsPerPage && (
        <div className="bg-white px-8 py-4 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Mostrando {Math.min(filtered.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(filtered.length, currentPage * itemsPerPage)} de {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-800 disabled:opacity-30 disabled:hover:bg-gray-50 rounded-xl transition-colors shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-black text-gray-800 uppercase tracking-widest px-3">
              Pág. {currentPage} de {Math.ceil(filtered.length / itemsPerPage)}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filtered.length / itemsPerPage)))}
              disabled={currentPage === Math.ceil(filtered.length / itemsPerPage)}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-800 disabled:opacity-30 disabled:hover:bg-gray-50 rounded-xl transition-colors shrink-0"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
