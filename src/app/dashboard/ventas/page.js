'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import { 
  TrendingUp, Search, XCircle, Trash2, Edit, DollarSign,
  CheckCircle2, BarChart3, QrCode, ExternalLink, AlertCircle, Download, AlertTriangle, RotateCcw, Share2,
  ChevronLeft, ChevronRight, Calendar, Filter, Users
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import Link from 'next/link'
import { showToast } from '@/utils/toast'

export default function VentasPage() {
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('activa')
  const [selectedCity, setSelectedCity] = useState('todas')
  const [selectedOperative, setSelectedOperative] = useState('todas')
  const [operatives, setOperatives] = useState([])
  const [dateFilter, setDateFilter] = useState('mes')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const { user, profile, isAdmin, loading: sessionLoading } = useUserSession()
  const [errorState, setErrorState] = useState(null)
  const [selectedVenta, setSelectedVenta] = useState(null)
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const [voucherLoading, setVoucherLoading] = useState(false)
  const [annulVentaModal, setAnnulVentaModal] = useState(null) // { venta, motivo }
  const [deleteConfirmVenta, setDeleteConfirmVenta] = useState(null)
  const [deletingPermanent, setDeletingPermanent] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      supabase.from('profiles').select('id, nombre, ciudad').eq('rol', 'operativo').then(({ data }) => {
        setOperatives(data || [])
      })
    }
  }, [isAdmin])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, selectedCity, dateFilter, selectedOperative])

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchVentas()
    }
  }, [sessionLoading, user])

  async function fetchVentas() {
    setLoading(true)
    setErrorState(null)
    try {
      const selectStr = isAdmin
        ? '*, profiles!left(nombre, ciudad), cotizaciones(id, agencia, destino, codigo, nombres_pasajeros, valor_total, valor_comision, valor_utilidad, valor_bono, comercial, notas_iniciales), vouchers(codigo)'
        : '*, profiles!inner(nombre, ciudad), cotizaciones(id, agencia, destino, codigo, nombres_pasajeros, valor_total, valor_comision, valor_utilidad, valor_bono, comercial, notas_iniciales), vouchers(codigo)'

      let query = supabase
        .from('ventas')
        .select(selectStr)
        .order('created_at', { ascending: false })

      if (!isAdmin) {
        query = query.eq('operativo_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error

      setVentas(data || [])
    } catch (error) {
      console.error(error)
      setErrorState('No pudimos cargar la lista de ventas. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  const getVoucherCodigo = (venta) => {
    if (venta.vouchers) {
      const voucherArr = Array.isArray(venta.vouchers) ? venta.vouchers : [venta.vouchers]
      if (voucherArr.length > 0) return voucherArr[0].codigo
    }
    return null
  }

  const dateFilteredVentas = useMemo(() => {
    let result = ventas
    if (isAdmin && selectedCity !== 'todas') {
      result = result.filter(v => v.profiles?.ciudad === selectedCity)
    }
    if (isAdmin && selectedOperative !== 'todas') {
      result = result.filter(v => v.operativo_id === selectedOperative)
    }
    // Date Filtering (Ecuador Timezone)
    if (dateFilter !== 'todas') {
      const now = new Date()
      const ecTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Guayaquil" }))

      result = result.filter(v => {
        if (!v.created_at) return false
        const date = new Date(v.created_at)
        const qTime = new Date(date.toLocaleString("en-US", { timeZone: "America/Guayaquil" }))
        const diffTime = Math.abs(ecTime - qTime)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (dateFilter === 'hoy') {
          return qTime.toDateString() === ecTime.toDateString()
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
        return true
      })
    }
    return result
  }, [ventas, dateFilter, selectedCity, selectedOperative, isAdmin])

  // Stats calculadas
  const stats = useMemo(() => {
    const activas = dateFilteredVentas.filter(v => v.estado === 'activa')
    const anuladas = dateFilteredVentas.filter(v => v.estado === 'anulada')
    const totalVenta = activas.reduce((acc, v) => acc + (Number(v.total) || 0), 0)
    const totalAporte = activas.reduce((acc, v) => acc + (Number(v.comision) || 0) + (Number(v.utilidad) || 0), 0)
    return { activas: activas.length, anuladas: anuladas.length, totalVenta, totalAporte }
  }, [dateFilteredVentas])

  // Gráfico: ventas por semana/mes (agrupado por día)
  const chartData = useMemo(() => {
    const byDay = {}
    dateFilteredVentas
      .filter(v => v.estado === 'activa')
      .forEach(v => {
        const day = v.created_at?.split('T')[0] || 'N/A'
        if (!byDay[day]) byDay[day] = { fecha: day, ventas: 0, aporte: 0 }
        byDay[day].ventas += Number(v.total) || 0
        byDay[day].aporte += (Number(v.comision) || 0) + (Number(v.utilidad) || 0)
      })
    return Object.values(byDay)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-14) // últimas 2 semanas
      .map(d => ({
        ...d,
        fechaLabel: d.fecha !== 'N/A' ? format(parseISO(d.fecha), 'dd MMM', { locale: es }) : 'N/A'
      }))
  }, [dateFilteredVentas])

  const promptAnular = (venta) => {
    setAnnulVentaModal({ venta, motivo: '' })
  }

  const confirmAnular = async () => {
    if (!annulVentaModal.motivo.trim()) {
      showToast('Debes ingresar un motivo para anular la venta.', 'error')
      return
    }

    const { venta, motivo } = annulVentaModal
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const targetCotizacionId = venta.cotizacion_id || venta.cotizaciones?.id
      const res = await fetch('/api/admin/anular-venta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ventaId: venta.id,
          cotizacionId: targetCotizacionId,
          motivo: motivo.trim()
        })
      })
      const result = await res.json()
      if (!result.ok) throw new Error(result.error || 'Error al anular la venta')
      
      showToast('Venta anulada con éxito')
      setAnnulVentaModal(null)
      fetchVentas()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  const handleDesactivar = async (venta) => {
    if (!confirm('¿Seguro que quieres desactivar esta venta y devolverla al estado de cotización en espera? Se eliminará el voucher generado de forma permanente.')) return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const targetCotizacionId = venta.cotizacion_id || venta.cotizaciones?.id
      const res = await fetch('/api/admin/desactivar-venta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ventaId: venta.id,
          cotizacionId: targetCotizacionId
        })
      })
      const result = await res.json()
      if (!result.ok) throw new Error(result.error || 'Error al desactivar la venta')
      
      showToast('Venta desactivada y devuelta a cotización con éxito')
      fetchVentas()
    } catch (error) {
      showToast(error.message, 'error')
    }
  }

  const handlePermanentDeleteVenta = async () => {
    if (!deleteConfirmVenta) return
    setDeletingPermanent(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const targetCotizacionId = deleteConfirmVenta.cotizacion_id || deleteConfirmVenta.cotizaciones?.id
      const res = await fetch('/api/admin/eliminar-venta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ventaId: deleteConfirmVenta.id,
          cotizacionId: targetCotizacionId
        })
      })
      const result = await res.json()
      if (!result.ok) throw new Error(result.error || 'Error al eliminar la venta')
      showToast('Venta/Proforma eliminada permanentemente de la base de datos.')
      setDeleteConfirmVenta(null)
      fetchVentas()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeletingPermanent(false)
    }
  }



  const handleExportVentas = () => {
    if (filtered.length === 0) {
      showToast('No hay datos para exportar.', 'error')
      return
    }
    const headers = ['ID,Codigo,Agencia,Destino,Valor Total,Comision,Utilidad,Aporte,Pasajeros,Operativo,Comercial,Estado,Fecha']
    const rows = filtered.map(v => {
      const id = v.id
      const codigo = v.cotizaciones?.codigo || 'N/A'
      const agencia = (v.cotizaciones?.agencia || 'Directo').replace(/,/g, ';')
      const destino = (v.cotizaciones?.destino || '').replace(/,/g, ';')
      const total = v.total || 0
      const comision = v.comision || 0
      const utilidad = v.utilidad || 0
      const aporte = (Number(v.comision) || 0) + (Number(v.utilidad) || 0)
      const pasajeros = (v.cotizaciones?.nombres_pasajeros || '').replace(/,/g, ';').replace(/\n/g, ' ')
      const operativo = v.profiles?.nombre || 'N/A'
      const comercial = v.cotizaciones?.comercial || 'N/A'
      const estado = v.estado || 'activa'
      const fecha = new Date(v.created_at).toLocaleDateString()
      return `${id},${codigo},${agencia},${destino},${total},${comision},${utilidad},${aporte},${pasajeros},${operativo},${comercial},${estado},${fecha}`
    })

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Reporte_Ventas_CTB_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filtered = useMemo(() => {
    let result = dateFilteredVentas
    if (statusFilter !== 'todas') {
      result = result.filter(v => v.estado === statusFilter)
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      result = result.filter(v => {
        const computedEstado = (v.estado === 'anulada' ? 'cancelada' : 'activa').toLowerCase()
        const passengerNames = Array.isArray(v.cotizaciones?.nombres_pasajeros)
          ? v.cotizaciones.nombres_pasajeros.join(' ').toLowerCase()
          : typeof v.cotizaciones?.nombres_pasajeros === 'string'
            ? v.cotizaciones.nombres_pasajeros.toLowerCase()
            : ''

        const createdDate = v.created_at ? new Date(v.created_at) : null
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
              (v.created_at || '').split('T')[0].includes(s)
            )
          : (
              dayStr === s ||
              dayStrPadded === s ||
              monthName.includes(s) ||
              monthNameShort.includes(s) ||
              dateSlashNoYear.includes(s) ||
              dateTextNoYear.includes(s)
            )

        // Evitar que búsquedas cortas numéricas coincidan con el año "2026" del código de la cotización
        const matchesCode = v.cotizaciones?.codigo && (() => {
          const c = v.cotizaciones.codigo.toLowerCase()
          if (s.length <= 3 && /^\d+$/.test(s)) {
            const stripped = c.replace(/^(ctb-)?\d{4}-/, '')
            return stripped.includes(s)
          }
          return c.includes(s)
        })()

        return (
          matchesCode ||
          (v.cotizaciones?.agencia || '').toLowerCase().includes(s) ||
          (v.cotizaciones?.destino || '').toLowerCase().includes(s) ||
          passengerNames.includes(s) ||
          (v.profiles?.nombre || '').toLowerCase().includes(s) ||
          (v.cotizaciones?.comercial || '').toLowerCase().includes(s) ||
          computedEstado.includes(s) ||
          matchesDate
        )
      })
    }
    return result
  }, [dateFilteredVentas, statusFilter, search])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filtered.slice(startIndex, startIndex + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando ventas...</p>
      </div>
    </div>
  )

  if (errorState) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <h3 className="text-xl font-bold text-gray-800 mb-2">Error de conexión</h3>
      <p className="text-gray-500 mb-6">{errorState}</p>
      <button onClick={fetchVentas} className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition">
        Reintentar
      </button>
    </div>
  )

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">

      {/* ENCABEZADO */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">Mis Proformas</h1>
        <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-1">Cotizaciones aprobadas y convertidas en venta</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Ventas Activas</p>
          <p className="text-4xl font-black text-gray-900 mt-2">{stats.activas}</p>
          <p className="text-xs text-success font-bold mt-2 uppercase">Confirmadas</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Anuladas</p>
          <p className="text-4xl font-black text-gray-900 mt-2">{stats.anuladas}</p>
          <p className="text-xs text-danger font-bold mt-2 uppercase">Revertidas</p>
        </div>
        <div className="bg-primary/5 border border-primary/10 p-6 rounded-[2rem]">
          <p className="text-xs font-black text-primary/80 uppercase tracking-widest">Total Vendido</p>
          <p className="text-2xl font-black text-primary mt-2">${stats.totalVenta.toLocaleString()}</p>
          <p className="text-xs text-primary/60 font-bold mt-2 uppercase">Solo ventas activas</p>
        </div>
        <div className="bg-gray-900 text-white p-6 rounded-[2rem]">
          <p className="text-xs font-black text-primary uppercase tracking-widest">Mi Ganancia</p>
          <p className="text-2xl font-black mt-2">${stats.totalAporte.toLocaleString()}</p>
          <p className="text-xs text-gray-400 font-bold mt-2 uppercase">Comisión + Utilidad</p>
        </div>

      </div>

      {/* GRÁFICO DE TENDENCIA */}
      {chartData.length > 1 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="font-black text-lg uppercase tracking-tighter text-gray-800 mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-primary" />
            Tendencia de Ventas (Últimos 14 días)
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradVenta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066CC" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0066CC" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAporte" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="fechaLabel" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12, fontWeight: 900 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12, fontWeight: 900 }} />

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload?.length) {
                      return (
                        <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-xl text-xs">
                          <p className="font-black text-primary uppercase text-xs mb-2">{label}</p>
                          <p className="font-black">Venta: ${(payload[0]?.value || 0).toLocaleString()}</p>
                          <p className="font-black text-success">Ganancia: ${(payload[1]?.value || 0).toLocaleString()}</p>
                        </div>

                      )
                    }
                    return null
                  }}
                />
                <Area type="monotone" dataKey="ventas" stroke="#0066CC" strokeWidth={2} fill="url(#gradVenta)" />
                <Area type="monotone" dataKey="aporte" stroke="#16A34A" strokeWidth={2} fill="url(#gradAporte)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-primary rounded-full"></div><span className="text-xs font-black text-gray-400 uppercase">Venta Total</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-success rounded-full"></div><span className="text-xs font-black text-gray-400 uppercase">Mi Ganancia</span></div>
          </div>

        </div>
      )}

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'todas', label: 'Todas' },
            { key: 'activa', label: '✓ Activas' },
            { key: 'anulada', label: '✗ Anuladas' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                statusFilter === tab.key ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
          {/* Filtro por fecha */}
          <div className="relative w-full md:w-auto md:min-w-[13.5rem] flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 hover:bg-gray-100/50 transition-colors">
            <Calendar size={14} className="text-primary shrink-0" />
            <select
              className="w-full appearance-none bg-transparent border-none pr-8 pl-1 py-1 text-xs font-black text-gray-800 outline-none focus:ring-0 cursor-pointer uppercase tracking-wider bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            >
              <option value="todas">Todas las Fechas</option>
              <option value="hoy">Hoy</option>
              <option value="semana">Esta Semana</option>
              <option value="mes">Este Mes</option>
              <option value="año">Este Año</option>
            </select>
          </div>

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

          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-3.5 text-gray-300" size={14} />
            <input
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-[16px] sm:text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-gray-300"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={handleExportVentas}
            className="w-full md:w-auto bg-gray-900 hover:bg-gray-800 text-white text-xs font-black uppercase tracking-widest px-5 py-3 rounded-2xl flex items-center justify-center gap-2 hover:scale-102 transition-all shadow-md shrink-0 animate-in fade-in duration-300"
          >
            <Download size={14} /> Exportar XLS
          </button>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs font-black uppercase tracking-widest">
                <th className="py-4 px-6">Fecha</th>
                <th className="py-4 px-6">Referencia</th>
                <th className="py-4 px-6">Agencia / Destino</th>
                <th className="py-4 px-6 text-right">Total Venta</th>
                <th className="py-4 px-6 text-right">Mi Ganancia</th>
                <th className="py-4 px-6">Operativo</th>
                <th className="py-4 px-6">Comercial</th>
                <th className="py-4 px-6">Estado</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <DollarSign size={48} />
                      <p className="text-xs font-black uppercase tracking-widest">Sin resultados</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.map((venta) => (
                <tr
                  key={venta.id}
                  className={`group hover:bg-gray-50 transition-colors cursor-pointer ${venta.estado === 'anulada' ? 'opacity-40 grayscale' : ''}`}
                  onClick={async () => {
                    setSelectedVenta(venta)
                    setSelectedVoucher(null)
                    setVoucherLoading(true)
                    const { data } = await supabase
                      .from('vouchers')
                      .select('id, codigo, estado')
                      .eq('venta_id', venta.id)
                      .single()
                    setSelectedVoucher(data || null)
                    setVoucherLoading(false)
                  }}
                >
                  <td className="py-4 px-6 text-xs text-gray-500 font-bold">
                    {format(parseISO(venta.created_at), "dd MMM yyyy '·' HH:mm", { locale: es })}
                  </td>
                  <td className="py-4 px-6 font-mono text-xs font-black text-primary">
                    #{venta.cotizaciones?.codigo}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-black text-gray-800 text-sm">{venta.cotizaciones?.agencia}</div>
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">{venta.cotizaciones?.destino}</div>
                  </td>

                  <td className="py-4 px-6 text-right font-black text-gray-900">
                    ${Number(venta.total).toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="bg-success/10 text-success px-3 py-1 rounded-xl font-black text-xs">
                      ${(Number(venta.comision) + Number(venta.utilidad)).toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-xs font-black text-primary uppercase tracking-tighter">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs">
                        {venta.profiles?.nombre?.charAt(0) || 'O'}
                      </div>
                      {venta.profiles?.nombre?.split(' ')[0] || '---'}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-xs font-black text-amber-600 uppercase tracking-tighter">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-amber-500/10 rounded-full flex items-center justify-center text-xs text-amber-600">
                        {venta.cotizaciones?.comercial?.charAt(0) || 'C'}
                      </div>
                      {venta.cotizaciones?.comercial || '---'}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {venta.estado === 'activa'
                      ? <span className="badge-success">ACTIVA</span>
                      : <span className="badge-danger">ANULADA</span>
                    }
                  </td>
                  <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {(() => {
                        const vCodigo = getVoucherCodigo(venta)
                        return vCodigo ? (
                          <>
                            <a
                              href={`/v/${vCodigo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-primary hover:bg-primary/5 rounded-xl transition-colors"
                              title="Ver Voucher"
                            >
                              <QrCode size={18} />
                            </a>
                            <button
                              onClick={(e) => {
                                  e.stopPropagation()
                                  const url = `${window.location.origin}/v/${vCodigo}`
                                  navigator.clipboard.writeText(url)
                                  showToast('Enlace de voucher copiado al portapapeles!')
                                }}
                              className="p-2 text-success hover:bg-success/5 rounded-xl transition-colors"
                              title="Copiar Enlace del Voucher"
                            >
                              <Share2 size={18} />
                            </button>
                          </>
                        ) : null
                      })()}
                      {venta.estado === 'activa' && (
                        <>
                          {(profile?.rol === 'superadmin' || venta.operativo_id === user?.id) && (
                            <button
                              onClick={() => window.dispatchEvent(new CustomEvent('open-sales-modal', {
                                detail: {
                                  ...venta.cotizaciones,
                                  id: venta.cotizaciones?.id,
                                  agencia: venta.cotizaciones?.agencia,
                                  destino: venta.cotizaciones?.destino,
                                  codigo: venta.cotizaciones?.codigo,
                                  nombres_pasajeros: venta.cotizaciones?.nombres_pasajeros,
                                  existingSale: venta
                                }
                              }))}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                              title="Editar Venta"
                            >
                              <Edit size={18} />
                            </button>
                          )}
                          {profile?.rol === 'superadmin' && (
                            <>
                              <button
                                onClick={() => handleDesactivar(venta)}
                                className="p-2 text-primary hover:bg-primary/5 rounded-xl transition-colors"
                                title="Desactivar y Revertir a Cotización"
                              >
                                <RotateCcw size={18} />
                              </button>
                              <button
                                onClick={() => promptAnular(venta)}
                                className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-colors"
                                title="Anular Venta"
                              >
                                <XCircle size={18} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                      {profile?.rol === 'superadmin' && (
                        <button
                          onClick={() => setDeleteConfirmVenta(venta)}
                          className="p-2 text-gray-300 hover:text-red-650 hover:bg-red-50 rounded-xl transition-colors"
                          title="Eliminar permanentemente de la base de datos"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* MODAL DETALLE */}
      {selectedVenta && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="bg-gray-900 p-8 text-white flex justify-between items-start">
              <div>
                <p className="text-xs font-black text-primary uppercase tracking-widest">Detalle de Venta</p>
                <h2 className="text-2xl font-black">#{selectedVenta.cotizaciones?.codigo}</h2>
                <p className="text-sm text-gray-400 mt-1">{selectedVenta.cotizaciones?.agencia} · {selectedVenta.cotizaciones?.destino}</p>
              </div>
              <button onClick={() => { setSelectedVenta(null); setSelectedVoucher(null) }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
              {/* Asignación */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Operativo Responsable</p>
                  <p className="text-xs font-black text-gray-850 uppercase mt-1">
                    👤 {selectedVenta.profiles?.nombre || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comercial</p>
                  <p className="text-xs font-black text-amber-700 uppercase mt-1">
                    💼 {selectedVenta.cotizaciones?.comercial || 'N/A'}
                  </p>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs font-black text-gray-400 uppercase">Total Venta</p>
                  <p className="text-xl font-black text-gray-900 mt-1">${Number(selectedVenta.total).toLocaleString()}</p>
                </div>
                <div className="bg-success/5 p-4 rounded-2xl">
                  <p className="text-xs font-black text-success/80 uppercase">Mi Ganancia</p>
                  <p className="text-xl font-black text-success mt-1">${(Number(selectedVenta.utilidad) + Number(selectedVenta.comision)).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs font-black text-gray-400 uppercase">Bono</p>
                  <p className="text-xl font-black text-gray-900 mt-1">${Number(selectedVenta.bono_counter || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* VOUCHER */}
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Voucher Emitido</h4>
                {voucherLoading ? (
                  <div className="h-12 bg-gray-100 rounded-2xl animate-pulse"></div>
                ) : selectedVoucher ? (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2.5 rounded-xl"><QrCode size={18} className="text-primary" /></div>
                      <div>
                        <p className="font-black text-gray-900 text-sm">{selectedVoucher.codigo}</p>
                        <p className={`text-xs font-black uppercase ${selectedVoucher.estado === 'activo' ? 'text-success' : 'text-danger'}`}>{selectedVoucher.estado}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/dashboard/vouchers" onClick={() => setSelectedVenta(null)} className="flex items-center gap-1.5 text-xs font-black text-primary bg-primary/10 px-3 py-2 rounded-xl hover:bg-primary/20 transition-colors">
                        Ver Voucher <ExternalLink size={12} />
                      </Link>
                      <button 
                        onClick={() => {
                          const url = `${window.location.origin}/v/${selectedVoucher.codigo}`
                          navigator.clipboard.writeText(url)
                          showToast('Enlace de voucher copiado al portapapeles!')
                        }}
                        className="flex items-center gap-1.5 text-xs font-black text-success bg-success/10 px-3 py-2 rounded-xl hover:bg-success/20 transition-colors"
                      >
                        <Share2 size={12} /> Copiar Link
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-amber-700">Esta venta no tiene voucher emitido.</p>
                  </div>
                )}
              </div>

              {/* PLAN DE PAGOS */}
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Plan de Pagos</h4>
                {/* Barra progreso */}
                {Array.isArray(selectedVenta.plan_pagos) && selectedVenta.plan_pagos.length > 0 && (() => {
                  const paid = selectedVenta.plan_pagos.filter(m => m.status === 'pagado').reduce((a, m) => a + Number(m.amount), 0)
                  const pct = selectedVenta.total > 0 ? Math.min((paid / selectedVenta.total) * 100, 100) : 0
                  return (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs font-black uppercase mb-1">
                        <span className="text-success">Cobrado: ${paid.toLocaleString()}</span>
                        <span className={paid < selectedVenta.total ? 'text-amber-600' : 'text-success'}>{paid < selectedVenta.total ? `Pendiente: $${(selectedVenta.total - paid).toLocaleString()}` : '✓ Completo'}</span>
                      </div>
                      <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  )
                })()}
                <div className="space-y-2">
                  {Array.isArray(selectedVenta.plan_pagos) && selectedVenta.plan_pagos.length > 0
                    ? selectedVenta.plan_pagos.map((m, i) => (
                      <div key={i} className={`flex justify-between items-center p-3.5 rounded-xl ${m.status === 'pagado' ? 'bg-success/5 border border-success/10' : 'bg-amber-50 border border-amber-100'}`}>
                        <div>
                          <p className="text-xs font-black text-gray-800">{m.label}</p>
                          <p className="text-xs text-gray-400">
                            {m.date} {m.method && ` · ${m.method === 'tarjeta' ? '💳 Tarjeta' : m.method === 'transferencia' ? '🏦 Transferencia' : '💵 Efectivo'}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-gray-900">${Number(m.amount).toLocaleString()}</p>
                          <p className={`text-xs font-black uppercase ${m.status === 'pagado' ? 'text-success' : 'text-amber-600'}`}>{m.status === 'pagado' ? '✓ Pagado' : 'Pendiente'}</p>
                        </div>
                      </div>
                    ))
                    : <p className="text-xs text-gray-400 italic">Sin plan de pagos registrado</p>
                  }
                </div>
              </div>

              {/* PASAJEROS */}
              {(selectedVenta.cotizaciones?.nombres_pasajeros || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Pasajeros</h4>
                  <div className="flex flex-wrap gap-2">
                    {(selectedVenta.cotizaciones?.nombres_pasajeros || []).map((n, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-black text-primary">{n?.charAt(0)}</div>
                        <p className="text-xs font-bold text-gray-700 uppercase">{n}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedVenta.cotizaciones?.notas_iniciales && (
                <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10">
                  <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-2">Observaciones / Especificaciones del Programa</h4>
                  <p className="text-xs text-gray-700 font-medium whitespace-pre-wrap break-words">{selectedVenta.cotizaciones.notas_iniciales}</p>
                </div>
              )}
            </div>

            <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <button onClick={() => { setSelectedVenta(null); setSelectedVoucher(null) }} className="text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors">
                Cerrar
              </button>
              {selectedVenta.estado === 'activa' && (
                <button
                  onClick={() => {
                    const q = {
                      ...selectedVenta.cotizaciones,
                      id: selectedVenta.cotizaciones?.id,
                      agencia: selectedVenta.cotizaciones?.agencia,
                      destino: selectedVenta.cotizaciones?.destino,
                      codigo: selectedVenta.cotizaciones?.codigo,
                      nombres_pasajeros: selectedVenta.cotizaciones?.nombres_pasajeros,
                      existingSale: selectedVenta
                    }
                    setSelectedVenta(null)
                    setSelectedVoucher(null)
                    window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: q }))
                  }}
                  className="btn-primary py-3 px-6 text-sm flex items-center gap-2"
                >
                  <Edit size={16} /> Editar Plan de Pagos
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ANULAR VENTA */}
      {annulVentaModal && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-md w-full overflow-hidden shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-50 p-3 rounded-full text-danger"><AlertTriangle size={24} /></div>
              <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Anular Venta</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-6 font-bold">
              Estás a punto de anular la venta <span className="text-gray-900">#{annulVentaModal.venta.cotizaciones?.codigo}</span>.
              Esta acción desactivará el voucher asociado y notificará la cancelación en el historial general de la empresa.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-2">Motivo de la cancelación</label>
                <textarea 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-danger/20 outline-none resize-none min-h-[100px]"
                  placeholder="Ej: Cliente canceló el viaje, error en cotización, falta de pago..."
                  value={annulVentaModal.motivo}
                  onChange={(e) => setAnnulVentaModal({...annulVentaModal, motivo: e.target.value})}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setAnnulVentaModal(null)}
                  className="px-6 py-3 rounded-xl text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmAnular}
                  className="bg-danger hover:bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-colors shadow-lg shadow-danger/20"
                >
                  Confirmar Anulación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminación Permanente de Venta */}
      {deleteConfirmVenta && (
        <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 p-8 text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Trash2 size={22} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Eliminar Proforma</h2>
              </div>
              <p className="text-red-100 text-xs font-bold uppercase tracking-widest">Esta acción NO se puede deshacer</p>
            </div>
            <div className="p-8 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-1">Se eliminará permanentemente:</p>
                <p className="font-black text-gray-900 text-sm">#{deleteConfirmVenta.cotizaciones?.codigo} — {deleteConfirmVenta.cotizaciones?.agencia || 'Directo'}</p>
                <p className="text-xs text-gray-500 mt-1">{deleteConfirmVenta.cotizaciones?.destino}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 font-bold space-y-1">
                <p>⚠️ Se borrará también el <b>voucher</b> asociado permanentemente.</p>
                <p>📋 Se guardará un log de auditoría con tu nombre.</p>
                <p>🔄 La cotización asociada se devolverá al estado <b>'abierta'</b> para que pueda ser editada o cerrada nuevamente.</p>
              </div>
            </div>
            <div className="px-8 pb-8 flex gap-3">
              <button
                onClick={() => setDeleteConfirmVenta(null)}
                disabled={deletingPermanent}
                className="flex-1 py-4 rounded-2xl font-black text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePermanentDeleteVenta}
                disabled={deletingPermanent}
                className="flex-1 py-4 rounded-2xl font-black text-sm text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Trash2 size={16} />
                {deletingPermanent ? 'Eliminando...' : 'Sí, eliminar para siempre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
