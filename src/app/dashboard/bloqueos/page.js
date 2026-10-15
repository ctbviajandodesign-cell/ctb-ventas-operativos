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
  Target,
  Edit2,
  Share2
} from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { showToast } from '@/utils/toast'
import IataSelector from '@/components/IataSelector'

export default function BloqueosPage() {
  const { user, profile, isAdmin } = useUserSession()
  const isSuperAdmin = profile?.rol === 'superadmin'
  const isPrivileged = isAdmin || isSuperAdmin

  const [bloqueos, setBloqueos] = useState([])
  const [pasajerosStats, setPasajerosStats] = useState({})
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('activo')

  // Modal State (Create)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)

  // Modal State (Edit for Admin / Superadmin)
  const [showEditModal, setShowEditModal] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [editingBloqueo, setEditingBloqueo] = useState(null)
  const [editFormData, setEditFormData] = useState({
    id: null,
    codigo: '',
    titulo: '',
    destino: '',
    aerolinea: '',
    fecha_salida: '',
    fecha_retorno: '',
    fecha_limite_emision: '',
    fecha_limite_pago: '',
    cupos_totales: 30,
    estado: 'activo',
    precio_vuelo: '',
    precio_operador: '',
    otros_costos: [],
    ganancia_unitaria: 100,
    precio_venta_pax: '',
    notas: ''
  })
  const [editNewTagConcepto, setEditNewTagConcepto] = useState('')
  const [editNewTagPrecio, setEditNewTagPrecio] = useState('')

  // Autocomplete Tags for "Otros"
  const [availableTags, setAvailableTags] = useState([])
  const [newTagConcepto, setNewTagConcepto] = useState('')
  const [newTagPrecio, setNewTagPrecio] = useState('')

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
    precio_vuelo: '',
    precio_operador: '',
    otros_costos: [], // [{ id, concepto, monto }]
    ganancia_unitaria: 100,
    precio_venta_pax: '',
    notas: ''
  })

  useEffect(() => {
    fetchBloqueos()
  }, [])

  async function fetchTags() {
    if (availableTags.length > 0) return
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
      // Parallelize queries and filter ONLY occupied passengers for stats calculation (huge speedup)
      const [blqRes, pasRes] = await Promise.all([
        supabase
          .from('bloqueos')
          .select('*')
          .order('fecha_salida', { ascending: true }),
        supabase
          .from('bloqueo_pasajeros')
          .select('bloqueo_id, faltante, precio_acordado')
          .not('nombres', 'is', null)
          .neq('nombres', '')
      ])

      if (blqRes.error) throw blqRes.error

      const statsMap = {}
      if (pasRes.data) {
        pasRes.data.forEach(p => {
          if (!statsMap[p.bloqueo_id]) {
            statsMap[p.bloqueo_id] = { ocupados: 0, cobrado: 0, pendiente: 0 }
          }
          statsMap[p.bloqueo_id].ocupados++
          const faltante = Number(p.faltante) || 0
          const total = Number(p.precio_acordado) || 0
          statsMap[p.bloqueo_id].pendiente += faltante
          statsMap[p.bloqueo_id].cobrado += Math.max(0, total - faltante)
        })
      }

      setBloqueos(blqRes.data || [])
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
    const breakEvenPax = precioVenta > 0 && inversionTotal > 0 ? Math.ceil(inversionTotal / precioVenta) : 0

    return {
      costoUnitario,
      otrosTotal,
      precioSugerido,
      inversionTotal,
      utilidadProyectada,
      breakEvenPax
    }
  }, [formData.precio_vuelo, formData.precio_operador, formData.otros_costos, formData.ganancia_unitaria, formData.precio_venta_pax, formData.cupos_totales])

  // Recalculate suggested public price when cost fields change
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
        precio_venta_pax: sugerido > 0 ? sugerido : prev.precio_venta_pax
      }
    })
  }

  // Adding other cost with explicit price
  const handleAddOtherCost = () => {
    if (!newTagConcepto || !newTagConcepto.trim()) {
      showToast('Ingresa el concepto del servicio adicional.', 'error')
      return
    }
    const montoNum = Number(newTagPrecio) || 0

    const newItem = {
      id: Date.now().toString(),
      concepto: newTagConcepto.trim(),
      monto: montoNum
    }
    const updatedOtros = [...formData.otros_costos, newItem]
    
    // Auto-update precio_venta_pax
    const vuelo = Number(formData.precio_vuelo) || 0
    const operador = Number(formData.precio_operador) || 0
    const otros = updatedOtros.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    const ganancia = Number(formData.ganancia_unitaria) || 0
    const sugerido = vuelo + operador + otros + ganancia

    setFormData(prev => ({
      ...prev,
      otros_costos: updatedOtros,
      precio_venta_pax: sugerido
    }))

    // Save to predictive tags repository if new
    if (!availableTags.includes(newTagConcepto.trim())) {
      setAvailableTags(prev => [...prev, newTagConcepto.trim()])
      supabase.from('bloqueo_etiquetas_costos').insert([{ nombre: newTagConcepto.trim() }]).then()
    }

    setNewTagConcepto('')
    setNewTagPrecio('')
  }

  const handleUpdateOtherCostPrice = (id, newPrice) => {
    const updatedOtros = formData.otros_costos.map(item => {
      if (item.id === id) {
        return { ...item, monto: Number(newPrice) || 0 }
      }
      return item
    })

    const vuelo = Number(formData.precio_vuelo) || 0
    const operador = Number(formData.precio_operador) || 0
    const otros = updatedOtros.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    const ganancia = Number(formData.ganancia_unitaria) || 0
    const sugerido = vuelo + operador + otros + ganancia

    setFormData(prev => ({
      ...prev,
      otros_costos: updatedOtros,
      precio_venta_pax: sugerido
    }))
  }

  const handleRemoveOtherCost = (id) => {
    const updatedOtros = formData.otros_costos.filter(i => i.id !== id)
    const vuelo = Number(formData.precio_vuelo) || 0
    const operador = Number(formData.precio_operador) || 0
    const otros = updatedOtros.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    const ganancia = Number(formData.ganancia_unitaria) || 0
    const sugerido = vuelo + operador + otros + ganancia

    setFormData(prev => ({
      ...prev,
      otros_costos: updatedOtros,
      precio_venta_pax: sugerido
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
        precio_vuelo: '',
        precio_operador: '',
        otros_costos: [],
        ganancia_unitaria: 100,
        precio_venta_pax: '',
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

  // Calculate live totals for Admin Edit Modal
  const editCostCalculations = useMemo(() => {
    const vuelo = Number(editFormData.precio_vuelo) || 0
    const operador = Number(editFormData.precio_operador) || 0
    const otrosTotal = (editFormData.otros_costos || []).reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    const costoUnitario = vuelo + operador + otrosTotal
    const ganancia = Number(editFormData.ganancia_unitaria) || 0
    const precioSugerido = costoUnitario + ganancia
    const cupos = Number(editFormData.cupos_totales) || 30
    const inversionTotal = costoUnitario * cupos
    const utilidadProyectada = ganancia * cupos
    const precioVenta = Number(editFormData.precio_venta_pax) > 0 ? Number(editFormData.precio_venta_pax) : precioSugerido
    const breakEvenPax = precioVenta > 0 && inversionTotal > 0 ? Math.ceil(inversionTotal / precioVenta) : 0

    return {
      costoUnitario,
      otrosTotal,
      precioSugerido,
      inversionTotal,
      utilidadProyectada,
      breakEvenPax
    }
  }, [editFormData.precio_vuelo, editFormData.precio_operador, editFormData.otros_costos, editFormData.ganancia_unitaria, editFormData.precio_venta_pax, editFormData.cupos_totales])

  const handleCostChangeEdit = (field, val) => {
    setEditFormData(prev => {
      const updated = { ...prev, [field]: val }
      const vuelo = field === 'precio_vuelo' ? Number(val) : Number(prev.precio_vuelo) || 0
      const operador = field === 'precio_operador' ? Number(val) : Number(prev.precio_operador) || 0
      const otros = (prev.otros_costos || []).reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
      const ganancia = field === 'ganancia_unitaria' ? Number(val) : Number(prev.ganancia_unitaria) || 0
      const sugerido = vuelo + operador + otros + ganancia
      
      return {
        ...updated,
        precio_venta_pax: sugerido > 0 ? sugerido : prev.precio_venta_pax
      }
    })
  }

  const handleAddOtherCostEdit = () => {
    if (!editNewTagConcepto || !editNewTagConcepto.trim()) {
      showToast('Ingresa el concepto del servicio adicional.', 'error')
      return
    }
    const montoNum = Number(editNewTagPrecio) || 0

    const newItem = {
      id: Date.now().toString(),
      concepto: editNewTagConcepto.trim(),
      monto: montoNum
    }
    const updatedOtros = [...(editFormData.otros_costos || []), newItem]
    
    const vuelo = Number(editFormData.precio_vuelo) || 0
    const operador = Number(editFormData.precio_operador) || 0
    const otros = updatedOtros.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    const ganancia = Number(editFormData.ganancia_unitaria) || 0
    const sugerido = vuelo + operador + otros + ganancia

    setEditFormData(prev => ({
      ...prev,
      otros_costos: updatedOtros,
      precio_venta_pax: sugerido
    }))

    if (!availableTags.includes(editNewTagConcepto.trim())) {
      setAvailableTags(prev => [...prev, editNewTagConcepto.trim()])
      supabase.from('bloqueo_etiquetas_costos').insert([{ nombre: editNewTagConcepto.trim() }]).then()
    }

    setEditNewTagConcepto('')
    setEditNewTagPrecio('')
  }

  const handleUpdateOtherCostPriceEdit = (id, newPrice) => {
    const updatedOtros = (editFormData.otros_costos || []).map(item => {
      if (item.id === id) {
        return { ...item, monto: Number(newPrice) || 0 }
      }
      return item
    })

    const vuelo = Number(editFormData.precio_vuelo) || 0
    const operador = Number(editFormData.precio_operador) || 0
    const otros = updatedOtros.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    const ganancia = Number(editFormData.ganancia_unitaria) || 0
    const sugerido = vuelo + operador + otros + ganancia

    setEditFormData(prev => ({
      ...prev,
      otros_costos: updatedOtros,
      precio_venta_pax: sugerido
    }))
  }

  const handleRemoveOtherCostEdit = (id) => {
    const updatedOtros = (editFormData.otros_costos || []).filter(i => i.id !== id)
    const vuelo = Number(editFormData.precio_vuelo) || 0
    const operador = Number(editFormData.precio_operador) || 0
    const otros = updatedOtros.reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
    const ganancia = Number(editFormData.ganancia_unitaria) || 0
    const sugerido = vuelo + operador + otros + ganancia

    setEditFormData(prev => ({
      ...prev,
      otros_costos: updatedOtros,
      precio_venta_pax: sugerido
    }))
  }

  const handleOpenEditBloqueo = (bloqueo) => {
    fetchTags()
    setEditingBloqueo(bloqueo)
    setEditFormData({
      id: bloqueo.id,
      codigo: bloqueo.codigo || '',
      titulo: bloqueo.titulo || '',
      destino: bloqueo.destino || '',
      aerolinea: bloqueo.aerolinea || '',
      fecha_salida: bloqueo.fecha_salida || '',
      fecha_retorno: bloqueo.fecha_retorno || '',
      fecha_limite_emision: bloqueo.fecha_limite_emision || '',
      fecha_limite_pago: bloqueo.fecha_limite_pago || '',
      cupos_totales: bloqueo.cupos_totales || 30,
      estado: bloqueo.estado || 'activo',
      precio_vuelo: bloqueo.precio_vuelo || '',
      precio_operador: bloqueo.precio_operador || '',
      otros_costos: Array.isArray(bloqueo.otros_costos) ? bloqueo.otros_costos : [],
      ganancia_unitaria: bloqueo.ganancia_unitaria || 0,
      precio_venta_pax: bloqueo.precio_venta_pax || '',
      notas: bloqueo.notas || ''
    })
    setShowEditModal(true)
  }

  const handleUpdateBloqueo = async (e) => {
    e.preventDefault()
    if (!editFormData.titulo || !editFormData.destino || !editFormData.fecha_salida) {
      showToast('Por favor completa los campos principales (Título, Destino, Fecha de Salida).', 'error')
      return
    }

    setUpdating(true)
    try {
      const oldCupos = editingBloqueo?.cupos_totales || 30
      const newCupos = Number(editFormData.cupos_totales) || 30

      if (newCupos > oldCupos) {
        const newSlots = []
        for (let i = oldCupos + 1; i <= newCupos; i++) {
          newSlots.push({
            bloqueo_id: editFormData.id,
            numero_cupo: i,
            nombres: '',
            precio_acordado: Number(editFormData.precio_venta_pax) || editCostCalculations.precioSugerido,
            estado_pago: 'pendiente'
          })
        }
        const { error: insErr } = await supabase.from('bloqueo_pasajeros').insert(newSlots)
        if (insErr) console.error('Error expanding slots:', insErr)
      } else if (newCupos < oldCupos) {
        const { data: trailingOccupied } = await supabase
          .from('bloqueo_pasajeros')
          .select('numero_cupo, nombres')
          .eq('bloqueo_id', editFormData.id)
          .gt('numero_cupo', newCupos)

        const occupiedTrailing = (trailingOccupied || []).filter(p => p.nombres && p.nombres.trim() !== '')
        if (occupiedTrailing.length > 0) {
          showToast(`No se pueden reducir los cupos a ${newCupos} porque los cupos #${occupiedTrailing.map(t => t.numero_cupo).join(', #')} ya tienen pasajeros asignados.`, 'error')
          setUpdating(false)
          return
        }

        await supabase
          .from('bloqueo_pasajeros')
          .delete()
          .eq('bloqueo_id', editFormData.id)
          .gt('numero_cupo', newCupos)
      }

      const updatePayload = {
        codigo: editFormData.codigo.trim().toUpperCase(),
        titulo: editFormData.titulo.trim(),
        destino: editFormData.destino.trim(),
        aerolinea: editFormData.aerolinea.trim() || null,
        fecha_salida: editFormData.fecha_salida,
        fecha_retorno: editFormData.fecha_retorno || null,
        fecha_limite_emision: editFormData.fecha_limite_emision || null,
        fecha_limite_pago: editFormData.fecha_limite_pago || null,
        cupos_totales: newCupos,
        estado: editFormData.estado,
        precio_venta_pax: Number(editFormData.precio_venta_pax) || editCostCalculations.precioSugerido,
        notas: editFormData.notas?.trim() || null,
        precio_vuelo: Number(editFormData.precio_vuelo) || 0,
        precio_operador: Number(editFormData.precio_operador) || 0,
        otros_costos: editFormData.otros_costos || [],
        ganancia_unitaria: Number(editFormData.ganancia_unitaria) || 0,
        costo_total_unitario: editCostCalculations.costoUnitario,
        updated_at: new Date().toISOString()
      }

      const { error: updError } = await supabase
        .from('bloqueos')
        .update(updatePayload)
        .eq('id', editFormData.id)

      if (updError) throw updError

      showToast(`¡Bloqueo ${editFormData.codigo} actualizado con éxito!`, 'success')
      setShowEditModal(false)
      fetchBloqueos()
    } catch (err) {
      console.error('Error updating bloqueo:', err)
      showToast('No se pudo actualizar el bloqueo: ' + err.message, 'error')
    } finally {
      setUpdating(false)
    }
  }

  // 1-Click WhatsApp Flyer Generator
  const handleShareWhatsApp = (bloqueo) => {
    const stats = pasajerosStats[bloqueo.id] || { ocupados: 0 }
    const cupos = bloqueo.cupos_totales || 30
    const libres = Math.max(0, cupos - stats.ocupados)
    const salida = bloqueo.fecha_salida ? new Date(bloqueo.fecha_salida + 'T00:00:00') : null
    const retorno = bloqueo.fecha_retorno ? new Date(bloqueo.fecha_retorno + 'T00:00:00') : null
    const diffDays = salida ? differenceInDays(salida, new Date()) : 0

    const fechaSalidaStr = salida ? format(salida, "d 'de' MMMM, yyyy", { locale: es }) : 'Por definir'
    const fechaRetornoStr = retorno ? format(retorno, "d 'de' MMMM, yyyy", { locale: es }) : 'Por definir'

    const text = `✈️ *BLOQUEO CONFIRMADO: ${bloqueo.titulo.toUpperCase()}* 🌴
🏷️ *Código:* ${bloqueo.codigo}
📍 *Destino:* ${bloqueo.destino}
🛫 *Aerolínea:* ${bloqueo.aerolinea || 'Confirmada'}
📅 *Salida:* ${fechaSalidaStr}
🔄 *Retorno:* ${fechaRetornoStr}
⏳ *Faltan:* ${diffDays > 0 ? `${diffDays} días para el viaje` : 'Salida inmediata'}
🏨 *Opciones de Hotel:*
  ⭐ Clase 1 (Económica / 3★)
  ⭐ Clase 2 (Estándar / 4★)
  ⭐ Clase 3 (Superior / 5★)
  ⭐ Opciones VIP / Luxury

🔥 *DISPONIBILIDAD:* ${libres > 0 ? `¡Solo quedan ${libres} cupos libres!` : '¡AGOTADO!'} (de ${cupos} totales)
💵 *Tarifa Venta Mayorista:* *$${Number(bloqueo.precio_venta_pax || 0).toLocaleString('es-EC')} USD* por pasajero

📲 *Reserva y emite tus cupos con CTB Viajando Mayorista.*
👉 ¡Emisión y confirmación inmediata con tu ejecutivo!`

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('¡Texto promocional de WhatsApp copiado al portapapeles!', 'success')
      }).catch(() => {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        showToast('¡Texto promocional copiado!', 'success')
      })
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      showToast('¡Texto promocional copiado!', 'success')
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

  // PROMINENT COUNTDOWN BANNER BUILDER
  const renderCountdownBanner = (fechaSalida) => {
    if (!fechaSalida) return null
    const today = new Date()
    today.setHours(0,0,0,0)
    const salida = new Date(fechaSalida + 'T00:00:00')
    const diffDays = differenceInDays(salida, today)

    let theme = {
      bg: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
      text: `Faltan ${diffDays} días para el viaje`,
      iconColor: 'text-blue-400',
      status: 'En cronograma'
    }

    if (diffDays < 0) {
      theme = {
        bg: 'bg-gradient-to-r from-gray-800 to-gray-900',
        badge: 'bg-gray-700 text-gray-300 border-gray-600',
        text: 'Viaje Concluido',
        iconColor: 'text-gray-400',
        status: 'Completado'
      }
    } else if (diffDays === 0) {
      theme = {
        bg: 'bg-gradient-to-r from-emerald-900 to-teal-950',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30 animate-pulse',
        text: '¡EL VIAJE ES HOY!',
        iconColor: 'text-emerald-400',
        status: '¡Despegue hoy!'
      }
    } else if (diffDays <= 7) {
      theme = {
        bg: 'bg-gradient-to-r from-red-950 via-rose-950 to-slate-900',
        badge: 'bg-red-500/20 text-red-300 border-red-400/30 animate-pulse',
        text: `¡Faltan solo ${diffDays} ${diffDays === 1 ? 'día' : 'días'}!`,
        iconColor: 'text-red-400',
        status: 'Última semana'
      }
    } else if (diffDays <= 20) {
      theme = {
        bg: 'bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
        text: `Faltan ${diffDays} días para el viaje`,
        iconColor: 'text-amber-400',
        status: 'Próximo a salir'
      }
    }

    return (
      <div className={`${theme.bg} text-white p-3.5 rounded-2xl flex items-center justify-between border border-white/10 shadow-lg mt-3`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Clock size={18} className={theme.iconColor} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                Cuenta Regresiva
              </span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${theme.badge}`}>
                {theme.status}
              </span>
            </div>
            <p className="text-sm font-black text-white tracking-tight mt-0.5">
              {theme.text}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Fecha Salida</span>
          <span className="text-xs font-black text-white">
            {format(salida, "d MMM yyyy", { locale: es })}
          </span>
        </div>
      </div>
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
            onClick={() => { fetchTags(); setShowCreateModal(true); }}
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
            className="w-full pl-11 pr-4 py-3 bg-white text-gray-900 placeholder:text-gray-400 font-semibold rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 border border-gray-200"
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
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-800">
                        {bloqueo.codigo}
                      </span>
                      {bloqueo.estado && bloqueo.estado !== 'activo' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-gray-200 text-gray-700">
                          {bloqueo.estado}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isPrivileged && (
                        <button
                          onClick={() => handleOpenEditBloqueo(bloqueo)}
                          title="Editar parámetros del bloqueo"
                          className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleShareWhatsApp(bloqueo)}
                        title="Compartir Flyer para WhatsApp"
                        className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-colors"
                      >
                        <Share2 size={13} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-gray-900 group-hover:text-primary transition-colors leading-tight line-clamp-1">
                    {bloqueo.titulo}
                  </h3>

                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 font-semibold">
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

                  {/* PROMINENT COUNTDOWN BANNER */}
                  {renderCountdownBanner(bloqueo.fecha_salida)}

                  {/* Slot Progress Bar */}
                  <div className="mt-5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-600">
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
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50/80 px-3 py-1.5 rounded-xl border border-amber-200/50">
                      <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                      <span>
                        Límite emisión nombres: <strong>{format(parseISO(bloqueo.fecha_limite_emision), "d 'de' MMMM", { locale: es })}</strong>
                      </span>
                    </div>
                  )}

                  {/* Confidential Financial Box for Admin */}
                  {isPrivileged && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-100 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <span className="text-gray-400 block font-medium">Inversión Total:</span>
                        <strong className="text-gray-800 text-xs">${inversionTotal.toLocaleString('es-EC')}</strong>
                      </div>
                      <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-emerald-700 block font-medium">Ganancia Est. Pax:</span>
                        <strong className="text-emerald-800 text-xs">${bloqueo.ganancia_unitaria || 0} USD</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer card: "WhatsApp" & "Ver Tabla" */}
                <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">
                      Tarifa Venta Agencia
                    </span>
                    <span className="text-xl font-black text-primary">
                      ${Number(bloqueo.precio_venta_pax || 0).toLocaleString('es-EC')} <span className="text-xs font-semibold text-gray-400">USD</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleShareWhatsApp(bloqueo)}
                      className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider border border-emerald-200/60 transition-all active:scale-95"
                      title="Copiar texto formateado para WhatsApp"
                    >
                      <Share2 size={13} className="text-emerald-600" />
                      <span>WhatsApp</span>
                    </button>

                    <Link
                      href={`/dashboard/bloqueos/${bloqueo.id}`}
                      className="inline-flex items-center gap-2 bg-gray-900 hover:bg-primary text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-primary/30 active:scale-95 transition-all"
                    >
                      <span>Ver Tabla</span>
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
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
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                  <CalendarRange size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 tracking-tight">Armado de Nuevo Bloqueo</h2>
                  <p className="text-xs text-gray-500 font-medium">Configura costos, margen y cupos para el equipo.</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors"
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
                    <label className="block text-gray-800 font-bold mb-1">Título del Bloqueo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Cartagena Fin de Año"
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Código Identificador</label>
                    <input
                      type="text"
                      placeholder="Ej. BLQ-CTG-OCT26"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                      className="input w-full uppercase bg-white text-gray-900 border border-gray-200 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Destino IATA *</label>
                    <IataSelector
                      value={formData.destino}
                      onChange={(val) => setFormData({ ...formData, destino: val })}
                      placeholder="Buscar ciudad o código IATA..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Aerolínea</label>
                    <input
                      type="text"
                      placeholder="Avianca, Copa, etc."
                      value={formData.aerolinea}
                      onChange={(e) => setFormData({ ...formData, aerolinea: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Fecha Salida *</label>
                    <input
                      type="date"
                      required
                      value={formData.fecha_salida}
                      onChange={(e) => setFormData({ ...formData, fecha_salida: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Fecha Retorno</label>
                    <input
                      type="date"
                      value={formData.fecha_retorno}
                      onChange={(e) => setFormData({ ...formData, fecha_retorno: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Cupos Totales *</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      required
                      value={formData.cupos_totales}
                      onChange={(e) => setFormData({ ...formData, cupos_totales: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-black"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Fechas Límites y Deadlines */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3 flex items-center gap-1.5">
                  <Clock size={14} /> 2. Fechas Críticas de Operador / Aerolínea
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">
                      Fecha Límite Emisión de Nombres (Time Limit)
                    </label>
                    <input
                      type="date"
                      value={formData.fecha_limite_emision}
                      onChange={(e) => setFormData({ ...formData, fecha_limite_emision: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-amber-200 font-semibold"
                    />
                    <span className="text-[10px] text-gray-500 font-medium mt-1 block">Último día para entregar Rooming List sin penalidad.</span>
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">
                      Fecha Límite Pago Total Aerolínea
                    </label>
                    <input
                      type="date"
                      value={formData.fecha_limite_pago}
                      onChange={(e) => setFormData({ ...formData, fecha_limite_pago: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-amber-200 font-semibold"
                    />
                    <span className="text-[10px] text-gray-500 font-medium mt-1 block">Fecha de liquidación obligatoria con proveedor.</span>
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
                        className="w-full p-2.5 pl-7 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-emerald-500 placeholder:text-gray-500"
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
                        className="w-full p-2.5 pl-7 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-emerald-500 placeholder:text-gray-500"
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
                        className="w-full p-2.5 pl-7 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-emerald-300 font-black text-xs focus:outline-none focus:border-emerald-400 placeholder:text-emerald-700"
                        placeholder="100.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Rubro "Otros" con Etiquetas Dinámicas y Precio */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-gray-200 font-bold text-xs">
                      Otros Rubros / Servicios Adicionales (Con Precio Individual)
                    </label>
                    <span className="text-[10px] text-gray-400">Suma automáticamente al costo</span>
                  </div>

                  {/* Input Side by Side: Concepto + Precio + Botón */}
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative flex-1 w-full">
                      <input
                        type="text"
                        list="predictive-tags"
                        placeholder="Concepto (ej. Seguro Médico, Traslados In/Out...)"
                        value={newTagConcepto}
                        onChange={(e) => setNewTagConcepto(e.target.value)}
                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-gray-400 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                      />
                      <datalist id="predictive-tags">
                        {availableTags.map((tag, idx) => (
                          <option key={idx} value={tag} />
                        ))}
                      </datalist>
                    </div>

                    <div className="relative w-full sm:w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio Pax"
                        value={newTagPrecio}
                        onChange={(e) => setNewTagPrecio(e.target.value)}
                        className="w-full p-2.5 pl-7 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-emerald-500 placeholder:text-gray-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddOtherCost}
                      className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap shadow-md shadow-emerald-900/40"
                    >
                      + Agregar Rubro
                    </button>
                  </div>

                  {/* Lista de Servicios / Tags Adicionales con Precio Editable */}
                  {formData.otros_costos?.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {formData.otros_costos.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-slate-800/90 border border-slate-700 px-3 py-2 rounded-xl text-xs text-gray-200"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <Tag size={13} className="text-primary shrink-0" />
                            <span className="font-semibold truncate">{item.concepto}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
                              <span className="text-gray-400 text-[10px] font-bold">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.monto}
                                onChange={(e) => handleUpdateOtherCostPrice(item.id, e.target.value)}
                                className="w-14 bg-transparent text-white font-bold text-xs focus:outline-none text-right"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveOtherCost(item.id)}
                              className="text-gray-400 hover:text-red-400 p-1 transition-colors"
                              title="Eliminar rubro"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                      className="w-full p-2 bg-slate-900 border border-primary/60 rounded-xl text-primary font-black text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
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

      {/* EDIT BLOQUEO MODAL (ADMIN & SUPERADMIN ONLY) */}
      {showEditModal && isPrivileged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 tracking-tight">
                    Editar Bloqueo: {editFormData.codigo}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    Actualiza parámetros del viaje, estado, cupos o estructura de costos.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateBloqueo} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Sección 1: Datos Generales */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Plane size={14} /> 1. Datos Generales del Viaje
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-500">Estado:</span>
                    <select
                      value={editFormData.estado}
                      onChange={(e) => setEditFormData({ ...editFormData, estado: e.target.value })}
                      className="px-2.5 py-1 rounded-xl text-xs font-black uppercase bg-gray-100 text-gray-900 border border-gray-200"
                    >
                      <option value="activo">🟢 Activo</option>
                      <option value="cerrado">🔴 Cerrado</option>
                      <option value="completado">🏁 Completado</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Título del Bloqueo *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.titulo}
                      onChange={(e) => setEditFormData({ ...editFormData, titulo: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Código Identificador</label>
                    <input
                      type="text"
                      value={editFormData.codigo}
                      onChange={(e) => setEditFormData({ ...editFormData, codigo: e.target.value.toUpperCase() })}
                      className="input w-full uppercase bg-white text-gray-900 border border-gray-200 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Destino IATA *</label>
                    <IataSelector
                      value={editFormData.destino}
                      onChange={(val) => setEditFormData({ ...editFormData, destino: val })}
                      placeholder="Buscar ciudad o código IATA..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Aerolínea</label>
                    <input
                      type="text"
                      value={editFormData.aerolinea}
                      onChange={(e) => setEditFormData({ ...editFormData, aerolinea: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Fecha Salida *</label>
                    <input
                      type="date"
                      required
                      value={editFormData.fecha_salida}
                      onChange={(e) => setEditFormData({ ...editFormData, fecha_salida: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Fecha Retorno</label>
                    <input
                      type="date"
                      value={editFormData.fecha_retorno}
                      onChange={(e) => setEditFormData({ ...editFormData, fecha_retorno: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Cupos Totales *</label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      required
                      value={editFormData.cupos_totales}
                      onChange={(e) => setEditFormData({ ...editFormData, cupos_totales: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-black"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Fechas Límites */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3 flex items-center gap-1.5">
                  <Clock size={14} /> 2. Fechas Críticas de Operador / Aerolínea
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">
                      Fecha Límite Emisión de Nombres
                    </label>
                    <input
                      type="date"
                      value={editFormData.fecha_limite_emision}
                      onChange={(e) => setEditFormData({ ...editFormData, fecha_limite_emision: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-amber-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">
                      Fecha Límite Pago Total Aerolínea
                    </label>
                    <input
                      type="date"
                      value={editFormData.fecha_limite_pago}
                      onChange={(e) => setEditFormData({ ...editFormData, fecha_limite_pago: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-amber-200 font-semibold"
                    />
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
                        value={editFormData.precio_vuelo}
                        onChange={(e) => handleCostChangeEdit('precio_vuelo', e.target.value)}
                        className="w-full p-2.5 pl-7 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-emerald-500 placeholder:text-gray-500"
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
                        value={editFormData.precio_operador}
                        onChange={(e) => handleCostChangeEdit('precio_operador', e.target.value)}
                        className="w-full p-2.5 pl-7 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-emerald-500 placeholder:text-gray-500"
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
                        value={editFormData.ganancia_unitaria}
                        onChange={(e) => handleCostChangeEdit('ganancia_unitaria', e.target.value)}
                        className="w-full p-2.5 pl-7 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-emerald-300 font-black text-xs focus:outline-none focus:border-emerald-400 placeholder:text-emerald-700"
                        placeholder="100.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Rubro "Otros" con Etiquetas Dinámicas y Precio */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-gray-200 font-bold text-xs">
                      Otros Rubros / Servicios Adicionales (Con Precio Individual)
                    </label>
                    <span className="text-[10px] text-gray-400">Suma automáticamente al costo</span>
                  </div>

                  {/* Input Side by Side: Concepto + Precio + Botón */}
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative flex-1 w-full">
                      <input
                        type="text"
                        list="predictive-tags-edit"
                        placeholder="Concepto (ej. Seguro Médico, Traslados...)"
                        value={editNewTagConcepto}
                        onChange={(e) => setEditNewTagConcepto(e.target.value)}
                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-gray-400 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                      />
                      <datalist id="predictive-tags-edit">
                        {availableTags.map((tag, idx) => (
                          <option key={idx} value={tag} />
                        ))}
                      </datalist>
                    </div>

                    <div className="relative w-full sm:w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio Pax"
                        value={editNewTagPrecio}
                        onChange={(e) => setEditNewTagPrecio(e.target.value)}
                        className="w-full p-2.5 pl-7 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-emerald-500 placeholder:text-gray-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddOtherCostEdit}
                      className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap shadow-md"
                    >
                      + Agregar Rubro
                    </button>
                  </div>

                  {/* Lista de Servicios / Tags con Precio Editable */}
                  {editFormData.otros_costos?.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {editFormData.otros_costos.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-slate-800/90 border border-slate-700 px-3 py-2 rounded-xl text-xs text-gray-200"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <Tag size={13} className="text-primary shrink-0" />
                            <span className="font-semibold truncate">{item.concepto}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
                              <span className="text-gray-400 text-[10px] font-bold">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.monto}
                                onChange={(e) => handleUpdateOtherCostPriceEdit(item.id, e.target.value)}
                                className="w-14 bg-transparent text-white font-bold text-xs focus:outline-none text-right"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveOtherCostEdit(item.id)}
                              className="text-gray-400 hover:text-red-400 p-1 transition-colors"
                              title="Eliminar rubro"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resumen Calculado y Precio Final al Público */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Costo Base Pax</span>
                    <strong className="text-sm font-black text-white">${editCostCalculations.costoUnitario}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-500 block text-[10px] uppercase font-bold">Ganancia Total</span>
                    <strong className="text-sm font-black text-emerald-400">${editCostCalculations.utilidadProyectada}</strong>
                  </div>
                  <div>
                    <span className="text-amber-500 block text-[10px] uppercase font-bold">Punto Equilibrio</span>
                    <strong className="text-sm font-black text-amber-400">{editCostCalculations.breakEvenPax} cupos</strong>
                  </div>
                  <div className="border-l border-slate-800 pl-2 text-left">
                    <label className="text-primary block text-[10px] uppercase font-black">
                      Precio Venta Público *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editFormData.precio_venta_pax}
                      onChange={(e) => setEditFormData({ ...editFormData, precio_venta_pax: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-primary/60 rounded-xl text-primary font-black text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Notas internas */}
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Notas / Restricciones Internas</label>
                  <textarea
                    rows={2}
                    value={editFormData.notas}
                    onChange={(e) => setEditFormData({ ...editFormData, notas: e.target.value })}
                    placeholder="Políticas de penalidad, equipaje incluido, contactos de aerolínea..."
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn-primary px-8 py-3.5 rounded-2xl font-black uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-primary/25"
                >
                  {updating ? 'Guardando Cambios...' : 'Guardar y Actualizar Bloqueo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
