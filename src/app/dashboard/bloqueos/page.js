'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import Link from 'next/link'
import { 
  CalendarRange, 
  Plus, 
  Search, 
  Filter, 
  MapPin, 
  Plane, 
  Clock, 
  Users, 
  DollarSign, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  Tag,
  Trash2,
  Calendar,
  X,
  Target
} from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { showToast } from '@/utils/toast'
import IataSelector from '@/components/IataSelector'
import { CTB_CITIES } from '@/data/cities'

export default function BloqueosPage() {
  const { user, profile, isAdmin, loading: sessionLoading } = useUserSession()
  const isSuperAdmin = profile?.rol === 'superadmin'
  const isPrivileged = isAdmin || isSuperAdmin

  const [bloqueos, setBloqueos] = useState([])
  const [pasajerosStats, setPasajerosStats] = useState({})
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('activo')
  const [selectedCity, setSelectedCity] = useState('todas')

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)

  // Autocomplete Tags for "Otros"
  const [availableTags, setAvailableTags] = useState([])
  const [customTagInput, setCustomTagInput] = useState('')

  // Form State for New Bloqueo
  const [formData, setFormData] = useState({
    codigo: '',
    titulo: '',
    destino: '',
    aerolinea: '',
    fecha_salida: '',
    fecha_retorno: '',
    fecha_limite_emision: '',
    fecha_limite_pago: '',
    cupos_totales: 30,
    precio_vuelo: 0,
    precio_operador: 0,
    otros_costos: [], // [{ id, concepto, monto }]
    ganancia_unitaria: 100,
    precio_venta_pax: 0,
    notas: ''
  })

  useEffect(() => {
    fetchBloqueos()
    fetchTags()
  }, [])

  async function fetchTags() {
    try {
      const { data } = await supabase.from('bloqueo_etiquetas_costos').select('nombre').order('nombre')
      if (data) setAvailableTags(data.map(t => t.nombre))
    } catch (e) {
      console.error('Error fetching tags:', e)
    }
  }

  async function fetchBloqueos() {
    setLoading(true)
    try {
      // 1. Fetch bloqueos
      const { data: blqData, error: blqError } = await supabase
        .from('bloqueos')
        .select('*')
        .order('fecha_salida', { ascending: true })

      if (blqError) throw blqError

      // 2. Fetch occupied slots stats for all bloqueos
      const { data: pasData, error: pasError } = await supabase
        .from('bloqueo_pasajeros')
        .select('bloqueo_id, numero_cupo, nombres, faltante, precio_acordado')

      const statsMap = {}
      if (pasData) {
        pasData.forEach(p => {
          if (!statsMap[p.bloqueo_id]) {
            statsMap[p.bloqueo_id] = { ocupados: 0, cobrado: 0, pendiente: 0 }
          }
          if (p.nombres && p.nombres.trim() !== '') {
            statsMap[p.bloqueo_id].ocupados++
            const faltante = Number(p.faltante) || 0
            const total = Number(p.precio_acordado) || 0
            statsMap[p.bloqueo_id].pendiente += faltante
            statsMap[p.bloqueo_id].cobrado += Math.max(0, total - faltante)
          }
        })
      }

      setBloqueos(blqData || [])
      setPasajerosStats(statsMap)
    } catch (err) {
      console.error('Error loading bloqueos:', err)
      showToast('Error al cargar bloqueos: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Calculate live totals for Admin Create Modal
  const costCalculations = useMemo(() => {
    const vuelo = Number(formData.precio_vuelo) || 0
    const operador = Number(formData.precio_operador) || 0
    const otrosTotal = (formData.otros_costos || []).reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    const costoUnitario = vuelo + operador + otrosTotal
    const ganancia = Number(formData.ganancia_unitaria) || 0
    const precioSugerido = costoUnitario + ganancia
    const cupos = Number(formData.cupos_totales) || 30
    const inversionTotal = costoUnitario * cupos
    const utilidadProyectada = ganancia * cupos
    // Break Even: Cuántos cupos a precio_venta_pax para cubrir inversionTotal
    const precioVenta = Number(formData.precio_venta_pax) > 0 ? Number(formData.precio_venta_pax) : precioSugerido
    const breakEvenPax = precioVenta > 0 ? Math.ceil(inversionTotal / precioVenta) : 0

    return {
      costoUnitario,
      otrosTotal,
      precioSugerido,
      inversionTotal,
      utilidadProyectada,
      breakEvenPax
    }
  }, [formData.precio_vuelo, formData.precio_operador, formData.otros_costos, formData.ganancia_unitaria, formData.precio_venta_pax, formData.cupos_totales])

  // Auto-update precio_venta_pax when suggested price changes unless manually overridden
  const handleCostChange = (field, val) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: val }
      const vuelo = field === 'precio_vuelo' ? Number(val) : Number(prev.precio_vuelo) || 0
      const operador = field === 'precio_operador' ? Number(val) : Number(prev.precio_operador) || 0
      const otros = (prev.otros_costos || []).reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
      const ganancia = field === 'ganancia_unitaria' ? Number(val) : Number(prev.ganancia_unitaria) || 0
      const sugerido = vuelo + operador + otros + ganancia
      
      return {
        ...updated,
        precio_venta_pax: sugerido
      }
    })
  }

  const handleAddOtherCost = (concepto, monto = 0) => {
    if (!concepto || !concepto.trim()) return
    const newItem = {
      id: Date.now().toString(),
      concepto: concepto.trim(),
      monto: Number(monto) || 0
    }
    const updatedOtros = [...formData.otros_costos, newItem]
    setFormData(prev => ({
      ...prev,
      otros_costos: updatedOtros
    }))

    // Save to availableTags if not exists
    if (!availableTags.includes(concepto.trim())) {
      setAvailableTags(prev => [...prev, concepto.trim()])
      supabase.from('bloqueo_etiquetas_costos').insert([{ nombre: concepto.trim() }]).then()
    }
    setCustomTagInput('')
  }

  const handleRemoveOtherCost = (id) => {
    setFormData(prev => ({
      ...prev,
      otros_costos: prev.otros_costos.filter(i => i.id !== id)
    }))
  }

  const handleCreateBloqueo = async (e) => {
    e.preventDefault()
    if (!formData.titulo || !formData.destino || !formData.fecha_salida) {
      showToast('Por favor completa los campos principales (Título, Destino, Fecha de Salida).', 'error')
      return
    }

    setCreating(true)
    try {
      const genCodigo = formData.codigo.trim() || `BLQ-${Date.now().toString().slice(-6)}`
      const cupos = Number(formData.cupos_totales) || 30
      const precioVenta = Number(formData.precio_venta_pax) || costCalculations.precioSugerido

      const insertPayload = {
        codigo: genCodigo.toUpperCase(),
        titulo: formData.titulo.trim(),
        destino: formData.destino.trim(),
        aerolinea: formData.aerolinea.trim() || null,
        fecha_salida: formData.fecha_salida,
        fecha_retorno: formData.fecha_retorno || null,
        fecha_limite_emision: formData.fecha_limite_emision || null,
        fecha_limite_pago: formData.fecha_limite_pago || null,
        cupos_totales: cupos,
        precio_venta_pax: precioVenta,
        estado: 'activo',
        notas: formData.notas.trim() || null,
        precio_vuelo: Number(formData.precio_vuelo) || 0,
        precio_operador: Number(formData.precio_operador) || 0,
        otros_costos: formData.otros_costos || [],
        ganancia_unitaria: Number(formData.ganancia_unitaria) || 0,
        costo_total_unitario: costCalculations.costoUnitario,
        creado_por: user?.id || null
      }

      const { data: newBloqueo, error: blqError } = await supabase
        .from('bloqueos')
        .insert([insertPayload])
        .select()
        .single()

      if (blqError) throw blqError

      // Initialize empty slots (1 to cupos)
      const slotsPayload = []
      for (let i = 1; i <= cupos; i++) {
        slotsPayload.push({
          bloqueo_id: newBloqueo.id,
          numero_cupo: i,
          nombres: '',
          precio_acordado: precioVenta,
          estado_pago: 'pendiente'
        })
      }

      const { error: slotsError } = await supabase
        .from('bloqueo_pasajeros')
        .insert(slotsPayload)

      if (slotsError) {
        console.error('Error pre-creating slots:', slotsError)
      }

      showToast(`¡Bloqueo ${newBloqueo.codigo} creado con éxito con ${cupos} cupos!`, 'success')
      setShowCreateModal(false)
      // Reset form
      setFormData({
        codigo: '',
        titulo: '',
        destino: '',
        aerolinea: '',
        fecha_salida: '',
        fecha_retorno: '',
        fecha_limite_emision: '',
        fecha_limite_pago: '',
        cupos_totales: 30,
        precio_vuelo: 0,
        precio_operador: 0,
        otros_costos: [],
        ganancia_unitaria: 100,
        precio_venta_pax: 0,
        notas: ''
      })
      fetchBloqueos()
    } catch (err) {
      console.error('Error creating bloqueo:', err)
      showToast('No se pudo crear el bloqueo: ' + err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  // Filtered Bloqueos
  const filteredBloqueos = useMemo(() => {
    return bloqueos.filter(b => {
      const matchSearch = search === '' || 
        b.titulo?.toLowerCase().includes(search.toLowerCase()) ||
        b.codigo?.toLowerCase().includes(search.toLowerCase()) ||
        b.destino?.toLowerCase().includes(search.toLowerCase()) ||
        b.aerolinea?.toLowerCase().includes(search.toLowerCase())

      const matchStatus = statusFilter === 'todos' || b.estado === statusFilter
      return matchSearch && matchStatus
    })
  }, [bloqueos, search, statusFilter])

  // Summary Metrics
  const summary = useMemo(() => {
    let totalCupos = 0
    let totalOcupados = 0
    let totalDisponibles = 0
    let gananciaPotencialTotal = 0

    filteredBloqueos.forEach(b => {
      const cupos = b.cupos_totales || 0
      const st = pasajerosStats[b.id] || { ocupados: 0 }
      totalCupos += cupos
      totalOcupados += st.ocupados
      totalDisponibles += Math.max(0, cupos - st.ocupados)
      if (isPrivileged) {
        gananciaPotencialTotal += (Number(b.ganancia_unitaria) || 0) * cupos
      }
    })

    const porcentajeOcupacion = totalCupos > 0 ? Math.round((totalOcupados / totalCupos) * 100) : 0

    return {
      bloqueosCount: filteredBloqueos.length,
      totalCupos,
      totalOcupados,
      totalDisponibles,
      porcentajeOcupacion,
      gananciaPotencialTotal
    }
  }, [filteredBloqueos, pasajerosStats, isPrivileged])

  const getCountdownBadge = (fechaSalida) => {
    if (!fechaSalida) return null
    const today = new Date()
    today.setHours(0,0,0,0)
    const salida = new Date(fechaSalida + 'T00:00:00')
    const diffDays = differenceInDays(salida, today)

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gray-100 text-gray-500 uppercase tracking-widest">
          Viaje Concluido
        </span>
      )
    }
    if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 uppercase tracking-widest animate-pulse">
          ✈️ ¡Vuela Hoy!
        </span>
      )
    }
    if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 uppercase tracking-widest">
          <Clock size={12} className="animate-spin text-red-600" /> Faltan {diffDays} {diffDays === 1 ? 'día' : 'días'}
        </span>
      )
    }
    if (diffDays <= 20) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 uppercase tracking-widest">
          <Clock size={12} /> Faltan {diffDays} días
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 uppercase tracking-widest">
        <Clock size={12} /> Faltan {diffDays} días
      </span>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary">
              Control de Inventario
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
              CTB Allotments & Grupos
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1 flex items-center gap-3">
            Bloqueos de Viaje
            <CalendarRange className="text-primary" size={28} />
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Gestión de cupos aéreos, hoteleros, cronómetros regresivos y seguimiento de pasajeros.
          </p>
        </div>

        {isPrivileged && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl shadow-xl shadow-primary/25 hover:shadow-primary/40 active:scale-95 transition-all text-xs font-black uppercase tracking-widest whitespace-nowrap"
          >
            <Plus size={18} />
            Crear Bloqueo
          </button>
        )}
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Bloqueos Activos</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <CalendarRange size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-gray-900">{summary.bloqueosCount}</p>
            <p className="text-xs text-gray-400 font-bold mt-1">Grupos programados</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Cupos Disponibles</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600">{summary.totalDisponibles}</p>
            <p className="text-xs text-gray-400 font-bold mt-1">Por vender de {summary.totalCupos} totales</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Ocupación Global</span>
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black text-gray-900">{summary.porcentajeOcupacion}%</p>
              <span className="text-xs font-black text-gray-500">({summary.totalOcupados} ocupados)</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, summary.porcentajeOcupacion)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">
              {isPrivileged ? 'Utilidad Proyectada' : 'Total en Catálogo'}
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Target size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-gray-900">
              {isPrivileged 
                ? `$${summary.gananciaPotencialTotal.toLocaleString('es-EC')}`
                : `${summary.totalCupos} Cupos`
              }
            </p>
            <p className="text-xs text-gray-400 font-bold mt-1">
              {isPrivileged ? 'Margen neto si se llena el 100%' : 'Capacidad contratada para agencias'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código, destino, aerolínea..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/30"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('todos')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'todos'
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('activo')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'activo'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => setStatusFilter('cerrado')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'cerrado'
                ? 'bg-gray-700 text-white shadow-md'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Cerrados
          </button>
        </div>
      </div>

      {/* Bloqueos Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-gray-100">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">
            Sincronizando bloqueos de viaje...
          </p>
        </div>
      ) : filteredBloqueos.length === 0 ? (
        <div className="text-center p-16 bg-white rounded-3xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto text-gray-300 mb-4">
            <CalendarRange size={32} />
          </div>
          <h3 className="text-base font-black text-gray-800 uppercase tracking-wider">No se encontraron bloqueos</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
            {search ? 'No hay resultados que coincidan con tu búsqueda.' : 'Aún no se han configurado bloqueos para este período.'}
          </p>
          {isPrivileged && !search && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-5 btn-primary inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider px-6 py-3 rounded-2xl"
            >
              <Plus size={16} /> Crear el Primer Bloqueo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBloqueos.map((bloqueo) => {
            const stats = pasajerosStats[bloqueo.id] || { ocupados: 0, cobrado: 0, pendiente: 0 }
            const cupos = bloqueo.cupos_totales || 30
            const ocupados = stats.ocupados
            const libres = Math.max(0, cupos - ocupados)
            const porcentaje = Math.round((ocupados / cupos) * 100)

            // Break-even cálculo
            const costoUnitario = Number(bloqueo.costo_total_unitario) || 0
            const precioVenta = Number(bloqueo.precio_venta_pax) || 0
            const inversionTotal = costoUnitario * cupos
            const breakEvenPax = precioVenta > 0 && costoUnitario > 0 ? Math.ceil(inversionTotal / precioVenta) : Math.round(cupos * 0.6)
            const breakEvenCubierto = ocupados >= breakEvenPax

            return (
              <div
                key={bloqueo.id}
                className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 flex flex-col justify-between group relative"
              >
                {/* Header card */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-800">
                      {bloqueo.codigo}
                    </span>
                    {getCountdownBadge(bloqueo.fecha_salida)}
                  </div>

                  <h3 className="text-lg font-black text-gray-900 group-hover:text-primary transition-colors leading-tight line-clamp-1">
                    {bloqueo.titulo}
                  </h3>

                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 font-semibold">
                    <MapPin size={14} className="text-primary shrink-0" />
                    <span className="truncate">{bloqueo.destino}</span>
                    {bloqueo.aerolinea && (
                      <>
                        <span className="text-gray-300">•</span>
                        <Plane size={14} className="text-gray-400 shrink-0" />
                        <span>{bloqueo.aerolinea}</span>
                      </>
                    )}
                  </div>

                  {/* Dates Row */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-2xl flex items-center justify-between text-xs font-semibold text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-gray-400" />
                      <span>Salida:</span>
                      <strong className="text-gray-900">
                        {bloqueo.fecha_salida ? format(parseISO(bloqueo.fecha_salida), "d MMM yyyy", { locale: es }) : 'S/F'}
                      </strong>
                    </div>
                    {bloqueo.fecha_retorno && (
                      <span className="text-[11px] text-gray-400">
                        Retorno: {format(parseISO(bloqueo.fecha_retorno), "d MMM", { locale: es })}
                      </span>
                    )}
                  </div>

                  {/* Slot Progress Bar */}
                  <div className="mt-5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-500">
                        Ocupación: <strong className="text-gray-900">{ocupados} / {cupos} PAX</strong>
                      </span>
                      <span className={`font-black ${libres === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {libres === 0 ? '¡AGOTADO!' : `Quedan ${libres} libres`}
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          porcentaje >= 80 ? 'bg-emerald-500' : porcentaje >= 40 ? 'bg-primary' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, porcentaje)}%` }}
                      />
                    </div>

                    {/* Break Even Indicator (Admin only) */}
                    {isPrivileged && (
                      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                        <span>Punto de equilibrio: {breakEvenPax} cupos</span>
                        {breakEvenCubierto ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            ✓ Costos cubiertos
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">
                            Faltan {breakEvenPax - ocupados} para cubrir costos
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Deadlines Strip */}
                  {bloqueo.fecha_limite_emision && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50/80 px-2.5 py-1.5 rounded-xl border border-amber-200/50">
                      <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                      <span>
                        Límite emisión nombres: <strong>{format(parseISO(bloqueo.fecha_limite_emision), "d 'de' MMMM", { locale: es })}</strong>
                      </span>
                    </div>
                  )}

                  {/* Confidential Financial Box for Admin */}
                  {isPrivileged && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-100 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-gray-50 p-2 rounded-xl">
                        <span className="text-gray-400 block font-medium">Inversión Total:</span>
                        <strong className="text-gray-800 text-xs">${inversionTotal.toLocaleString('es-EC')}</strong>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded-xl">
                        <span className="text-emerald-700 block font-medium">Ganancia Est. Pax:</span>
                        <strong className="text-emerald-800 text-xs">${bloqueo.ganancia_unitaria || 0} USD</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer card */}
                <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">
                      Tarifa Venta Agencia
                    </span>
                    <span className="text-xl font-black text-primary">
                      ${Number(bloqueo.precio_venta_pax || 0).toLocaleString('es-EC')} <span className="text-xs font-semibold text-gray-400">USD</span>
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/bloqueos/${bloqueo.id}`}
                    className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg hover:bg-primary active:scale-95 transition-all"
                  >
                    Ver Grilla
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE BLOQUEO MODAL (ADMIN ONLY) */}
      {showCreateModal && isPrivileged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                  <CalendarRange size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 tracking-tight">Armado de Nuevo Bloqueo</h2>
                  <p className="text-xs text-gray-400 font-medium">Configura costos, margen y cupos para el equipo.</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-400 hover:text-gray-800 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateBloqueo} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Sección 1: Datos Generales */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                  <Plane size={14} /> 1. Datos Generales del Viaje
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700 font-black mb-1">Título del Bloqueo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Cartagena Fin de Año"
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-black mb-1">Código Identificador</label>
                    <input
                      type="text"
                      placeholder="Ej. BLQ-CTG-OCT26 (Opcional)"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                      className="input w-full uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-black mb-1">Destino IATA *</label>
                    <IataSelector
                      value={formData.destino}
                      onChange={(val) => setFormData({ ...formData, destino: val })}
                      placeholder="Buscar ciudad o código IATA..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
                  <div>
                    <label className="block text-gray-700 font-black mb-1">Aerolínea</label>
                    <input
                      type="text"
                      placeholder="Avianca, Copa, etc."
                      value={formData.aerolinea}
                      onChange={(e) => setFormData({ ...formData, aerolinea: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-black mb-1">Fecha Salida *</label>
                    <input
                      type="date"
                      required
                      value={formData.fecha_salida}
                      onChange={(e) => setFormData({ ...formData, fecha_salida: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-black mb-1">Fecha Retorno</label>
                    <input
                      type="date"
                      value={formData.fecha_retorno}
                      onChange={(e) => setFormData({ ...formData, fecha_retorno: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-black mb-1">Cupos Totales *</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      required
                      value={formData.cupos_totales}
                      onChange={(e) => setFormData({ ...formData, cupos_totales: e.target.value })}
                      className="input w-full font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Fechas Límites y Deadlines */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-3 flex items-center gap-1.5">
                  <Clock size={14} /> 2. Fechas Críticas de Operador / Aerolínea
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-2xl border border-amber-100">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">
                      Fecha Límite Emisión de Nombres (Time Limit)
                    </label>
                    <input
                      type="date"
                      value={formData.fecha_limite_emision}
                      onChange={(e) => setFormData({ ...formData, fecha_limite_emision: e.target.value })}
                      className="input w-full bg-white"
                    />
                    <span className="text-[10px] text-gray-400">Último día para entregar Rooming List sin penalidad.</span>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">
                      Fecha Límite Pago Total Aerolínea
                    </label>
                    <input
                      type="date"
                      value={formData.fecha_limite_pago}
                      onChange={(e) => setFormData({ ...formData, fecha_limite_pago: e.target.value })}
                      className="input w-full bg-white"
                    />
                    <span className="text-[10px] text-gray-400">Fecha de liquidación obligatoria con proveedor.</span>
                  </div>
                </div>
              </div>

              {/* Sección 3: Estructura Financiera y Costos (CONFIDENCIAL ADMIN) */}
              <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-400" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400">
                      3. Costos de Armado & Margen (Confidencial Admin)
                    </h4>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-gray-400 px-2 py-0.5 rounded-full font-bold">
                    Oculto para operativos y comerciales
                  </span>
                </div>

                {/* Rubros Base */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-300 font-bold mb-1">Precio Vuelo Pax ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.precio_vuelo}
                        onChange={(e) => handleCostChange('precio_vuelo', e.target.value)}
                        className="input w-full pl-7 bg-slate-800 border-slate-700 text-white font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-300 font-bold mb-1">Operador Terrestre Pax ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.precio_operador}
                        onChange={(e) => handleCostChange('precio_operador', e.target.value)}
                        className="input w-full pl-7 bg-slate-800 border-slate-700 text-white font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-emerald-400 font-black mb-1">Ganancia Deseada Pax ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.ganancia_unitaria}
                        onChange={(e) => handleCostChange('ganancia_unitaria', e.target.value)}
                        className="input w-full pl-7 bg-emerald-950/60 border-emerald-600/50 text-emerald-300 font-black"
                        placeholder="100.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Rubro "Otros" con Etiquetas Dinámicas */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="block text-gray-300 font-bold">
                    Otros Rubros / Gastos Adicionales (Etiquetas Dinámicas)
                  </label>
                  
                  {/* Lista de tags aplicados */}
                  {formData.otros_costos?.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2">
                      {formData.otros_costos.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-2 bg-slate-800 text-gray-200 px-3 py-1 rounded-xl text-xs border border-slate-700"
                        >
                          <Tag size={12} className="text-primary" />
                          <span>{item.concepto}: <strong>${item.monto}</strong></span>
                          <button
                            type="button"
                            onClick={() => handleRemoveOtherCost(item.id)}
                            className="text-gray-400 hover:text-red-400 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Input rápido para agregar tag */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      list="predictive-tags"
                      placeholder="Concepto (ej. Seguro de Asistencia, Traslados...)"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      className="input flex-1 bg-slate-800 border-slate-700 text-white"
                    />
                    <datalist id="predictive-tags">
                      {availableTags.map((tag, idx) => (
                        <option key={idx} value={tag} />
                      ))}
                    </datalist>

                    <button
                      type="button"
                      onClick={() => {
                        const monto = prompt(`Ingresa el monto por pax para "${customTagInput}":`, '25')
                        if (monto !== null) {
                          handleAddOtherCost(customTagInput, parseFloat(monto) || 0)
                        }
                      }}
                      disabled={!customTagInput.trim()}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl font-bold text-xs disabled:opacity-50"
                    >
                      + Agregar Rubro
                    </button>
                  </div>
                </div>

                {/* Resumen Calculado y Precio Final al Público */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Costo Base Pax</span>
                    <strong className="text-sm font-black text-white">${costCalculations.costoUnitario}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-500 block text-[10px] uppercase font-bold">Ganancia Total</span>
                    <strong className="text-sm font-black text-emerald-400">${costCalculations.utilidadProyectada}</strong>
                  </div>
                  <div>
                    <span className="text-amber-500 block text-[10px] uppercase font-bold">Punto Equilibrio</span>
                    <strong className="text-sm font-black text-amber-400">{costCalculations.breakEvenPax} cupos</strong>
                  </div>
                  <div className="border-l border-slate-800 pl-2 text-left">
                    <label className="text-primary block text-[10px] uppercase font-black">
                      Precio Venta Público *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.precio_venta_pax}
                      onChange={(e) => setFormData({ ...formData, precio_venta_pax: e.target.value })}
                      className="input w-full py-1 text-sm font-black text-primary bg-slate-900 border-primary/50"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary px-8 py-3.5 rounded-2xl font-black uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-primary/25"
                >
                  {creating ? 'Creando Bloqueo...' : 'Guardar y Habilitar Cupos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
