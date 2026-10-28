'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Users,
  Clock,
  MapPin,
  Plane,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Search,
  Hotel,
  User,
  FileSpreadsheet,
  X,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  CreditCard,
  FolderPlus,
  Edit2,
  Zap,
  BedDouble,
  Star,
  ChevronDown,
  Settings,
  Target,
  RefreshCw,
  Download,
  Share2,
  Copy,
  Check,
  UploadCloud
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { showToast } from '@/utils/toast'
import IataSelector from '@/components/IataSelector'
import BloqueoCountdownTimer from '@/components/BloqueoCountdownTimer'
import BloqueoHotelesConfig from '@/components/dashboard/BloqueoHotelesConfig'
import { exportBloqueoRoomingPDF } from '@/lib/pdf-generator'
import {
  cleanMoney,
  cleanPassengerName,
  detectRoomType,
  parseBloqueoRows,
  parseBloqueoText,
  parseBloqueoExcelBuffer,
  parseSinglePassengerInput,
  matchTeamMember
} from '@/lib/excel-bloqueo-parser'

// Module-level caches for instant detail loading & team helpers
const memoryCacheBloqueoDetail = {}
let memoryCacheHelpers = null

export default function BloqueoDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const { user, profile, isAdmin } = useUserSession()
  const isPrivileged = isAdmin || profile?.rol === 'superadmin'

  const [bloqueo, setBloqueo] = useState(null)
  const [pasajeros, setPasajeros] = useState([])
  const [operativosList, setOperativosList] = useState([])
  const [comercialesList, setComercialesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // View mode: 'tabla' | 'rooming'
  const [viewMode, setViewMode] = useState('tabla')

  // Filtering
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos') // 'todos', 'ocupados', 'libres', 'pendientes'

  // Multi-selection for grouping existing passengers
  const [selectedSlotIds, setSelectedSlotIds] = useState([])
  const [showGroupExistingModal, setShowGroupExistingModal] = useState(false)
  const [existingGroupName, setExistingGroupName] = useState('')

  // Modals State
  const [showSingleModal, setShowSingleModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showQuickPasteModal, setShowQuickPasteModal] = useState(false)
  const [showExcelImportModal, setShowExcelImportModal] = useState(false)
  const [excelImportTab, setExcelImportTab] = useState('paste') // 'paste' | 'file'
  const [excelImportMode, setExcelImportMode] = useState('sync') // 'sync' | 'append'
  const [excelImportRawText, setExcelImportRawText] = useState('')
  const [excelImportedData, setExcelImportedData] = useState(null)
  const [isParsingExcelImport, setIsParsingExcelImport] = useState(false)
  const [singlePasteText, setSinglePasteText] = useState('')
  const [singlePasteDetectedInfo, setSinglePasteDetectedInfo] = useState('')
  const [showEditBloqueoModal, setShowEditBloqueoModal] = useState(false)
  const [showAddPaxMenu, setShowAddPaxMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [selectedSlotNumber, setSelectedSlotNumber] = useState(null)

  // Modal Manifiesto Aéreo GDS
  const [showGdsModal, setShowGdsModal] = useState(false)
  const [gdsFormat, setGdsFormat] = useState('amadeus') // 'amadeus' | 'web' | 'simple'
  const [copiedGds, setCopiedGds] = useState(false)

  // Modal Asignación Masiva de Hotel
  const [showBatchHotelModal, setShowBatchHotelModal] = useState(false)
  const [batchHotelForm, setBatchHotelForm] = useState({
    hotel: '',
    tipo_habitacion: 'Doble',
    categoria_habitacion: 'Clase 2 (Estándar / 4★)'
  })

  // Quick Paste text & metadata
  const [quickPasteText, setQuickPasteText] = useState('')
  const [quickPasteMeta, setQuickPasteMeta] = useState({
    agencia: '',
    ciudad: 'GYE',
    operativo_id: '',
    operativo_nombre: '',
    comercial_id: '',
    comercial_nombre: '',
    hoteles: '',
    categoria_habitacion: 'Clase 2 (Estándar / 4★)',
    tipo_servicio: 'PAQUETE COMPLETO'
  })

  // Edit Bloqueo Form (for Admin/SuperAdmin from detail page)
  const [editBloqueoForm, setEditBloqueoForm] = useState({
    titulo: '',
    codigo: '',
    destino: '',
    aerolinea: '',
    fecha_salida: '',
    fecha_retorno: '',
    fecha_limite_emision: '',
    fecha_limite_pago: '',
    cupos_totales: 30,
    estado: 'activo',
    precio_venta_pax: '',
    notas: '',
    hoteles: []
  })

  // Single Passenger Form
  const [singleForm, setSingleForm] = useState({
    slot_id: null,
    numero_cupo: 1,
    codigo_cotizacion: '',
    agencia: '',
    ciudad: 'GYE',
    tipo_servicio: 'PAQUETE COMPLETO',
    operativo_id: '',
    operativo_nombre: '',
    comercial_id: '',
    comercial_nombre: '',
    hoteles: '',
    // Airline Data (Opcional)
    nombres: '',
    apellidos: '',
    tipo_documento: 'Cédula',
    numero_documento: '',
    fecha_nacimiento: '',
    caducidad_pasaporte: '',
    nacionalidad: 'ECUATORIANA',
    genero: 'M',
    tipo_habitacion: 'Doble',
    categoria_habitacion: 'Clase 2 (Estándar / 4★)',
    requerimientos_especiales: '',
    // Finanzas & Pagos Ilimitados
    precio_acordado: 0,
    plan_pagos: [
      { id: '1', numero: 1, label: 'Abono 1 (Reserva)', monto: 100, fecha: '', estado: 'pagado', nota: '' }
    ],
    fecha_limite_pago_agencia: '',
    observaciones: ''
  })

  // Group Form (Nombre por Nombre)
  const [groupForm, setGroupForm] = useState({
    grupo_nombre: '',
    agencia: '',
    ciudad: 'GYE',
    tipo_servicio: 'PAQUETE COMPLETO',
    operativo_id: '',
    operativo_nombre: '',
    comercial_id: '',
    comercial_nombre: '',
    hoteles: '',
    codigo_cotizacion: '',
    precio_por_pax: 0,
    categoria_habitacion: 'Clase 2 (Estándar / 4★)',
    // Dynamic list of passengers (nombre por nombre)
    pasajeros_lista: [
      { id: '1', nombres: '', apellidos: '', tipo_documento: 'Cédula', numero_documento: '', tipo_habitacion: 'Doble', categoria_habitacion: 'Clase 2 (Estándar / 4★)' },
      { id: '2', nombres: '', apellidos: '', tipo_documento: 'Cédula', numero_documento: '', tipo_habitacion: 'Doble', categoria_habitacion: 'Clase 2 (Estándar / 4★)' }
    ],
    // Dynamic payment plan for the group
    plan_pagos: [
      { id: '1', numero: 1, label: 'Abono 1 (Reserva Grupo)', monto: 200, fecha: '', estado: 'pagado', nota: '' }
    ],
    fecha_limite_pago_agencia: '',
    observaciones: ''
  })

  useEffect(() => {
    if (!id) return
    if (memoryCacheBloqueoDetail[id]) {
      setBloqueo(memoryCacheBloqueoDetail[id].bloqueo)
      setPasajeros(memoryCacheBloqueoDetail[id].pasajeros)
      setLoading(false)
      fetchBloqueoData(false)
    } else {
      fetchBloqueoData(true)
    }
    fetchHelpers()
  }, [id])

  // Sincronización en Tiempo Real (Supabase Realtime Channel)
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`realtime:bloqueo:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bloqueo_pasajeros',
          filter: `bloqueo_id=eq.${id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setPasajeros(prev => prev.map(p => {
              if (p.id === payload.new.id) {
                return {
                  ...p,
                  ...payload.new,
                  categoria_habitacion: payload.new.categoria_habitacion || p.categoria_habitacion || 'Clase 2 (Estándar / 4★)'
                }
              }
              return p
            }))
          } else if (payload.eventType === 'INSERT' && payload.new) {
            setPasajeros(prev => {
              if (prev.some(p => p.id === payload.new.id)) return prev
              const inserted = {
                ...payload.new,
                categoria_habitacion: payload.new.categoria_habitacion || 'Clase 2 (Estándar / 4★)'
              }
              return [...prev, inserted].sort((a, b) => (a.numero_cupo || 0) - (b.numero_cupo || 0))
            })
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setPasajeros(prev => prev.filter(p => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  async function fetchHelpers() {
    if (memoryCacheHelpers) {
      setOperativosList(memoryCacheHelpers.operativos)
      setComercialesList(memoryCacheHelpers.comerciales)
      return
    }
    try {
      const [{ data: ops }, { data: coms }] = await Promise.all([
        supabase.from('profiles').select('id, nombre, ciudad').in('rol', ['operativo', 'comercial', 'admin', 'superadmin']),
        supabase.from('comerciales').select('id, nombre, ciudad')
      ])
      memoryCacheHelpers = { operativos: ops || [], comerciales: coms || [] }
      if (ops) setOperativosList(ops)
      if (coms) setComercialesList(coms)
    } catch (e) {
      console.error('Error fetching helpers:', e)
    }
  }

  async function fetchBloqueoData(showSpinner = true) {
    if (showSpinner) setLoading(true)
    try {
      const [blqRes, pasRes] = await Promise.all([
        supabase.from('bloqueos').select('*').eq('id', id).single(),
        supabase.from('bloqueo_pasajeros').select('*').eq('bloqueo_id', id).order('numero_cupo', { ascending: true })
      ])

      if (blqRes.error) throw blqRes.error
      setBloqueo(blqRes.data)

      if (pasRes.error) throw pasRes.error

      let rawPas = pasRes.data || []
      const expectedCupos = Number(blqRes.data?.cupos_totales) || 30

      // Auto-generar cupos faltantes si el bloqueo tiene menos registros en BD que cupos_totales
      if (rawPas.length < expectedCupos) {
        const existingNumbers = new Set(rawPas.map(p => p.numero_cupo))
        const missingSlots = []
        for (let i = 1; i <= expectedCupos; i++) {
          if (!existingNumbers.has(i)) {
            missingSlots.push({
              bloqueo_id: id,
              numero_cupo: i,
              nombres: '',
              precio_acordado: Number(blqRes.data?.precio_venta_pax) || 0,
              estado_pago: 'pendiente'
            })
          }
        }
        if (missingSlots.length > 0) {
          const { data: insertedSlots } = await supabase
            .from('bloqueo_pasajeros')
            .insert(missingSlots)
            .select()
          if (insertedSlots && insertedSlots.length > 0) {
            rawPas = [...rawPas, ...insertedSlots].sort((a, b) => a.numero_cupo - b.numero_cupo)
          }
        }
      }

      // Auto-extract categoria_habitacion from observaciones if column is null
      const normalizedPas = rawPas.map(p => {
        if (!p) return p
        let cat = p.categoria_habitacion
        if (!cat && p.observaciones) {
          const match = String(p.observaciones).match(/^\[(.*?)\]/)
          if (match) cat = match[1]
        }
        return {
          ...p,
          categoria_habitacion: cat || 'Clase 2 (Estándar / 4★)'
        }
      })

      memoryCacheBloqueoDetail[id] = { bloqueo: blqRes.data, pasajeros: normalizedPas }
      setPasajeros(normalizedPas)
    } catch (err) {
      console.error('Error fetching bloqueo detail:', err)
      showToast('Error al cargar detalle del bloqueo.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Summary Metrics (always returns safe numbers)
  const metrics = useMemo(() => {
    const totalCupos = Number(bloqueo?.cupos_totales) || 30
    let ocupados = 0
    let totalCobrado = 0
    let totalPendiente = 0

    if (bloqueo && Array.isArray(pasajeros)) {
      pasajeros.forEach(p => {
        if (!p) return
        const pNombres = String(p.nombres || '').trim()
        if (pNombres !== '') {
          ocupados++
          let abonos = 0
          if (Array.isArray(p.plan_pagos) && p.plan_pagos.length > 0) {
            abonos = p.plan_pagos
              .filter(item => item && item.estado === 'pagado')
              .reduce((sum, item) => sum + (Number(item?.monto) || 0), 0)
          } else {
            abonos = (Number(p.abono_1) || 0) + (Number(p.abono_2) || 0) + (Number(p.abono_3) || 0)
          }
          const total = Number(p.precio_acordado) || Number(bloqueo.precio_venta_pax) || 0
          totalCobrado += abonos
          totalPendiente += Math.max(0, total - abonos)
        }
      })
    }

    const disponibles = Math.max(0, totalCupos - ocupados)
    const porcentaje = totalCupos > 0 ? Math.round((ocupados / totalCupos) * 100) : 0

    const costoUnitario = Number(bloqueo?.costo_total_unitario) || 0
    const inversionTotal = costoUnitario * totalCupos
    const precioVenta = Number(bloqueo?.precio_venta_pax) || 0
    const breakEvenPax = precioVenta > 0 && costoUnitario > 0 ? Math.ceil(inversionTotal / precioVenta) : Math.round(totalCupos * 0.6)
    const faltaRecuperarDinero = Math.max(0, inversionTotal - totalCobrado)
    const gananciaLiquidaActual = Math.max(0, totalCobrado - inversionTotal)
    const inversionCubierta = inversionTotal > 0 && totalCobrado >= inversionTotal
    const porcentajeRecuperado = inversionTotal > 0 ? Math.min(100, Math.round((totalCobrado / inversionTotal) * 100)) : 0
    const faltanPaxMeta = Math.max(0, breakEvenPax - ocupados)

    return {
      totalCupos,
      ocupados,
      disponibles,
      porcentaje,
      totalCobrado,
      totalPendiente,
      costoUnitario,
      inversionTotal,
      faltaRecuperarDinero,
      gananciaLiquidaActual,
      inversionCubierta,
      porcentajeRecuperado,
      faltanPaxMeta
    }
  }, [bloqueo, pasajeros])

  // Extract payment installments array (from plan_pagos column or fallback)
  const getSlotInstallments = (slot) => {
    if (!slot) return []
    let raw = slot.plan_pagos
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) } catch {}
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter(Boolean)
    }
    // Fallback to abono_1, abono_2, abono_3
    const list = []
    if (Number(slot.abono_1) > 0 || slot.fecha_abono_1) {
      list.push({ id: '1', numero: 1, label: 'Abono 1', monto: Number(slot.abono_1) || 0, fecha: slot.fecha_abono_1 || '', estado: 'pagado' })
    }
    if (Number(slot.abono_2) > 0 || slot.fecha_abono_2) {
      list.push({ id: '2', numero: 2, label: 'Abono 2', monto: Number(slot.abono_2) || 0, fecha: slot.fecha_abono_2 || '', estado: 'pagado' })
    }
    if (Number(slot.abono_3) > 0 || slot.fecha_abono_3) {
      list.push({ id: '3', numero: 3, label: 'Abono 3', monto: Number(slot.abono_3) || 0, fecha: slot.fecha_abono_3 || '', estado: 'pagado' })
    }
    if (list.length === 0) {
      list.push({ id: '1', numero: 1, label: 'Abono 1', monto: 100, fecha: '', estado: 'pagado' })
    }
    return list
  }

  // Normalizar nombres sin acentos, espacios múltiples y en mayúsculas para comparaciones seguras
  const normalizePassengerName = (str) => (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

  // Extract strictly stored payment installments without synthetic default fallbacks
  const getSlotStoredPayments = (slot) => {
    if (!slot) return []
    let raw = slot.plan_pagos
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) } catch {}
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter(Boolean)
    }
    const list = []
    if (Number(slot.abono_1) > 0) {
      list.push({ id: '1', numero: 1, label: 'Abono 1', monto: Number(slot.abono_1), fecha: slot.fecha_abono_1 || '', estado: 'pagado' })
    }
    if (Number(slot.abono_2) > 0) {
      list.push({ id: '2', numero: 2, label: 'Abono 2', monto: Number(slot.abono_2), fecha: slot.fecha_abono_2 || '', estado: 'pagado' })
    }
    if (Number(slot.abono_3) > 0) {
      list.push({ id: '3', numero: 3, label: 'Abono 3', monto: Number(slot.abono_3), fecha: slot.fecha_abono_3 || '', estado: 'pagado' })
    }
    return list
  }

  // Hoteles configurados en el bloqueo (solo hoteles válidos con nombre no vacío)
  const configuredHoteles = useMemo(() => {
    let raw = bloqueo?.hoteles
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) } catch {}
    }
    if (!Array.isArray(raw)) return []
    return raw.filter(h => h && typeof h.nombre === 'string' && h.nombre.trim() !== '')
  }, [bloqueo?.hoteles])

  // Hotel seleccionado en Single Form
  const selectedSingleHotelObj = useMemo(() => {
    if (!singleForm.hoteles) return null
    const sName = (singleForm.hoteles || '').trim().toLowerCase()
    return configuredHoteles.find(h => (h.nombre || '').trim().toLowerCase() === sName) || null
  }, [configuredHoteles, singleForm.hoteles])

  // Habitaciones disponibles para Single Form
  const availableSingleRooms = useMemo(() => {
    if (selectedSingleHotelObj && Array.isArray(selectedSingleHotelObj.habitaciones) && selectedSingleHotelObj.habitaciones.length > 0) {
      return selectedSingleHotelObj.habitaciones
    }
    const base = Number(bloqueo?.precio_venta_pax) || 0
    return [
      { id: '1', tipo: 'Doble', precio: base },
      { id: '2', tipo: 'Simple (SGL)', precio: Math.round(base * 1.25) },
      { id: '3', tipo: 'Triple', precio: base },
      { id: '4', tipo: 'Matrimonial', precio: base },
      { id: '5', tipo: 'Twin', precio: base },
      { id: '6', tipo: 'Cuádruple', precio: base }
    ]
  }, [selectedSingleHotelObj, bloqueo?.precio_venta_pax])

  // Hotel seleccionado en Group Form
  const selectedGroupHotelObj = useMemo(() => {
    if (!groupForm.hoteles) return null
    const gName = (groupForm.hoteles || '').trim().toLowerCase()
    return configuredHoteles.find(h => (h.nombre || '').trim().toLowerCase() === gName) || null
  }, [configuredHoteles, groupForm.hoteles])

  // Habitaciones disponibles para Group Form
  const availableGroupRooms = useMemo(() => {
    if (selectedGroupHotelObj && Array.isArray(selectedGroupHotelObj.habitaciones) && selectedGroupHotelObj.habitaciones.length > 0) {
      return selectedGroupHotelObj.habitaciones
    }
    const base = Number(bloqueo?.precio_venta_pax) || 0
    return [
      { id: '1', tipo: 'Doble', precio: base },
      { id: '2', tipo: 'Simple (SGL)', precio: Math.round(base * 1.25) },
      { id: '3', tipo: 'Triple', precio: base },
      { id: '4', tipo: 'Matrimonial', precio: base },
      { id: '5', tipo: 'Twin', precio: base },
      { id: '6', tipo: 'Cuádruple', precio: base }
    ]
  }, [selectedGroupHotelObj, bloqueo?.precio_venta_pax])

  // Ocupación y disponibilidad en tiempo real por cada hotel
  const hotelStats = useMemo(() => {
    const stats = {}
    const occupiedList = (pasajeros || []).filter(p => p && String(p.nombres || '').trim() !== '')
    const remainingInBloqueo = Math.max(0, (Number(bloqueo?.cupos_totales) || 30) - occupiedList.length)

    // Inicializar hoteles configurados de forma segura
    const hotelList = Array.isArray(configuredHoteles) ? configuredHoteles : []
    hotelList.forEach(h => {
      if (!h) return
      const hKey = String(h.nombre || '').trim().toLowerCase()
      if (!hKey) return
      const totCupos = Number(h.cupos) || 0
      const isOpen = totCupos === 0
      stats[hKey] = {
        hotel: h,
        nombre: h.nombre,
        categoria: h.categoria,
        regimen: h.regimen,
        cuposTotales: totCupos,
        isOpen,
        ocupados: 0,
        disponibles: isOpen ? remainingInBloqueo : totCupos
      }
    })

    // Contabilizar pasajeros asignados
    occupiedList.forEach(p => {
      const hName = String(p.hoteles || '').trim().toLowerCase()
      if (hName) {
        if (!stats[hName]) {
          stats[hName] = {
            nombre: p.hoteles,
            cuposTotales: 0,
            isOpen: true,
            ocupados: 0,
            disponibles: remainingInBloqueo
          }
        }
        stats[hName].ocupados += 1
        if (stats[hName].cuposTotales > 0) {
          stats[hName].disponibles = Math.max(0, stats[hName].cuposTotales - stats[hName].ocupados)
        } else {
          stats[hName].disponibles = remainingInBloqueo
        }
      }
    })

    return stats
  }, [configuredHoteles, pasajeros, bloqueo?.cupos_totales])

  // Plan de sincronización inteligente de importación de Excel (Evita duplicados)
  const excelImportPlan = useMemo(() => {
    if (!excelImportedData || !excelImportedData.passengers) return []
    const rawPaxList = excelImportedData.passengers

    if (excelImportMode === 'sync') {
      const allSlots = [...(pasajeros || [])]
      const usedSlotIds = new Set()
      const assignments = new Array(rawPaxList.length).fill(null)

      // PASO 1: Asignar cupos explícitos (# PAX / cupo real en Excel)
      rawPaxList.forEach((p, idx) => {
        if (p.has_explicit_cupo && p.numero_cupo) {
          const matchSlot = allSlots.find(s => s.numero_cupo === p.numero_cupo && !usedSlotIds.has(s.id))
          if (matchSlot) {
            usedSlotIds.add(matchSlot.id)
            const isUpdate = Boolean(matchSlot.nombres && String(matchSlot.nombres).trim() !== '' && matchSlot.nombres !== '-')
            const slotStoredFull = normalizePassengerName(`${matchSlot.nombres || ''} ${matchSlot.apellidos || ''}`)
            const slotStoredNombres = normalizePassengerName(matchSlot.nombres)
            const importedName = normalizePassengerName(p.nombres)
            const slotHasRealPax = Boolean(matchSlot.nombres && !matchSlot.nombres.includes('(POR ASIGNAR)') && matchSlot.nombres !== '-')
            const isSamePerson = !slotHasRealPax || p.is_unnamed_reservation || importedName === slotStoredFull || importedName === slotStoredNombres
            const isReplacement = isUpdate && !isSamePerson

            assignments[idx] = {
              passenger: p,
              targetSlot: matchSlot,
              isUpdate,
              isReplacement,
              cupoNumber: matchSlot.numero_cupo
            }
          }
        }
      })

      // PASO 2: Asignar por coincidencia de nombre o reserva de agencia
      rawPaxList.forEach((p, idx) => {
        if (assignments[idx]) return
        const targetName = normalizePassengerName(p.nombres)

        if (p.is_unnamed_reservation) {
          // Reconciliar reservas de agencia sin nombre con cupos de la misma agencia aún por asignar
          const agencyKey = normalizePassengerName(p.agencia)
          if (agencyKey) {
            const matchSlot = allSlots.find(s => {
              if (usedSlotIds.has(s.id)) return false
              const slotAgency = normalizePassengerName(s.agencia)
              const slotName = normalizePassengerName(s.nombres)
              return slotAgency === agencyKey && (!slotName || slotName.includes('(POR ASIGNAR)') || slotName === '-')
            })
            if (matchSlot) {
              usedSlotIds.add(matchSlot.id)
              const isUpdate = Boolean(matchSlot.nombres && String(matchSlot.nombres).trim() !== '' && matchSlot.nombres !== '-')
              assignments[idx] = {
                passenger: p,
                targetSlot: matchSlot,
                isUpdate,
                cupoNumber: matchSlot.numero_cupo
              }
            }
          }
        } else if (targetName && !targetName.includes('(POR ASIGNAR)')) {
          const importedAgency = (p.has_agency && p.agencia) ? normalizePassengerName(p.agencia) : null
          const isAgencyCompatible = (s) => {
            if (!importedAgency) return true
            const slotAgency = normalizePassengerName(s.agencia)
            return !slotAgency || slotAgency === 'DIRECTO' || slotAgency === importedAgency
          }
          const exactFullMatches = allSlots.filter(s => {
            if (usedSlotIds.has(s.id) || !isAgencyCompatible(s)) return false
            const storedFull = normalizePassengerName(`${s.nombres || ''} ${s.apellidos || ''}`)
            return storedFull === targetName
          })
          let matchSlot = exactFullMatches.length === 1 ? exactFullMatches[0] : null
          if (!matchSlot && exactFullMatches.length === 0) {
            const firstNameMatches = allSlots.filter(s => {
              if (usedSlotIds.has(s.id) || !isAgencyCompatible(s)) return false
              const storedNombres = normalizePassengerName(s.nombres)
              return storedNombres === targetName
            })
            if (firstNameMatches.length === 1) {
              matchSlot = firstNameMatches[0]
            }
          }
          if (matchSlot) {
            usedSlotIds.add(matchSlot.id)
            const isUpdate = Boolean(matchSlot.nombres && String(matchSlot.nombres).trim() !== '' && matchSlot.nombres !== '-')
            assignments[idx] = {
              passenger: p,
              targetSlot: matchSlot,
              isUpdate,
              cupoNumber: matchSlot.numero_cupo
            }
          }
        }
      })

      // PASO 2.5: Reconciliar pasajeros con nombre contra cupos por asignar de su misma agencia
      rawPaxList.forEach((p, idx) => {
        if (assignments[idx]) return
        const agencyKey = normalizePassengerName(p.agencia)
        if (agencyKey && agencyKey !== 'DIRECTO' && !p.is_unnamed_reservation) {
          const matchSlot = allSlots.find(s => {
            if (usedSlotIds.has(s.id)) return false
            const slotAgency = normalizePassengerName(s.agencia)
            const slotName = normalizePassengerName(s.nombres)
            return slotAgency === agencyKey && (!slotName || slotName.includes('(POR ASIGNAR)') || slotName === '-')
          })
          if (matchSlot) {
            usedSlotIds.add(matchSlot.id)
            const isUpdate = Boolean(matchSlot.nombres && String(matchSlot.nombres).trim() !== '' && matchSlot.nombres !== '-')
            assignments[idx] = {
              passenger: p,
              targetSlot: matchSlot,
              isUpdate,
              cupoNumber: matchSlot.numero_cupo
            }
          }
        }
      })

      // PASO 3: Asignar filas restantes a cupos libres disponibles
      rawPaxList.forEach((p, idx) => {
        if (assignments[idx]) return
        const matchSlot = allSlots.find(s => {
          if (usedSlotIds.has(s.id)) return false
          const name = String(s.nombres || '').trim()
          return !name || name === '-'
        })

        if (matchSlot) {
          usedSlotIds.add(matchSlot.id)
          const isUpdate = Boolean(matchSlot.nombres && String(matchSlot.nombres).trim() !== '' && matchSlot.nombres !== '-')
          assignments[idx] = {
            passenger: p,
            targetSlot: matchSlot,
            isUpdate,
            cupoNumber: matchSlot.numero_cupo
          }
        } else {
          assignments[idx] = {
            passenger: p,
            targetSlot: null,
            isUpdate: false,
            cupoNumber: p.has_explicit_cupo ? p.numero_cupo : (idx + 1)
          }
        }
      })

      return assignments
    } else {
      // Modo append: Asignar secuencialmente solo a cupos libres
      const availableSlots = (pasajeros || []).filter(p => !p || !p.nombres || String(p.nombres).trim() === '' || p.nombres === '-')
      return rawPaxList.map((p, idx) => {
        const targetSlot = availableSlots[idx] || null
        return {
          passenger: p,
          targetSlot,
          isUpdate: false,
          cupoNumber: targetSlot?.numero_cupo || 'Sin cupo'
        }
      })
    }
  }, [excelImportedData, excelImportMode, pasajeros])

  const handleSingleHotelSelect = (hotelName) => {
    if (hotelName === '__custom__') {
      setSingleForm(prev => ({ ...prev, hoteles: '' }))
      return
    }
    const hotelObj = configuredHoteles.find(h => h.nombre === hotelName)
    if (hotelObj) {
      const firstRoom = hotelObj.habitaciones?.[0]
      const newPrice = firstRoom?.precio ? Number(firstRoom.precio) : (Number(singleForm.precio_acordado) || Number(bloqueo?.precio_venta_pax) || 0)
      setSingleForm(prev => ({
        ...prev,
        hoteles: hotelObj.nombre,
        categoria_habitacion: hotelObj.categoria || prev.categoria_habitacion,
        tipo_habitacion: firstRoom?.tipo || prev.tipo_habitacion,
        precio_acordado: newPrice,
        plan_pagos: prev.plan_pagos.length === 1
          ? [{ ...prev.plan_pagos[0], monto: newPrice }]
          : prev.plan_pagos
      }))
    } else {
      setSingleForm(prev => ({ ...prev, hoteles: hotelName }))
    }
  }

  const handleSingleRoomSelect = (roomType) => {
    const roomObj = availableSingleRooms.find(r => r.tipo === roomType)
    const roomPrice = roomObj?.precio ? Number(roomObj.precio) : null
    setSingleForm(prev => {
      const updatedPrice = roomPrice !== null ? roomPrice : prev.precio_acordado
      return {
        ...prev,
        tipo_habitacion: roomType,
        precio_acordado: updatedPrice,
        plan_pagos: (roomPrice !== null && prev.plan_pagos.length === 1)
          ? [{ ...prev.plan_pagos[0], monto: updatedPrice }]
          : prev.plan_pagos
      }
    })
  }

  const handleGroupHotelSelect = (hotelName) => {
    if (hotelName === '__custom__') {
      setGroupForm(prev => ({ ...prev, hoteles: '' }))
      return
    }
    const hotelObj = configuredHoteles.find(h => h.nombre === hotelName)
    if (hotelObj) {
      const firstRoom = hotelObj.habitaciones?.[0]
      const baseRate = firstRoom?.precio ? Number(firstRoom.precio) : (Number(groupForm.precio_por_pax) || Number(bloqueo?.precio_venta_pax) || 0)
      setGroupForm(prev => ({
        ...prev,
        hoteles: hotelObj.nombre,
        categoria_habitacion: hotelObj.categoria || prev.categoria_habitacion,
        precio_por_pax: baseRate,
        pasajeros_lista: prev.pasajeros_lista.map(p => ({
          ...p,
          tipo_habitacion: firstRoom?.tipo || p.tipo_habitacion,
          categoria_habitacion: hotelObj.categoria || p.categoria_habitacion
        }))
      }))
    } else {
      setGroupForm(prev => ({ ...prev, hoteles: hotelName }))
    }
  }

  // Open Single Slot Modal
  const handleOpenSingleSlot = (slot) => {
    setSelectedSlotNumber(slot.numero_cupo)
    setSinglePasteText('')
    setSinglePasteDetectedInfo('')
    const initialPlan = getSlotInstallments(slot)

    setSingleForm({
      slot_id: slot.id,
      numero_cupo: slot.numero_cupo,
      codigo_cotizacion: slot.codigo_cotizacion || `CTB-BLQ-${Date.now().toString().slice(-4)}`,
      agencia: slot.agencia || '',
      ciudad: slot.ciudad || profile?.ciudad || 'GYE',
      tipo_servicio: slot.tipo_servicio || 'PAQUETE COMPLETO',
      operativo_id: slot.operativo_id || user?.id || '',
      operativo_nombre: slot.operativo_nombre || profile?.nombre || '',
      comercial_id: slot.comercial_id || '',
      comercial_nombre: slot.comercial_nombre || '',
      hoteles: slot.hoteles || (bloqueo?.hoteles?.[0]?.nombre || ''),
      nombres: slot.nombres || '',
      apellidos: slot.apellidos || '',
      tipo_documento: slot.tipo_documento || 'Cédula',
      numero_documento: slot.numero_documento || '',
      fecha_nacimiento: slot.fecha_nacimiento || '',
      caducidad_pasaporte: slot.caducidad_pasaporte || '',
      nacionalidad: slot.nacionalidad || 'ECUATORIANA',
      genero: slot.genero || 'M',
      tipo_habitacion: slot.tipo_habitacion || 'Doble',
      categoria_habitacion: slot.categoria_habitacion || 'Clase 2 (Estándar / 4★)',
      requerimientos_especiales: slot.requerimientos_especiales || '',
      precio_acordado: slot.precio_acordado || bloqueo?.precio_venta_pax || 0,
      plan_pagos: initialPlan,
      fecha_limite_pago_agencia: slot.fecha_limite_pago_agencia || '',
      observaciones: String(slot.observaciones || '').replace(/^\[.*?\]\s*/, '')
    })
    setShowSingleModal(true)
  }

  // Open Group Modal
  const handleOpenGroupModal = () => {
    const availableSlots = (pasajeros || []).filter(p => !p.nombres || String(p.nombres).trim() === '')
    if (availableSlots.length === 0) {
      showToast('No hay cupos disponibles para crear un grupo.', 'error')
      return
    }

    setGroupForm({
      grupo_nombre: '',
      agencia: '',
      ciudad: profile?.ciudad || 'GYE',
      tipo_servicio: 'PAQUETE COMPLETO',
      operativo_id: user?.id || '',
      operativo_nombre: profile?.nombre || '',
      comercial_id: '',
      comercial_nombre: '',
      hoteles: bloqueo?.hoteles?.[0]?.nombre || '',
      codigo_cotizacion: `CTB-BLQ-${Date.now().toString().slice(-4)}`,
      precio_por_pax: bloqueo?.precio_venta_pax || 0,
      categoria_habitacion: 'Clase 2 (Estándar / 4★)',
      pasajeros_lista: [
        { id: '1', nombres: '', apellidos: '', tipo_documento: 'Cédula', numero_documento: '', tipo_habitacion: 'Doble', categoria_habitacion: 'Clase 2 (Estándar / 4★)' },
        { id: '2', nombres: '', apellidos: '', tipo_documento: 'Cédula', numero_documento: '', tipo_habitacion: 'Doble', categoria_habitacion: 'Clase 2 (Estándar / 4★)' }
      ],
      plan_pagos: [
        { id: '1', numero: 1, label: 'Abono 1 (Reserva)', monto: (bloqueo?.precio_venta_pax || 0) * 0.3 * 2, fecha: '', estado: 'pagado', nota: '' }
      ],
      fecha_limite_pago_agencia: '',
      observaciones: ''
    })
    setShowGroupModal(true)
  }

  // Dynamic Installment Handlers (Single Form)
  const addSingleInstallment = () => {
    setSingleForm(prev => {
      const nextNum = prev.plan_pagos.length + 1
      return {
        ...prev,
        plan_pagos: [
          ...prev.plan_pagos,
          {
            id: Date.now().toString(),
            numero: nextNum,
            label: `Abono ${nextNum}`,
            monto: 0,
            fecha: '',
            estado: 'pendiente',
            nota: ''
          }
        ]
      }
    })
  }

  const removeSingleInstallment = (id) => {
    setSingleForm(prev => ({
      ...prev,
      plan_pagos: prev.plan_pagos.filter(p => p.id !== id)
    }))
  }

  const updateSingleInstallment = (id, field, value) => {
    setSingleForm(prev => ({
      ...prev,
      plan_pagos: prev.plan_pagos.map(item => item.id === id ? { ...item, [field]: value } : item)
    }))
  }

  // Dynamic Installment Handlers (Group Form)
  const addGroupInstallment = () => {
    setGroupForm(prev => {
      const nextNum = prev.plan_pagos.length + 1
      return {
        ...prev,
        plan_pagos: [
          ...prev.plan_pagos,
          {
            id: Date.now().toString(),
            numero: nextNum,
            label: `Abono ${nextNum}`,
            monto: 0,
            fecha: '',
            estado: 'pendiente',
            nota: ''
          }
        ]
      }
    })
  }

  const removeGroupInstallment = (id) => {
    setGroupForm(prev => ({
      ...prev,
      plan_pagos: prev.plan_pagos.filter(p => p.id !== id)
    }))
  }

  const updateGroupInstallment = (id, field, value) => {
    setGroupForm(prev => ({
      ...prev,
      plan_pagos: prev.plan_pagos.map(item => item.id === id ? { ...item, [field]: value } : item)
    }))
  }

  // Dynamic Passenger List in Group Form
  const addGroupPassenger = () => {
    const availableCount = metrics.disponibles
    if (groupForm.pasajeros_lista.length >= availableCount) {
      showToast(`Solo quedan ${availableCount} cupos disponibles en este bloqueo.`, 'error')
      return
    }
    setGroupForm(prev => ({
      ...prev,
      pasajeros_lista: [
        ...prev.pasajeros_lista,
        {
          id: Date.now().toString(),
          nombres: '',
          apellidos: '',
          tipo_documento: 'Cédula',
          numero_documento: '',
          tipo_habitacion: 'Doble',
          categoria_habitacion: prev.categoria_habitacion || 'Clase 2 (Estándar / 4★)'
        }
      ]
    }))
  }

  const removeGroupPassenger = (id) => {
    if (groupForm.pasajeros_lista.length <= 1) return
    setGroupForm(prev => ({
      ...prev,
      pasajeros_lista: prev.pasajeros_lista.filter(p => p.id !== id)
    }))
  }

  const updateGroupPassenger = (id, field, value) => {
    setGroupForm(prev => ({
      ...prev,
      pasajeros_lista: prev.pasajeros_lista.map(p => p.id === id ? { ...p, [field]: value } : p)
    }))
  }

  // Save Single Booking
  const handleSaveSingleBooking = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const opObj = operativosList.find(o => o.id === singleForm.operativo_id)
      const comObj = comercialesList.find(c => c.id === singleForm.comercial_id)
      const opNombre = opObj ? opObj.nombre : (singleForm.operativo_nombre || profile?.nombre || 'Operativo')
      const comNombre = comObj ? comObj.nombre : (singleForm.comercial_nombre || '')

      // Sync first 3 installments for backward compatibility and generated column
      const p1 = singleForm.plan_pagos[0] ? Number(singleForm.plan_pagos[0].monto) || 0 : 0
      const p2 = singleForm.plan_pagos[1] ? Number(singleForm.plan_pagos[1].monto) || 0 : 0
      const p3 = singleForm.plan_pagos[2] ? Number(singleForm.plan_pagos[2].monto) || 0 : 0

      const payload = {
        codigo_cotizacion: String(singleForm.codigo_cotizacion || '').trim() || null,
        agencia: String(singleForm.agencia || '').trim(),
        ciudad: singleForm.ciudad || 'GYE',
        tipo_servicio: singleForm.tipo_servicio || 'PAQUETE COMPLETO',
        operativo_id: singleForm.operativo_id || null,
        operativo_nombre: opNombre,
        comercial_id: singleForm.comercial_id || null,
        comercial_nombre: comNombre,
        hoteles: String(singleForm.hoteles || '').trim(),
        nombres: String(singleForm.nombres || '').trim(),
        apellidos: String(singleForm.apellidos || '').trim(),
        tipo_documento: singleForm.tipo_documento || 'Cédula',
        numero_documento: String(singleForm.numero_documento || '').trim(),
        fecha_nacimiento: singleForm.fecha_nacimiento || null,
        caducidad_pasaporte: singleForm.caducidad_pasaporte || null,
        nacionalidad: String(singleForm.nacionalidad || 'ECUATORIANA').trim(),
        genero: singleForm.genero || 'M',
        tipo_habitacion: singleForm.tipo_habitacion || 'Doble',
        categoria_habitacion: singleForm.categoria_habitacion || 'Clase 2 (Estándar / 4★)',
        requerimientos_especiales: String(singleForm.requerimientos_especiales || '').trim(),
        precio_acordado: Number(singleForm.precio_acordado) || Number(bloqueo?.precio_venta_pax) || 0,
        abono_1: p1,
        fecha_abono_1: singleForm.plan_pagos[0]?.fecha || null,
        abono_2: p2,
        fecha_abono_2: singleForm.plan_pagos[1]?.fecha || null,
        abono_3: p3,
        fecha_abono_3: singleForm.plan_pagos[2]?.fecha || null,
        fecha_limite_pago_agencia: singleForm.fecha_limite_pago_agencia || null,
        observaciones: String(singleForm.observaciones || '').trim()
      }

      // Try update with categoria_habitacion and plan_pagos
      const { error: updError } = await supabase
        .from('bloqueo_pasajeros')
        .update({ ...payload, plan_pagos: singleForm.plan_pagos })
        .eq('id', singleForm.slot_id)

      if (updError) {
        // Fallback without categoria_habitacion if column not added yet
        const { categoria_habitacion, ...cleanPayload } = payload
        const obsWithCat = singleForm.categoria_habitacion
          ? `[${singleForm.categoria_habitacion}] ${cleanPayload.observaciones || ''}`.trim()
          : cleanPayload.observaciones

        const { error: fallbackErr } = await supabase
          .from('bloqueo_pasajeros')
          .update({ ...cleanPayload, observaciones: obsWithCat, plan_pagos: singleForm.plan_pagos })
          .eq('id', singleForm.slot_id)

        if (fallbackErr) {
          const { plan_pagos, ...basicPayload } = cleanPayload
          await supabase.from('bloqueo_pasajeros').update({ ...basicPayload, observaciones: obsWithCat }).eq('id', singleForm.slot_id)
        }
      }

      // Notify Telegram if was empty
      const prevSlot = pasajeros.find(p => p.id === singleForm.slot_id)
      if (!prevSlot?.nombres && singleForm.nombres) {
        fetch('/api/notify/bloqueo-venta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bloqueoTitulo: bloqueo.titulo,
            bloqueoCodigo: bloqueo.codigo,
            destino: bloqueo.destino,
            fechaSalida: bloqueo.fecha_salida,
            cuposVendidos: 1,
            pasajerosNombres: `${singleForm.nombres} ${singleForm.apellidos}`.trim(),
            agencia: singleForm.agencia,
            ciudad: singleForm.ciudad,
            operativoNombre: opNombre,
            comercialNombre: comNombre,
            cuposRestantes: Math.max(0, metrics.disponibles - 1),
            cuposTotales: metrics.totalCupos,
            hoteles: singleForm.hoteles
          })
        }).catch(e => console.error('Telegram error:', e))
      }

      // Optimistic local state update (instant 0ms response)
      setPasajeros(prev => prev.map(p => {
        if (p.id === singleForm.slot_id) {
          const total = Number(singleForm.precio_acordado) || 0
          const totalAbonado = (singleForm.plan_pagos || []).filter(item => item.estado === 'pagado').reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
          return {
            ...p,
            ...payload,
            plan_pagos: singleForm.plan_pagos,
            faltante: Math.max(0, total - totalAbonado)
          }
        }
        return p
      }))

      showToast(`Cupo #${singleForm.numero_cupo} guardado con éxito.`, 'success')
      setShowSingleModal(false)
    } catch (err) {
      console.error('Error saving single slot:', err)
      showToast('Error al guardar cupo: ' + err.message, 'error')
      fetchBloqueoData(false)
    } finally {
      setSaving(false)
    }
  }

  // Save Group Booking (Nombre por Nombre)
  const handleSaveGroupBooking = async (e) => {
    e.preventDefault()
    if (!groupForm.grupo_nombre.trim()) {
      showToast('Por favor asigna un nombre al grupo (ej. Tercera Edad Cuenca).', 'error')
      return
    }

    const paxList = groupForm.pasajeros_lista.filter(p => p && String(p.nombres || '').trim() !== '')
    if (paxList.length === 0) {
      showToast('Ingresa al menos el nombre de un pasajero para el grupo.', 'error')
      return
    }

    const availableSlots = (pasajeros || []).filter(p => !p || !p.nombres || String(p.nombres).trim() === '')
    if (availableSlots.length < paxList.length) {
      showToast(`Solo quedan ${availableSlots.length} cupos disponibles para asignar este grupo.`, 'error')
      return
    }

    setSaving(true)
    try {
      const opObj = operativosList.find(o => o.id === groupForm.operativo_id)
      const comObj = comercialesList.find(c => c.id === groupForm.comercial_id)
      const opNombre = opObj ? opObj.nombre : (groupForm.operativo_nombre || profile?.nombre || 'Operativo')
      const comNombre = comObj ? comObj.nombre : (groupForm.comercial_nombre || '')

      const groupUid = `GRP-${Date.now().toString().slice(-6)}`
      const groupName = groupForm.grupo_nombre.trim()
      const targetSlots = availableSlots.slice(0, paxList.length)

      // Total payments for lead pax
      const p1 = groupForm.plan_pagos[0] ? Number(groupForm.plan_pagos[0].monto) || 0 : 0
      const p2 = groupForm.plan_pagos[1] ? Number(groupForm.plan_pagos[1].monto) || 0 : 0
      const p3 = groupForm.plan_pagos[2] ? Number(groupForm.plan_pagos[2].monto) || 0 : 0

      const updateOps = targetSlots.map(async (slot, i) => {
        const paxData = paxList[i]
        const isLead = i === 0

        const payload = {
          grupo_id: groupUid,
          grupo_nombre: groupName,
          codigo_cotizacion: String(groupForm.codigo_cotizacion || '').trim() || null,
          agencia: String(groupForm.agencia || '').trim(),
          ciudad: groupForm.ciudad || 'GYE',
          tipo_servicio: groupForm.tipo_servicio || 'PAQUETE COMPLETO',
          operativo_id: groupForm.operativo_id || null,
          operativo_nombre: opNombre,
          comercial_id: groupForm.comercial_id || null,
          comercial_nombre: comNombre,
          hoteles: String(groupForm.hoteles || '').trim(),
          nombres: String(paxData.nombres || '').trim(),
          apellidos: String(paxData.apellidos || '').trim(),
          tipo_documento: paxData.tipo_documento || 'Cédula',
          numero_documento: String(paxData.numero_documento || '').trim(),
          tipo_habitacion: paxData.tipo_habitacion || 'Doble',
          categoria_habitacion: paxData.categoria_habitacion || groupForm.categoria_habitacion || 'Clase 2 (Estándar / 4★)',
          precio_acordado: Number(groupForm.precio_por_pax) || Number(bloqueo?.precio_venta_pax) || 0,
          abono_1: isLead ? p1 : 0,
          fecha_abono_1: isLead ? groupForm.plan_pagos[0]?.fecha || null : null,
          abono_2: isLead ? p2 : 0,
          fecha_abono_2: isLead ? groupForm.plan_pagos[1]?.fecha || null : null,
          abono_3: isLead ? p3 : 0,
          fecha_abono_3: isLead ? groupForm.plan_pagos[2]?.fecha || null : null,
          fecha_limite_pago_agencia: groupForm.fecha_limite_pago_agencia || null,
          observaciones: isLead
            ? `PAGO GRUPAL (${paxList.length} PAX). ${String(groupForm.observaciones || '').trim()}`
            : `Integrante de ${groupName}`
        }

        const { error: updErr } = await supabase
          .from('bloqueo_pasajeros')
          .update({ ...payload, plan_pagos: isLead ? groupForm.plan_pagos : [] })
          .eq('id', slot.id)

        if (updErr) {
          const { categoria_habitacion, ...cleanPayload } = payload
          const obsWithCat = (paxData.categoria_habitacion || groupForm.categoria_habitacion)
            ? `[${paxData.categoria_habitacion || groupForm.categoria_habitacion}] ${cleanPayload.observaciones || ''}`.trim()
            : cleanPayload.observaciones
          await supabase.from('bloqueo_pasajeros').update({ ...cleanPayload, observaciones: obsWithCat }).eq('id', slot.id)
        }

        return { slotId: slot.id, payload, isLead }
      })

      const completedSlots = await Promise.all(updateOps)

      // Optimistic instant state update (0ms delay)
      setPasajeros(prev => prev.map(slot => {
        const match = completedSlots.find(c => c.slotId === slot.id)
        if (match) {
          const total = Number(match.payload.precio_acordado) || 0
          const totalAbonos = match.isLead
            ? (groupForm.plan_pagos || []).filter(item => item.estado === 'pagado').reduce((acc, item) => acc + (Number(item.monto) || 0), 0)
            : 0
          return {
            ...slot,
            ...match.payload,
            plan_pagos: match.isLead ? groupForm.plan_pagos : [],
            faltante: Math.max(0, total - totalAbonos)
          }
        }
        return slot
      }))

      // Telegram notification
      fetch('/api/notify/bloqueo-venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloqueoTitulo: bloqueo.titulo,
          bloqueoCodigo: bloqueo.codigo,
          destino: bloqueo.destino,
          fechaSalida: bloqueo.fecha_salida,
          cuposVendidos: paxList.length,
          pasajerosNombres: `${groupName} (${paxList.map(p => `${p.nombres} ${p.apellidos}`.trim()).join(', ')})`,
          agencia: groupForm.agencia,
          ciudad: groupForm.ciudad,
          operativoNombre: opNombre,
          comercialNombre: comNombre,
          cuposRestantes: Math.max(0, metrics.disponibles - paxList.length),
          cuposTotales: metrics.totalCupos,
          hoteles: groupForm.hoteles
        })
      }).catch(e => console.error('Telegram notification error:', e))

      showToast(`¡Grupo "${groupName}" registrado con éxito con ${paxList.length} cupos!`, 'success')
      setShowGroupModal(false)
    } catch (err) {
      console.error('Error saving group:', err)
      showToast('Error al registrar grupo: ' + err.message, 'error')
      fetchBloqueoData(false)
    } finally {
      setSaving(false)
    }
  }

  // Group Selected Existing Passengers
  const handleGroupExisting = async (e) => {
    e.preventDefault()
    if (!existingGroupName.trim()) {
      showToast('Por favor escribe un nombre para el grupo.', 'error')
      return
    }

    try {
      const groupUid = `GRP-${Date.now().toString().slice(-6)}`
      const name = existingGroupName.trim()

      const { error } = await supabase
        .from('bloqueo_pasajeros')
        .update({
          grupo_id: groupUid,
          grupo_nombre: name
        })
        .in('id', selectedSlotIds)

      if (error) throw error

      // Optimistic instant grouping update
      setPasajeros(prev => prev.map(p => selectedSlotIds.includes(p.id) ? { ...p, grupo_id: groupUid, grupo_nombre: name } : p))
      showToast(`¡${selectedSlotIds.length} pasajeros asociados al grupo "${name}"!`, 'success')
      setSelectedSlotIds([])
      setExistingGroupName('')
      setShowGroupExistingModal(false)
      fetchBloqueoData(false)
    } catch (err) {
      console.error('Error grouping passengers:', err)
      showToast('Error al agrupar pasajeros.', 'error')
    }
  }

  // Marcar pagos al 100% masivamente para los cupos seleccionados
  const handleBatchMarkPaid = async () => {
    if (selectedSlotIds.length === 0) return
    const count = selectedSlotIds.length
    if (!confirm(`¿Marcar liquidación de pago al 100% para los ${count} pasajeros seleccionados?`)) return
    setSaving(true)
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      const selectedSlots = (pasajeros || []).filter(p => selectedSlotIds.includes(p.id))

      const updates = selectedSlots.map(s => {
        const precio = Number(s.precio_acordado) || Number(bloqueo?.precio_venta_pax) || 0
        const fullPlan = [
          { id: '1', numero: 1, label: 'Pago Total 100%', monto: precio, fecha: todayStr, estado: 'pagado', nota: 'Liquidación en bloque' }
        ]
        return supabase
          .from('bloqueo_pasajeros')
          .update({
            abono_1: precio,
            fecha_abono_1: todayStr,
            abono_2: 0,
            fecha_abono_2: null,
            abono_3: 0,
            fecha_abono_3: null,
            plan_pagos: fullPlan,
            estado_pago: 'pagado_total'
          })
          .eq('id', s.id)
      })

      await Promise.all(updates)

      setPasajeros(prev => prev.map(p => {
        if (!selectedSlotIds.includes(p.id)) return p
        const precio = Number(p.precio_acordado) || Number(bloqueo?.precio_venta_pax) || 0
        return {
          ...p,
          abono_1: precio,
          fecha_abono_1: todayStr,
          abono_2: 0,
          abono_3: 0,
          plan_pagos: [{ id: '1', numero: 1, label: 'Pago Total 100%', monto: precio, fecha: todayStr, estado: 'pagado', nota: 'Liquidación en bloque' }],
          estado_pago: 'pagado_total',
          faltante: 0
        }
      }))

      showToast(`¡${count} cupos marcados como pagados al 100%!`, 'success')
      setSelectedSlotIds([])
    } catch (err) {
      console.error('Error batch marking paid:', err)
      showToast('Error al actualizar pagos: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Asignar hotel masivamente a los cupos seleccionados
  const handleBatchAssignHotel = async (e) => {
    e.preventDefault()
    if (selectedSlotIds.length === 0) return
    if (!batchHotelForm.hotel.trim()) {
      showToast('Por favor selecciona o escribe el nombre del hotel.', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        hoteles: batchHotelForm.hotel.trim(),
        tipo_habitacion: batchHotelForm.tipo_habitacion || 'Doble',
        categoria_habitacion: batchHotelForm.categoria_habitacion || 'Clase 2 (Estándar / 4★)'
      }

      const updates = selectedSlotIds.map(slotId => {
        return supabase
          .from('bloqueo_pasajeros')
          .update(payload)
          .eq('id', slotId)
      })

      await Promise.all(updates)

      setPasajeros(prev => prev.map(p => selectedSlotIds.includes(p.id) ? { ...p, ...payload } : p))
      showToast(`¡Hotel y acomodación asignados a ${selectedSlotIds.length} pasajeros!`, 'success')
      setSelectedSlotIds([])
      setShowBatchHotelModal(false)
    } catch (err) {
      console.error('Error in batch hotel assign:', err)
      showToast('Error al asignar hotel: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Copiar nombres de pasajeros seleccionados
  const handleCopySelectedNames = () => {
    const selected = (pasajeros || []).filter(p => selectedSlotIds.includes(p.id) && p.nombres && p.nombres.trim() !== '')
    if (selected.length === 0) {
      showToast('No hay nombres registrados en los cupos seleccionados.', 'error')
      return
    }
    const text = selected.map((p, i) => `${i + 1}. ${p.nombres} ${p.apellidos || ''} — ${p.tipo_documento || 'Doc'}: ${p.numero_documento || 'S/N'}${p.tipo_habitacion ? ` (Hab. ${p.tipo_habitacion})` : ''}`).join('\n')
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`¡${selected.length} nombres copiados al portapapeles!`, 'success')
      })
    }
  }

  // Comprobante de Reserva por WhatsApp para la Agencia
  const handleSharePassengerWhatsApp = (slot) => {
    if (!slot || !slot.nombres) return
    const plan = getSlotInstallments(slot)
    const precio = Number(slot.precio_acordado) || Number(bloqueo?.precio_venta_pax) || 0
    let totalPagado = 0
    if (Array.isArray(plan) && plan.length > 0) {
      totalPagado = plan.filter(item => item && item.estado === 'pagado').reduce((acc, item) => acc + (Number(item?.monto) || 0), 0)
    } else {
      totalPagado = (Number(slot.abono_1) || 0) + (Number(slot.abono_2) || 0) + (Number(slot.abono_3) || 0)
    }
    const faltante = Math.max(0, precio - totalPagado)

    const text = `✈️ *CONFIRMACIÓN DE RESERVA — CTB VIAJANDO MAYORISTA* 🌴
📋 *Bloqueo:* ${bloqueo?.titulo?.toUpperCase() || ''} (${bloqueo?.codigo || ''})
📍 *Destino:* ${bloqueo?.destino || ''} | *Salida:* ${bloqueo?.fecha_salida || 'Por definir'}
──────────────────────────
👤 *Pasajero:* ${slot.nombres} ${slot.apellidos || ''}
📄 *Documento:* ${slot.tipo_documento || 'Cédula'}: ${slot.numero_documento || 'Por registrar'}
🏢 *Agencia:* ${slot.agencia || 'Directo'}${slot.ciudad ? ` (${slot.ciudad})` : ''}
${slot.grupo_nombre ? `👥 *Grupo:* ${slot.grupo_nombre}\n` : ''}🏨 *Hotel:* ${slot.hoteles || 'Estándar'}
🛏️ *Acomodación:* Habitación ${slot.tipo_habitacion || 'Doble'} (${slot.categoria_habitacion || 'Clase 2 - 4★'})
──────────────────────────
💵 *Tarifa Acordada:* *$${precio.toLocaleString('es-EC')} USD*
✅ *Abono Registrado:* *$${totalPagado.toLocaleString('es-EC')} USD*
⏳ *Saldo Pendiente:* *$${faltante.toLocaleString('es-EC')} USD*
${slot.fecha_limite_pago_agencia ? `📅 *Fecha Límite Pago Agencia:* ${slot.fecha_limite_pago_agencia}\n` : ''}──────────────────────────
🧑‍💼 *Ejecutivo Operativo:* ${slot.operativo_nombre || 'CTB Operaciones'}
📲 *CTB Viajando Mayorista de Turismo.* ¡Gracias por tu confianza!`

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('¡Comprobante copiado al portapapeles!', 'success')
      })
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
  }

  // Generador de Manifiesto Aéreo GDS (Amadeus, Sabre, Web)
  const gdsManifestData = useMemo(() => {
    const occupied = (pasajeros || []).filter(p => p && String(p.nombres || '').trim() !== '')
    if (occupied.length === 0) return { amadeus: '', web: '', simple: '', totalPax: 0 }

    const amadeus = occupied.map((p, i) => {
      const cleanNom = String(p.nombres || '').trim().replace(/[^a-zA-Z\s]/g, '').toUpperCase()
      const cleanApe = String(p.apellidos || '').trim().replace(/[^a-zA-Z\s]/g, '').toUpperCase()
      const title = p.genero === 'F' ? 'MS' : 'MR'
      const doc = p.numero_documento ? ` - P:${p.numero_documento}` : ''
      const dob = p.fecha_nacimiento ? ` - DOB:${p.fecha_nacimiento.replace(/-/g, '')}` : ''
      return `${i + 1}.${cleanApe}/${cleanNom} ${title}${doc}${dob}`
    }).join('\n')

    const webHeaders = "ORDEN\tNOMBRES\tAPELLIDOS\tTIPO_DOC\tNUMERO_DOC\tFECHA_NAC\tNACIONALIDAD\tGENERO\tHABITACION\tHOTEL"
    const webRows = occupied.map((p, i) => {
      return `${i + 1}\t${p.nombres}\t${p.apellidos || ''}\t${p.tipo_documento || 'Cédula'}\t${p.numero_documento || ''}\t${p.fecha_nacimiento || ''}\t${p.nacionalidad || 'ECUATORIANA'}\t${p.genero || 'M'}\t${p.tipo_habitacion || 'Doble'}\t${p.hoteles || ''}`
    }).join('\n')

    const simpleRows = occupied.map((p, i) => {
      const doc = p.numero_documento ? ` · ${p.tipo_documento}: ${p.numero_documento}` : ''
      const hab = p.tipo_habitacion ? ` · Hab. ${p.tipo_habitacion}` : ''
      return `${i + 1}. ${p.nombres} ${p.apellidos || ''}${doc}${hab}`
    }).join('\n')
    const simple = `✈️ MANIFIESTO AÉREO — ${bloqueo?.titulo?.toUpperCase() || ''} (${bloqueo?.codigo || ''})\n📍 Destino: ${bloqueo?.destino || ''} | Salida: ${bloqueo?.fecha_salida || ''}\nTotal Pasajeros: ${occupied.length} PAX\n\n${simpleRows}`

    return {
      amadeus,
      web: `${webHeaders}\n${webRows}`,
      simple,
      totalPax: occupied.length
    }
  }, [pasajeros, bloqueo])

  // Toggle Slot Selection
  const toggleSelectSlot = (id) => {
    setSelectedSlotIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      return [...prev, id]
    })
  }

  // Select all filtered occupied slots
  const selectAllOccupied = () => {
    const occupiedIds = filteredSlots.filter(p => p && String(p.nombres || '').trim() !== '').map(p => p.id)
    if (selectedSlotIds.length === occupiedIds.length) {
      setSelectedSlotIds([])
    } else {
      setSelectedSlotIds(occupiedIds)
    }
  }

  // Release/Clear Slot
  const handleReleaseSlot = async (slot) => {
    if (!confirm(`¿Estás seguro de liberar el Cupo #${slot.numero_cupo} (${slot.nombres || 'Sin nombre'})? Esta acción borrará los datos del pasajero.`)) {
      return
    }

    try {
      const resetPayload = {
        grupo_id: null,
        grupo_nombre: null,
        codigo_cotizacion: null,
        agencia: null,
        ciudad: null,
        tipo_servicio: 'PAQUETE COMPLETO',
        operativo_id: null,
        operativo_nombre: null,
        comercial_id: null,
        comercial_nombre: null,
        hoteles: null,
        nombres: '',
        apellidos: null,
        numero_documento: null,
        fecha_nacimiento: null,
        caducidad_pasaporte: null,
        tipo_habitacion: 'Doble',
        categoria_habitacion: 'Clase 2 (Estándar / 4★)',
        precio_acordado: bloqueo?.precio_venta_pax || 0,
        abono_1: 0,
        fecha_abono_1: null,
        abono_2: 0,
        fecha_abono_2: null,
        abono_3: 0,
        fecha_abono_3: null,
        plan_pagos: [],
        fecha_limite_pago_agencia: null,
        observaciones: null,
        estado_pago: 'pendiente'
      }

      const { error } = await supabase
        .from('bloqueo_pasajeros')
        .update(resetPayload)
        .eq('id', slot.id)

      if (error) throw error

      // Optimistic instant release
      setPasajeros(prev => prev.map(p => p.id === slot.id ? { ...p, ...resetPayload, faltante: 0 } : p))
      showToast(`Cupo #${slot.numero_cupo} liberado.`, 'success')
    } catch (err) {
      console.error('Error releasing slot:', err)
      showToast('Error al liberar cupo.', 'error')
    }
  }

  // Permissions: Admin/Superadmin can edit anything. Operatives and Commercials can edit their assigned slots and empty ones.
  const canEditSlot = (slot) => {
    if (isPrivileged) return true
    if (!slot || !slot.nombres || String(slot.nombres).trim() === '') return true
    if (slot.operativo_id === user?.id) return true
    if (slot.comercial_id === user?.id) return true
    if (profile?.nombre && (slot.operativo_nombre === profile.nombre || slot.comercial_nombre === profile.nombre)) return true
    return true // Operatives and commercials can edit their passengers and support colleagues
  }

  // Data Readiness / Semáforo de Documentación
  const getDataReadiness = (slot) => {
    if (!slot) return { status: 'libre', label: 'Disponible', color: 'bg-gray-100 text-gray-500 border-gray-200' }
    const nombres = String(slot.nombres || '').trim()
    if (!nombres) {
      return { status: 'libre', label: 'Disponible', color: 'bg-gray-100 text-gray-500 border-gray-200' }
    }
    const doc = String(slot.numero_documento || '').trim()
    const hasDoc = Boolean(doc !== '')
    const hasRoom = Boolean(slot.tipo_habitacion)
    const hasBirth = Boolean(slot.fecha_nacimiento)

    if (hasDoc && hasRoom && hasBirth) {
      return { status: 'completo', label: '🟢 100% Listo', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    }
    if (hasDoc && hasRoom) {
      return { status: 'casi_listo', label: '🟢 Doc y Rooming', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    }
    return { status: 'pendiente', label: '🟡 Docs Pendientes', color: 'bg-amber-50 text-amber-800 border-amber-200' }
  }

  // 6-Month Passport Expiration Check (IATA rule)
  const isPassportExpiringSoon = useMemo(() => {
    if (singleForm.tipo_documento !== 'Pasaporte' || !singleForm.caducidad_pasaporte || !bloqueo?.fecha_salida) {
      return false
    }
    try {
      const expDate = parseISO(singleForm.caducidad_pasaporte)
      const departureDate = parseISO(bloqueo.fecha_salida)
      const daysDiff = differenceInDays(expDate, departureDate)
      return daysDiff < 180
    } catch {
      return false
    }
  }, [singleForm.tipo_documento, singleForm.caducidad_pasaporte, bloqueo?.fecha_salida])

  // Quick Paste Parser (WhatsApp / Excel bulk upload)
  const parseQuickPaste = (text) => {
    if (!text) return []
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const results = []

    lines.forEach((line, idx) => {
      if (line.includes('\t')) {
        const parts = line.split('\t').map(p => p.trim())
        const name = parts[0] || `Pasajero ${idx + 1}`
        const surname = parts[1] || ''
        const doc = parts[2] || ''
        const room = parts[3] || 'Doble'
        const cat = parts[4] || quickPasteMeta.categoria_habitacion || 'Clase 2 (Estándar / 4★)'
        results.push({
          id: (idx + 1).toString(),
          nombres: name.toUpperCase(),
          apellidos: surname.toUpperCase(),
          tipo_documento: doc.length === 10 && /^\d+$/.test(doc) ? 'Cédula' : 'Pasaporte',
          numero_documento: doc,
          tipo_habitacion: room,
          categoria_habitacion: cat
        })
        return
      }

      let clean = line.replace(/^\d+[\.\-\)]\s*/, '').trim()

      let cat = quickPasteMeta.categoria_habitacion || 'Clase 2 (Estándar / 4★)'
      if (/clase\s*1/i.test(clean)) cat = 'Clase 1 (Económica / 3★)'
      else if (/clase\s*2/i.test(clean)) cat = 'Clase 2 (Estándar / 4★)'
      else if (/clase\s*3/i.test(clean)) cat = 'Clase 3 (Superior / 5★)'
      else if (/vip|luxury/i.test(clean)) cat = 'Clase VIP / Luxury'

      let room = 'Doble'
      if (/simple|sgl/i.test(clean)) room = 'Simple'
      else if (/triple|tpl/i.test(clean)) room = 'Triple'
      else if (/matrimonial|mat/i.test(clean)) room = 'Matrimonial'
      else if (/cuadruple|cpl/i.test(clean)) room = 'Cuádruple'
      else if (/twin|twn/i.test(clean)) room = 'Twin'

      const docMatch = clean.match(/\b\d{10}\b/) || clean.match(/\b[A-Za-z]\d{7,9}\b/)
      const doc = docMatch ? docMatch[0] : ''

      clean = clean
        .replace(/\b\d{10}\b/, '')
        .replace(/\b[A-Za-z]\d{7,9}\b/, '')
        .replace(/\b(cedula|cédula|pasaporte|dni|ruc|pax|hab|habitación|habitacion)\b/gi, '')
        .replace(/clase\s*[123]|vip|luxury/gi, '')
        .replace(/simple|sgl|doble|dbl|triple|tpl|matrimonial|mat|cuadruple|twin|twn/gi, '')
        .replace(/[-–—,:;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const nameParts = clean.split(' ').filter(Boolean)
      let nombres = ''
      let apellidos = ''
      if (nameParts.length >= 4) {
        nombres = nameParts.slice(0, 2).join(' ')
        apellidos = nameParts.slice(2).join(' ')
      } else if (nameParts.length >= 2) {
        nombres = nameParts[0]
        apellidos = nameParts.slice(1).join(' ')
      } else {
        nombres = clean || `Pasajero ${idx + 1}`
      }

      results.push({
        id: (idx + 1).toString(),
        nombres: nombres.toUpperCase(),
        apellidos: apellidos.toUpperCase(),
        tipo_documento: doc.length === 10 && /^\d+$/.test(doc) ? 'Cédula' : 'Pasaporte',
        numero_documento: doc,
        tipo_habitacion: room,
        categoria_habitacion: cat
      })
    })

    return results
  }

  // Memoized parsed list for instant typing without running regex loops 4x per keystroke
  const parsedQuickPasteList = useMemo(() => {
    return parseQuickPaste(quickPasteText)
  }, [quickPasteText, quickPasteMeta.categoria_habitacion])

  const handleSaveQuickPaste = async (e) => {
    e.preventDefault()
    const parsed = parsedQuickPasteList
    if (parsed.length === 0) {
      showToast('No se detectaron pasajeros en el texto ingresado.', 'error')
      return
    }

    const availableSlots = (pasajeros || []).filter(p => !p || !p.nombres || String(p.nombres).trim() === '')
    if (availableSlots.length < parsed.length) {
      showToast(`Solo quedan ${availableSlots.length} cupos disponibles para asignar los ${parsed.length} pasajeros.`, 'error')
      return
    }

    setSaving(true)
    try {
      const opObj = operativosList.find(o => o.id === quickPasteMeta.operativo_id)
      const comObj = comercialesList.find(c => c.id === quickPasteMeta.comercial_id)
      const opNombre = opObj ? opObj.nombre : (profile?.nombre || 'Operativo')
      const comNombre = comObj ? comObj.nombre : ''

      const targetSlots = availableSlots.slice(0, parsed.length)
      const updateOps = targetSlots.map(async (slot, i) => {
        const p = parsed[i]
        const payload = {
          agencia: quickPasteMeta.agencia.trim() || 'Directo',
          ciudad: quickPasteMeta.ciudad,
          tipo_servicio: quickPasteMeta.tipo_servicio,
          operativo_id: quickPasteMeta.operativo_id || user?.id || null,
          operativo_nombre: opNombre,
          comercial_id: quickPasteMeta.comercial_id || null,
          comercial_nombre: comNombre,
          hoteles: quickPasteMeta.hoteles,
          nombres: p.nombres,
          apellidos: p.apellidos,
          tipo_documento: p.tipo_documento,
          numero_documento: p.numero_documento,
          tipo_habitacion: p.tipo_habitacion,
          categoria_habitacion: p.categoria_habitacion,
          precio_acordado: Number(bloqueo?.precio_venta_pax || 0),
          estado_pago: 'pendiente'
        }

        const { error: updErr } = await supabase
          .from('bloqueo_pasajeros')
          .update(payload)
          .eq('id', slot.id)

        if (updErr) {
          const { categoria_habitacion, ...cleanPayload } = payload
          await supabase
            .from('bloqueo_pasajeros')
            .update({ ...cleanPayload, observaciones: `[${p.categoria_habitacion}]` })
            .eq('id', slot.id)
        }

        return { slotId: slot.id, payload }
      })

      const completed = await Promise.all(updateOps)

      // Instant optimistic state update
      setPasajeros(prev => prev.map(s => {
        const match = completed.find(c => c.slotId === s.id)
        return match ? { ...s, ...match.payload, faltante: match.payload.precio_acordado } : s
      }))

      // Notify Telegram on quick paste bulk assignment
      fetch('/api/notify/bloqueo-venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloqueoTitulo: bloqueo.titulo,
          bloqueoCodigo: bloqueo.codigo,
          destino: bloqueo.destino,
          fechaSalida: bloqueo.fecha_salida,
          cuposVendidos: parsed.length,
          pasajerosNombres: `${quickPasteMeta.agencia || 'Carga Rápida'} (${parsed.map(p => `${p.nombres} ${p.apellidos}`.trim()).slice(0, 5).join(', ')}${parsed.length > 5 ? '...' : ''})`,
          agencia: quickPasteMeta.agencia || 'Directo',
          ciudad: quickPasteMeta.ciudad,
          operativoNombre: opNombre,
          comercialNombre: comNombre,
          cuposRestantes: Math.max(0, metrics.disponibles - parsed.length),
          cuposTotales: metrics.totalCupos,
          hoteles: quickPasteMeta.hoteles
        })
      }).catch(e => console.error('Telegram notification error:', e))

      showToast(`¡${parsed.length} pasajeros asignados exitosamente con carga rápida!`, 'success')
      setShowQuickPasteModal(false)
      setQuickPasteText('')
      fetchBloqueoData(false)
    } catch (err) {
      console.error('Error saving quick paste:', err)
      showToast('Error al procesar carga rápida: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Autocompletar formulario individual desde fila de Excel o texto copiado
  const handleInterpretSinglePaste = () => {
    if (!singlePasteText || !singlePasteText.trim()) {
      showToast('Pega una fila de Excel o texto con datos del pasajero primero.', 'error')
      return
    }

    const detected = parseSinglePassengerInput(singlePasteText, {
      operativosList,
      comercialesList,
      configuredHoteles
    })

    if (!detected || detected.detectedFields.length === 0) {
      showToast('No se pudieron reconocer datos válidos en el texto ingresado.', 'error')
      return
    }

    setSingleForm(prev => {
      const updated = { ...prev }

      if (detected.nombres) updated.nombres = detected.nombres
      if (detected.apellidos) updated.apellidos = detected.apellidos
      if (detected.numero_documento) {
        updated.numero_documento = detected.numero_documento
        updated.tipo_documento = detected.tipo_documento || 'Cédula'
      }
      if (detected.agencia) updated.agencia = detected.agencia
      if (detected.ciudad) updated.ciudad = detected.ciudad
      if (detected.tipo_habitacion) updated.tipo_habitacion = detected.tipo_habitacion
      if (detected.hoteles) updated.hoteles = detected.hoteles
      if (detected.operativo_id) {
        updated.operativo_id = detected.operativo_id
        updated.operativo_nombre = detected.operativo_nombre
      }
      if (detected.comercial_id) {
        updated.comercial_id = detected.comercial_id
        updated.comercial_nombre = detected.comercial_nombre
      }
      if (detected.observaciones) {
        updated.observaciones = prev.observaciones
          ? `${prev.observaciones} | ${detected.observaciones}`
          : detected.observaciones
      }

      // Si detectó abonos, agregarlos al plan de pagos
      if (detected.abonos && detected.abonos.length > 0) {
        const today = format(new Date(), 'yyyy-MM-dd')
        const existingPlan = Array.isArray(prev.plan_pagos) && prev.plan_pagos.length > 0
          ? [...prev.plan_pagos]
          : []

        detected.abonos.forEach((monto, idx) => {
          if (existingPlan[idx]) {
            existingPlan[idx] = {
              ...existingPlan[idx],
              monto,
              estado: 'pagado',
              fecha: existingPlan[idx].fecha || today
            }
          } else {
            existingPlan.push({
              id: String(idx + 1),
              numero: idx + 1,
              label: `Abono ${idx + 1}`,
              monto,
              fecha: today,
              estado: 'pagado'
            })
          }
        })
        updated.plan_pagos = existingPlan
      }

      return updated
    })

    const fieldsLabels = {
      nombres: 'Nombre',
      documento: 'Cédula/Doc',
      agencia: 'Agencia',
      ciudad: 'Ciudad',
      tipo_habitacion: 'Habitación',
      hoteles: 'Hotel',
      operativo: 'Operativo',
      comercial: 'Comercial',
      abono: 'Abono(s)',
      observaciones: 'Notas'
    }
    const detectedNames = Array.from(new Set(detected.detectedFields.map(f => fieldsLabels[f] || f)))
    setSinglePasteDetectedInfo(`¡Datos aplicados con éxito! Se detectó: ${detectedNames.join(', ')}.`)
    showToast(`¡Se interpretaron ${detectedNames.length} campos desde Excel!`, 'success')
  }

  // Parsear texto para importación masiva de bloqueo
  const handleParseExcelText = () => {
    if (!excelImportRawText || !excelImportRawText.trim()) {
      showToast('Pega las celdas o filas de Excel antes de procesar.', 'error')
      return
    }
    setIsParsingExcelImport(true)
    try {
      const parsed = parseBloqueoText(excelImportRawText)
      if (!parsed || parsed.passengers.length === 0) {
        showToast('No se detectaron filas válidas de pasajeros en el texto pegado.', 'error')
        setExcelImportedData(null)
      } else {
        setExcelImportedData(parsed)
        showToast(`¡${parsed.passengers.length} pasajeros reconocidos con éxito!`, 'success')
      }
    } catch (err) {
      console.error('Error parseando texto Excel:', err)
      showToast('Error al procesar los datos: ' + err.message, 'error')
    } finally {
      setIsParsingExcelImport(false)
    }
  }

  // Subir y parsear archivo .xlsx o .csv
  const handleExcelFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsingExcelImport(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let parsed = null

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer()
        parsed = await parseBloqueoExcelBuffer(buffer)
      } else if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
        const text = await file.text()
        parsed = parseBloqueoText(text)
      } else {
        showToast('Formato no soportado. Sube un archivo .xlsx, .xls o .csv', 'error')
        setIsParsingExcelImport(false)
        return
      }

      if (!parsed || parsed.passengers.length === 0) {
        showToast('No se encontraron filas con pasajeros válidos en el archivo.', 'error')
        setExcelImportedData(null)
      } else {
        setExcelImportedData(parsed)
        showToast(`¡Archivo procesado! Se detectaron ${parsed.passengers.length} pasajeros.`, 'success')
      }
    } catch (err) {
      console.error('Error leyendo archivo:', err)
      showToast('Error al leer el archivo Excel: ' + err.message, 'error')
    } finally {
      setIsParsingExcelImport(false)
    }
  }

  // Asignar o actualizar los pasajeros importados (Sincronización Inteligente sin duplicar)
  const handleApplyExcelImport = async () => {
    if (!excelImportPlan || excelImportPlan.length === 0) {
      showToast('No hay pasajeros válidos para procesar.', 'error')
      return
    }

    const validOps = excelImportPlan.filter(item => item.targetSlot)
    if (validOps.length === 0) {
      showToast('No hay cupos disponibles para procesar los pasajeros.', 'error')
      return
    }

    setSaving(true)
    try {
      // 1. Si el Excel trae hoteles que no están en el bloqueo, agregarlos con cupo abierto (0)
      let currentHotels = Array.isArray(bloqueo?.hoteles) ? [...bloqueo.hoteles] : []
      const existingHotelNames = new Set(currentHotels.map(h => (h.nombre || '').toUpperCase()))
      let hotelsUpdated = false

      if (Array.isArray(excelImportedData?.hotels)) {
        excelImportedData.hotels.forEach(hName => {
          if (hName && !existingHotelNames.has(hName.toUpperCase())) {
            currentHotels.push({
              id: `htl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              nombre: hName.toUpperCase(),
              categoria: 'Clase 2 (Estándar / 4★)',
              cupos: 0 // Cupo Abierto
            })
            existingHotelNames.add(hName.toUpperCase())
            hotelsUpdated = true
          }
        })
      }

      if (hotelsUpdated) {
        await supabase.from('bloqueos').update({ hoteles: currentHotels }).eq('id', bloqueo.id)
        setBloqueo(prev => ({ ...prev, hoteles: currentHotels }))
      }

      // 2. Procesar las asignaciones / actualizaciones
      const today = format(new Date(), 'yyyy-MM-dd')
      let updateCount = 0
      let newCount = 0

      const updateOps = validOps.map(async ({ passenger: p, targetSlot: slot, isUpdate }) => {
        if (isUpdate) updateCount++
        else newCount++

        // Mapear operativo y comercial
        const opObj = p.operativo_nombre ? matchTeamMember(p.operativo_nombre, operativosList) : null
        const comObj = p.comercial_nombre ? matchTeamMember(p.comercial_nombre, comercialesList) : null
        const opNombre = opObj ? opObj.nombre : (p.operativo_nombre || slot.operativo_nombre || profile?.nombre || 'Operativo')
        const comNombre = comObj ? comObj.nombre : (p.comercial_nombre || slot.comercial_nombre || '')

        const slotStoredFull = normalizePassengerName(`${slot.nombres || ''} ${slot.apellidos || ''}`)
        const slotStoredNombres = normalizePassengerName(slot.nombres)
        const importedName = normalizePassengerName(p.nombres)
        const slotHasRealPax = Boolean(slot.nombres && !slot.nombres.includes('(POR ASIGNAR)') && slot.nombres !== '-')

        // Es la misma persona si el nombre normalizado coincide, o si el cupo solo tenía un placeholder por asignar, o si el Excel trae solo una reserva por asignar
        const isSamePerson = !slotHasRealPax || p.is_unnamed_reservation || importedName === slotStoredFull || importedName === slotStoredNombres

        // Reconciliar nombres y apellidos para evitar duplicaciones si el Excel trajo nombre completo
        let finalNombres = p.nombres
        let finalApellidos = isSamePerson ? (slot.apellidos || '') : ''

        if (p.is_unnamed_reservation) {
          // Si el Excel trajo solo una reserva por asignar de agencia, pero el cupo ya tiene un pasajero con nombre real, PRESERVAR al pasajero
          if (slotHasRealPax) {
            finalNombres = slot.nombres
            finalApellidos = slot.apellidos || ''
          } else {
            finalNombres = p.nombres
            finalApellidos = ''
          }
        } else if (isUpdate && slot.apellidos) {
          if (importedName === slotStoredFull || (p.nombres && slot.nombres && (normalizePassengerName(p.nombres) === slotStoredNombres))) {
            // El Excel contiene el nombre completo que coincide con nombres + apellidos almacenados
            finalNombres = slot.nombres
            finalApellidos = slot.apellidos
          } else {
            // Nombre diferente: actualizar nombres y limpiar apellidos para evitar duplicaciones
            finalNombres = p.nombres
            finalApellidos = ''
          }
        }

        // Si es una persona diferente en un reemplazo de cupo (ej. BOB en lugar de ALICE):
        // NO heredar documentos, tipo de documento ni pagos previos de la persona anterior.
        const shouldPreserveIdentityAndPayments = isUpdate && isSamePerson

        // Construir plan de pagos reconciliando historial y preservando cuotas y fechas originales
        let planPagos = []
        let abono1 = 0
        let fechaAbono1 = null
        let abono2 = 0
        let fechaAbono2 = null
        let abono3 = 0
        let fechaAbono3 = null

        if (shouldPreserveIdentityAndPayments) {
          // Reconciliar con el historial existente del cupo para preservar fechas y cuotas pendientes
          const existingPlan = getSlotStoredPayments(slot)
          planPagos = existingPlan.map(item => ({ ...item }))

          const reconcileInstallment = (num, importedAmount, defaultLabel) => {
            if (!importedAmount || importedAmount <= 0) return
            const idx = planPagos.findIndex(it => Number(it.numero) === num || it.id === String(num))
            if (idx >= 0) {
              const current = planPagos[idx]
              planPagos[idx] = {
                ...current,
                numero: num,
                monto: Number(importedAmount),
                fecha: current.fecha || today,
                estado: 'pagado'
              }
            } else {
              planPagos.push({
                id: String(num),
                numero: num,
                label: defaultLabel,
                monto: Number(importedAmount),
                fecha: today,
                estado: 'pagado'
              })
            }
            planPagos.sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0))
          }

          if (p.abono_1 > 0) reconcileInstallment(1, p.abono_1, 'Abono 1')
          if (p.abono_2 > 0) reconcileInstallment(2, p.abono_2, 'Abono 2')
          if (p.abono_3 > 0) reconcileInstallment(3, p.abono_3, 'Abono 3')

          // Reconciliar columnas individuales de abono preservando fechas originales de forma consistente
          if (p.abono_1 > 0) {
            abono1 = Number(p.abono_1)
            fechaAbono1 = slot.fecha_abono_1 || today
          } else {
            abono1 = Number(slot.abono_1) || 0
            fechaAbono1 = slot.fecha_abono_1 || null
          }

          if (p.abono_2 > 0) {
            abono2 = Number(p.abono_2)
            fechaAbono2 = slot.fecha_abono_2 || today
          } else {
            abono2 = Number(slot.abono_2) || 0
            fechaAbono2 = slot.fecha_abono_2 || null
          }

          if (p.abono_3 > 0) {
            abono3 = Number(p.abono_3)
            fechaAbono3 = slot.fecha_abono_3 || today
          } else {
            abono3 = Number(slot.abono_3) || 0
            fechaAbono3 = slot.fecha_abono_3 || null
          }
        } else {
          // Nuevo pasajero o reemplazo en cupo
          if (p.abono_1 > 0) planPagos.push({ id: '1', numero: 1, label: 'Abono 1', monto: p.abono_1, fecha: today, estado: 'pagado' })
          if (p.abono_2 > 0) planPagos.push({ id: '2', numero: 2, label: 'Abono 2', monto: p.abono_2, fecha: today, estado: 'pagado' })
          if (p.abono_3 > 0) planPagos.push({ id: '3', numero: 3, label: 'Abono 3', monto: p.abono_3, fecha: today, estado: 'pagado' })
          abono1 = p.abono_1 || 0
          fechaAbono1 = p.abono_1 > 0 ? today : null
          abono2 = p.abono_2 || 0
          fechaAbono2 = p.abono_2 > 0 ? today : null
          abono3 = p.abono_3 || 0
          fechaAbono3 = p.abono_3 > 0 ? today : null
        }

        const agreedPrice = shouldPreserveIdentityAndPayments
          ? (slot.precio_acordado !== null && slot.precio_acordado !== undefined ? Number(slot.precio_acordado) : Number(bloqueo?.precio_venta_pax || 0))
          : Number(bloqueo?.precio_venta_pax || 0)
        const totalPaid = planPagos.filter(item => item.estado === 'pagado').reduce((acc, it) => acc + (Number(it.monto) || 0), 0)
        const isPaid = totalPaid >= agreedPrice && agreedPrice > 0

        const payload = {
          agencia: p.has_agency && p.agencia ? p.agencia : (slot.agencia || 'Directo'),
          ciudad: p.has_city && p.ciudad ? p.ciudad : (slot.ciudad || 'GYE'),
          tipo_servicio: slot.tipo_servicio || 'PAQUETE COMPLETO',
          operativo_id: opObj ? opObj.id : (p.operativo_nombre ? null : (slot.operativo_id || user?.id || null)),
          operativo_nombre: opNombre,
          comercial_id: comObj ? comObj.id : (p.comercial_nombre ? null : (slot.comercial_id || null)),
          comercial_nombre: comNombre,
          hoteles: p.has_hotel && p.hoteles ? p.hoteles : (slot.hoteles || (currentHotels[0]?.nombre || '')),
          nombres: finalNombres,
          apellidos: finalApellidos,
          tipo_documento: shouldPreserveIdentityAndPayments ? (slot.tipo_documento || 'Cédula') : 'Cédula',
          numero_documento: shouldPreserveIdentityAndPayments ? (slot.numero_documento || '') : '',
          fecha_nacimiento: shouldPreserveIdentityAndPayments ? (slot.fecha_nacimiento || null) : null,
          caducidad_pasaporte: shouldPreserveIdentityAndPayments ? (slot.caducidad_pasaporte || null) : null,
          nacionalidad: shouldPreserveIdentityAndPayments ? (slot.nacionalidad || null) : null,
          genero: shouldPreserveIdentityAndPayments ? (slot.genero || null) : null,
          requerimientos_especiales: shouldPreserveIdentityAndPayments ? (slot.requerimientos_especiales || '') : '',
          codigo_cotizacion: shouldPreserveIdentityAndPayments ? (slot.codigo_cotizacion || null) : null,
          cotizacion_id: shouldPreserveIdentityAndPayments ? (slot.cotizacion_id || null) : null,
          grupo_id: shouldPreserveIdentityAndPayments ? (slot.grupo_id || null) : null,
          grupo_nombre: shouldPreserveIdentityAndPayments ? (slot.grupo_nombre || null) : null,
          tipo_habitacion: p.has_room && p.tipo_habitacion ? p.tipo_habitacion : (slot.tipo_habitacion || 'Doble'),
          categoria_habitacion: slot.categoria_habitacion || 'Clase 2 (Estándar / 4★)',
          precio_acordado: agreedPrice,
          abono_1: abono1,
          fecha_abono_1: fechaAbono1,
          abono_2: abono2,
          fecha_abono_2: fechaAbono2,
          abono_3: abono3,
          fecha_abono_3: fechaAbono3,
          plan_pagos: planPagos,
          estado_pago: isPaid ? 'pagado' : 'pendiente',
          fecha_limite_pago_agencia: shouldPreserveIdentityAndPayments ? (slot.fecha_limite_pago_agencia || null) : null,
          observaciones: p.observaciones ? p.observaciones : (shouldPreserveIdentityAndPayments ? (slot.observaciones || '') : '')
        }

        const { error: updErr } = await supabase
          .from('bloqueo_pasajeros')
          .update(payload)
          .eq('id', slot.id)

        if (updErr) {
          const { plan_pagos: _p, ...cleanPayload } = payload
          await supabase.from('bloqueo_pasajeros').update(cleanPayload).eq('id', slot.id)
        }

        return { slotId: slot.id, payload }
      })

      const results = await Promise.all(updateOps)

      // Actualización optimista instantánea
      setPasajeros(prev => prev.map(s => {
        const match = results.find(r => r.slotId === s.id)
        if (match) {
          const total = match.payload.precio_acordado
          const totalAbonado = match.payload.plan_pagos.filter(item => item.estado === 'pagado').reduce((acc, it) => acc + (Number(it.monto) || 0), 0)
          return {
            ...s,
            ...match.payload,
            faltante: Math.max(0, total - totalAbonado)
          }
        }
        return s
      }))

      // Notificación Telegram
      fetch('/api/notify/bloqueo-venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloqueoTitulo: bloqueo.titulo,
          bloqueoCodigo: bloqueo.codigo,
          destino: bloqueo.destino,
          fechaSalida: bloqueo.fecha_salida,
          cuposVendidos: validOps.length,
          pasajerosNombres: `Sincronización Excel (${updateCount} actualizados, ${newCount} nuevos)`,
          agencia: validOps[0]?.passenger?.agencia || 'Directo',
          ciudad: validOps[0]?.passenger?.ciudad || 'GYE',
          operativoNombre: profile?.nombre || 'Operativo',
          comercialNombre: validOps[0]?.passenger?.comercial_nombre || '',
          cuposRestantes: Math.max(0, metrics.disponibles - newCount),
          cuposTotales: metrics.totalCupos,
          hoteles: validOps[0]?.passenger?.hoteles || ''
        })
      }).catch(e => console.error('Telegram notification error:', e))

      showToast(`¡Sincronización completada! ${updateCount} cupos actualizados y ${newCount} nuevos asignados sin duplicar.`, 'success')
      setShowExcelImportModal(false)
      setShowQuickPasteModal(false)
      setExcelImportedData(null)
      setExcelImportRawText('')
      fetchBloqueoData(false)
    } catch (err) {
      console.error('Error sincronizando pasajeros desde Excel:', err)
      showToast('Error al sincronizar: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Mover este bloqueo a Papelera (Respaldo)
  const handleDeleteThisBloqueo = async () => {
    if (!isPrivileged) return
    const msg = `¿Mover este programa "${bloqueo.titulo}" (${bloqueo.codigo}) a la papelera de respaldo?\n\nTodos los pasajeros, abonos y configuraciones permanecerán seguros. Podrás restaurarlo en cualquier momento desde la papelera de bloqueos.`
    if (!confirm(msg)) return

    try {
      const { error } = await supabase
        .from('bloqueos')
        .update({ estado: 'eliminado', updated_at: new Date().toISOString() })
        .eq('id', bloqueo.id)

      if (error) throw error

      try {
        await supabase.from('logs_actividad').insert([{
          usuario_id: user?.id,
          usuario_nombre: profile?.nombre || 'Admin',
          usuario_email: user?.email || profile?.email || '',
          accion: 'MOVER_BLOQUEO_PAPELERA',
          detalles: `Bloqueo ${bloqueo.codigo} - "${bloqueo.titulo}" (${bloqueo.destino}) movido a papelera de respaldo desde el detalle.`
        }])
      } catch (logErr) {
        console.warn('Error registrando log de actividad:', logErr)
      }

      showToast(`Programa ${bloqueo.codigo} respaldado y movido a la papelera.`, 'success')
      router.push('/dashboard/bloqueos')
    } catch (err) {
      console.error('Error al mover bloqueo a papelera:', err)
      showToast('Error al mover a papelera: ' + err.message, 'error')
    }
  }

  // Restaurar este bloqueo
  const handleRestoreThisBloqueo = async () => {
    if (!isPrivileged) return
    try {
      const { error } = await supabase
        .from('bloqueos')
        .update({ estado: 'activo', updated_at: new Date().toISOString() })
        .eq('id', bloqueo.id)

      if (error) throw error

      try {
        await supabase.from('logs_actividad').insert([{
          usuario_id: user?.id,
          usuario_nombre: profile?.nombre || 'Admin',
          usuario_email: user?.email || profile?.email || '',
          accion: 'RESTAURAR_BLOQUEO',
          detalles: `Bloqueo ${bloqueo.codigo} - "${bloqueo.titulo}" restaurado desde el detalle.`
        }])
      } catch (logErr) {
        console.warn('Error registrando log de actividad:', logErr)
      }

      setBloqueo(prev => ({ ...prev, estado: 'activo' }))
      showToast(`¡Programa ${bloqueo.codigo} restaurado y reactivado con éxito!`, 'success')
    } catch (err) {
      console.error('Error al restaurar bloqueo:', err)
      showToast('Error al restaurar: ' + err.message, 'error')
    }
  }

  // Edit Bloqueo from Detail Page (Admin/SuperAdmin)
  const handleOpenEditBloqueoModal = () => {
    if (!bloqueo) return
    const existingHoteles = Array.isArray(bloqueo.hoteles) ? bloqueo.hoteles : []

    setEditBloqueoForm({
      titulo: bloqueo.titulo || '',
      codigo: bloqueo.codigo || '',
      destino: bloqueo.destino || '',
      aerolinea: bloqueo.aerolinea || '',
      fecha_salida: bloqueo.fecha_salida || '',
      fecha_retorno: bloqueo.fecha_retorno || '',
      fecha_limite_emision: bloqueo.fecha_limite_emision || '',
      fecha_limite_pago: bloqueo.fecha_limite_pago || '',
      cupos_totales: bloqueo.cupos_totales || 30,
      estado: bloqueo.estado || 'activo',
      precio_venta_pax: bloqueo.precio_venta_pax || '',
      notas: bloqueo.notas || '',
      hoteles: existingHoteles
    })
    setShowEditBloqueoModal(true)
  }

  const handleSaveEditBloqueo = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const oldCupos = bloqueo.cupos_totales || 30
      const newCupos = Number(editBloqueoForm.cupos_totales) || 30

      // Validación: solo si hay hoteles con nombre configurados
      const validHoteles = (editBloqueoForm.hoteles || []).filter(h => h.nombre && h.nombre.trim() !== '')
      if (validHoteles.length > 0) {
        const hasOpenHotel = validHoteles.some(h => !h.cupos || Number(h.cupos) === 0)
        const totalAsignadoHoteles = validHoteles.reduce((acc, h) => acc + (Number(h.cupos) || 0), 0)
        if (!hasOpenHotel && totalAsignadoHoteles > newCupos) {
          showToast(`Los cupos fijos asignados a los hoteles (${totalAsignadoHoteles}) superan los ${newCupos} cupos totales del viaje. Ajusta los valores o usa 0 para cupo abierto.`, 'error')
          setSaving(false)
          return
        }
      }

      if (newCupos > oldCupos) {
        const newSlots = []
        for (let i = oldCupos + 1; i <= newCupos; i++) {
          newSlots.push({
            bloqueo_id: bloqueo.id,
            numero_cupo: i,
            nombres: '',
            precio_acordado: Number(editBloqueoForm.precio_venta_pax) || bloqueo.precio_venta_pax,
            estado_pago: 'pendiente'
          })
        }
        const { error: insErr } = await supabase.from('bloqueo_pasajeros').insert(newSlots)
        if (insErr) throw insErr
      } else if (newCupos < oldCupos) {
        const { data: occupied } = await supabase
          .from('bloqueo_pasajeros')
          .select('numero_cupo, nombres')
          .eq('bloqueo_id', bloqueo.id)
          .gt('numero_cupo', newCupos)

        const hasOcc = (occupied || []).some(o => o && String(o.nombres || '').trim() !== '')
        if (hasOcc) {
          showToast(`No se pueden reducir cupos a ${newCupos} porque hay cupos ocupados más allá de esa posición.`, 'error')
          setSaving(false)
          return
        }

        const { error: delErr } = await supabase
          .from('bloqueo_pasajeros')
          .delete()
          .eq('bloqueo_id', bloqueo.id)
          .gt('numero_cupo', newCupos)
        if (delErr) throw delErr
      }

      const updateData = {
        titulo: editBloqueoForm.titulo.trim(),
        codigo: editBloqueoForm.codigo.trim().toUpperCase(),
        destino: editBloqueoForm.destino.trim(),
        aerolinea: editBloqueoForm.aerolinea.trim() || null,
        fecha_salida: editBloqueoForm.fecha_salida,
        fecha_retorno: editBloqueoForm.fecha_retorno || null,
        fecha_limite_emision: editBloqueoForm.fecha_limite_emision || null,
        fecha_limite_pago: editBloqueoForm.fecha_limite_pago || null,
        cupos_totales: newCupos,
        estado: editBloqueoForm.estado,
        precio_venta_pax: Number(editBloqueoForm.precio_venta_pax) || 0,
        notas: editBloqueoForm.notas?.trim() || null,
        hoteles: validHoteles,
        updated_at: new Date().toISOString()
      }

      let { error } = await supabase.from('bloqueos').update(updateData).eq('id', bloqueo.id)
      if (error && (error.message?.includes('hoteles') || error.code === '42703')) {
        const { hoteles: _ignored, ...cleanData } = updateData
        const retry = await supabase.from('bloqueos').update(cleanData).eq('id', bloqueo.id)
        error = retry.error
      }
      if (error) throw error

      showToast('¡Configuración del bloqueo actualizada!', 'success')
      setShowEditBloqueoModal(false)
      const updatedBloqueo = { ...bloqueo, ...updateData }
      setBloqueo(updatedBloqueo)
      if (memoryCacheBloqueoDetail[bloqueo.id]) {
        memoryCacheBloqueoDetail[bloqueo.id].bloqueo = updatedBloqueo
      }
      fetchBloqueoData(false)
    } catch (err) {
      console.error('Error updating bloqueo:', err)
      showToast('Error al actualizar bloqueo: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Rooming Distribution View Calculations
  const roomingDistribution = useMemo(() => {
    const occupied = (pasajeros || []).filter(p => p && String(p.nombres || '').trim() !== '')
    const categoriesMap = {}

    occupied.forEach(p => {
      const cat = p.categoria_habitacion || 'Clase 2 (Estándar / 4★)'
      if (!categoriesMap[cat]) {
        categoriesMap[cat] = []
      }
      categoriesMap[cat].push(p)
    })

    const result = []
    Object.keys(categoriesMap).forEach(catName => {
      const paxes = categoriesMap[catName]
      const rooms = []
      const processedIds = new Set()

      paxes.forEach((pax) => {
        if (processedIds.has(pax.id)) return

        const roomType = pax.tipo_habitacion || 'Doble'
        let capacity = 2
        if (roomType === 'Simple' || roomType === 'Simple (SGL)') capacity = 1
        else if (roomType === 'Triple') capacity = 3
        else if (roomType === 'Cuádruple') capacity = 4
        else if (roomType === 'Matrimonial') capacity = 2
        else if (roomType === 'Twin') capacity = 2

        const companions = [pax]
        processedIds.add(pax.id)

        paxes.forEach((other) => {
          if (!processedIds.has(other.id) && companions.length < capacity) {
            const matchGroup = pax.grupo_id && other.grupo_id && pax.grupo_id === other.grupo_id
            const matchAgency = !pax.grupo_id && !other.grupo_id && pax.agencia && other.agencia && pax.agencia === other.agencia
            const sameType = (other.tipo_habitacion || 'Doble') === roomType
            const sameHotel = !pax.hoteles || !other.hoteles || pax.hoteles === other.hoteles

            if ((matchGroup || matchAgency) && sameType && sameHotel) {
              companions.push(other)
              processedIds.add(other.id)
            }
          }
        })

        rooms.push({
          roomIndex: rooms.length + 1,
          roomType,
          capacity,
          passengers: companions,
          isComplete: companions.length >= capacity,
          grupoNombre: pax.grupo_nombre || pax.agencia || 'Directo',
          hotel: pax.hoteles || ''
        })
      })

      result.push({
        category: catName,
        totalPax: paxes.length,
        rooms
      })
    })

    return result
  }, [pasajeros])

  // Export Rooming List to Excel (Loaded dynamically for ultra-fast page load)
  const handleExportRoomingList = async () => {
    if (!bloqueo || pasajeros.length === 0) return
    showToast('Generando Rooming List...', 'info')
    const ExcelJSModule = await import('exceljs')
    const ExcelJS = ExcelJSModule.default || ExcelJSModule
    const { saveAs } = await import('file-saver')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Rooming List')

    sheet.mergeCells('A1:M1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = `CTB VIAJANDO — ROOMING LIST & MANIFIESTO OFICIAL: ${bloqueo.titulo.toUpperCase()}`
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(1).height = 35

    sheet.mergeCells('A2:M2')
    const metaCell = sheet.getCell('A2')
    metaCell.value = `DESTINO: ${bloqueo.destino} | AEROLÍNEA: ${bloqueo.aerolinea || 'N/A'} | FECHA SALIDA: ${bloqueo.fecha_salida} | RETORNO: ${bloqueo.fecha_retorno || 'N/A'}`
    metaCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0066CC' } }
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(2).height = 25

    const headers = [
      '# PAX', 'GRUPO', 'NOMBRES', 'APELLIDOS', 'DOC / PASAPORTE', 'HABITACIÓN', 'CATEGORÍA HOTEL',
      'AGENCIA', 'CIUDAD', 'SERVICIO', 'OPERATIVO', 'COMERCIAL', 'HOTELES'
    ]
    sheet.addRow([])
    const headerRow = sheet.addRow(headers)
    headerRow.height = 24
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    pasajeros.forEach(p => {
      const row = sheet.addRow([
        p.numero_cupo,
        p.grupo_nombre || '',
        p.nombres || 'LIBRE',
        p.apellidos || '',
        p.numero_documento || '',
        p.tipo_habitacion || 'DOBLE',
        p.categoria_habitacion || 'Clase 2 (Estándar / 4★)',
        p.agencia || '',
        p.ciudad || '',
        p.tipo_servicio || '',
        p.operativo_nombre || '',
        p.comercial_nombre || '',
        p.hoteles || ''
      ])
      row.height = 20
      if (!p.nombres) {
        row.getCell(3).font = { italic: true, color: { argb: 'FF94A3B8' } }
      }
    })

    sheet.columns = [
      { width: 8 },  { width: 22 }, { width: 20 }, { width: 20 }, { width: 16 },
      { width: 14 }, { width: 24 }, { width: 24 }, { width: 10 }, { width: 18 },
      { width: 16 }, { width: 16 }, { width: 26 }
    ]

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Rooming_List_${bloqueo.codigo}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    showToast('Rooming List exportado a Excel.', 'success')
  }

  // Filtered list with comprehensive search & accurate balance status (optimized & 100% safe)
  const filteredSlots = useMemo(() => {
    const term = searchTerm ? String(searchTerm).toLowerCase().trim() : ''
    const list = Array.isArray(pasajeros) ? pasajeros : []

    return list.filter(p => {
      if (!p) return false
      const pNombres = String(p.nombres || '').trim()
      const isOcupado = Boolean(pNombres !== '')

      if (statusFilter === 'ocupados' && !isOcupado) return false
      if (statusFilter === 'libres' && isOcupado) return false
      if (statusFilter === 'pendientes') {
        if (!isOcupado) return false
        const precio = Number(p.precio_acordado) || Number(bloqueo?.precio_venta_pax) || 0
        let totalPagado = 0
        if (Array.isArray(p.plan_pagos) && p.plan_pagos.length > 0) {
          totalPagado = p.plan_pagos
            .filter(item => item && item.estado === 'pagado')
            .reduce((sum, item) => sum + (Number(item?.monto) || 0), 0)
        } else {
          totalPagado = (Number(p.abono_1) || 0) + (Number(p.abono_2) || 0) + (Number(p.abono_3) || 0)
        }
        if (totalPagado >= precio && precio > 0) return false
      }

      if (!term) return true
      return (
        String(p.nombres || '').toLowerCase().includes(term) ||
        String(p.apellidos || '').toLowerCase().includes(term) ||
        String(p.numero_documento || '').toLowerCase().includes(term) ||
        String(p.tipo_habitacion || '').toLowerCase().includes(term) ||
        String(p.categoria_habitacion || '').toLowerCase().includes(term) ||
        String(p.grupo_nombre || '').toLowerCase().includes(term) ||
        String(p.agencia || '').toLowerCase().includes(term) ||
        String(p.operativo_nombre || '').toLowerCase().includes(term) ||
        String(p.comercial_nombre || '').toLowerCase().includes(term) ||
        String(p.codigo_cotizacion || '').toLowerCase().includes(term) ||
        String(p.numero_cupo ?? '').includes(term)
      )
    })
  }, [pasajeros, statusFilter, searchTerm, bloqueo?.precio_venta_pax])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 bg-white rounded-3xl border border-gray-100">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">
          Cargando tabla de pasajeros...
        </p>
      </div>
    )
  }

  if (!bloqueo) {
    return (
      <div className="text-center p-16 bg-white rounded-3xl border border-gray-100">
        <AlertTriangle size={40} className="mx-auto text-amber-500 mb-3" />
        <h3 className="text-base font-black text-gray-800">Bloqueo no encontrado</h3>
        <p className="text-xs text-gray-400 mt-1 mb-4">El bloqueo solicitado no existe o fue eliminado.</p>
        <Link href="/dashboard/bloqueos" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black">
          <ArrowLeft size={16} /> Volver a Bloqueos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Banner si el bloqueo está en papelera */}
      {bloqueo.estado === 'eliminado' && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 text-rose-950 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-rose-800">
                Programa en Papelera de Respaldo
              </p>
              <p className="text-xs text-rose-700 font-medium">
                Este programa fue movido a la papelera. Todos los cupos, pagos y pasajeros permanecen respaldados y seguros.
              </p>
            </div>
          </div>
          {isPrivileged && (
            <button
              onClick={handleRestoreThisBloqueo}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 shrink-0"
            >
              <RefreshCw size={14} />
              <span>Restaurar Programa</span>
            </button>
          )}
        </div>
      )}

      {/* Top Navigation & Bloqueo Overview Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <Link
            href="/dashboard/bloqueos"
            className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-200/80 text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-all shrink-0 mt-1 active:scale-95 shadow-2xs"
            title="Volver a Bloqueos"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            {/* Badges superiores alineados */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-gray-900 text-white shadow-2xs">
                {bloqueo.codigo}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-900 text-xs font-bold border border-blue-200/60">
                <MapPin size={13} className="text-primary shrink-0" />
                <span>{bloqueo.destino}</span>
              </span>
              {bloqueo.aerolinea && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200/60">
                  <Plane size={13} className="text-gray-500 shrink-0" />
                  <span>{bloqueo.aerolinea}</span>
                </span>
              )}
            </div>

            {/* Título Principal */}
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1.5 leading-tight truncate" title={bloqueo.titulo}>
              {bloqueo.titulo}
            </h1>

            {/* Fechas de Salida y Límite */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-gray-600 font-medium">
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <span>Salida:</span>
                <strong className="text-gray-900">
                  {(() => {
                    if (!bloqueo.fecha_salida) return 'Por definir'
                    try {
                      const clean = String(bloqueo.fecha_salida).replace(' ', 'T').split('T')[0]
                      const d = parseISO(clean)
                      if (isNaN(d.getTime())) return String(bloqueo.fecha_salida)
                      return format(d, "EEEE d 'de' MMMM, yyyy", { locale: es })
                    } catch {
                      return String(bloqueo.fecha_salida || 'Por definir')
                    }
                  })()}
                </strong>
              </span>

              {bloqueo.fecha_limite_emision && (
                <span className="inline-flex items-center gap-1.5 text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                  <Clock size={12} className="text-amber-600 shrink-0" />
                  <span>
                    Fecha límite nombres: {(() => {
                      try {
                        const clean = String(bloqueo.fecha_limite_emision).replace(' ', 'T').split('T')[0]
                        const d = parseISO(clean)
                        if (isNaN(d.getTime())) return String(bloqueo.fecha_limite_emision)
                        return format(d, "d 'de' MMMM", { locale: es })
                      } catch {
                        return String(bloqueo.fecha_limite_emision)
                      }
                    })()}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Grupos de Acciones Organizados y Jerarquizados */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
          {/* GRUPO 1: Ajustes Administrativos (Para Administradores) */}
          {isPrivileged && (
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-200/80 shadow-2xs">
              <button
                onClick={handleOpenEditBloqueoModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-700 hover:text-gray-900 hover:bg-white text-xs font-bold transition-all"
                title="Editar fechas, precios y cupos del programa"
              >
                <Settings size={14} className="text-gray-500" />
                <span className="hidden sm:inline">Ajustes</span>
              </button>

              {bloqueo.estado !== 'eliminado' && (
                <button
                  onClick={handleDeleteThisBloqueo}
                  className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-white transition-all"
                  title="Mover este bloqueo a la papelera (respaldado)"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}

          {/* GRUPO 2: Descargas y Manifiestos (Menú Desplegable Unificado) */}
          <div className="relative">
            <button
              onClick={() => {
                setShowExportMenu(prev => !prev)
                setShowAddPaxMenu(false)
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-gray-200/90 text-gray-700 hover:text-gray-950 hover:bg-gray-50/80 font-black text-xs uppercase tracking-wider transition-all shadow-xs active:scale-95"
              title="Descargar o exportar listas de pasajeros y manifiestos"
            >
              <Download size={15} className="text-gray-500" />
              <span>Exportar</span>
              <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Formatos de Descarga
                    </span>
                  </div>

                  {/* Opción 1: Excel Rooming List */}
                  <button
                    onClick={() => {
                      setShowExportMenu(false)
                      handleExportRoomingList()
                    }}
                    className="w-full text-left p-2.5 rounded-2xl hover:bg-emerald-50/60 flex items-center gap-3 transition-colors group mt-1"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-2xs">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 group-hover:text-emerald-800">
                        Rooming en Excel (.xlsx)
                      </p>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        Para hoteles y operadores terrestres.
                      </p>
                    </div>
                  </button>

                  {/* Opción 2: PDF Oficial */}
                  <button
                    onClick={() => {
                      setShowExportMenu(false)
                      showToast('Generando Rooming List Oficial en PDF...', 'info')
                      exportBloqueoRoomingPDF(bloqueo, pasajeros)
                    }}
                    className="w-full text-left p-2.5 rounded-2xl hover:bg-rose-50/60 flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-2xs">
                      <Download size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 group-hover:text-rose-800">
                        PDF Oficial Membretado
                      </p>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        Documento oficial de presentación de reserva.
                      </p>
                    </div>
                  </button>

                  {/* Opción 3: Manifiesto GDS */}
                  <button
                    onClick={() => {
                      setShowExportMenu(false)
                      setShowGdsModal(true)
                    }}
                    className="w-full text-left p-2.5 rounded-2xl hover:bg-blue-50/60 flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-2xs">
                      <Plane size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 group-hover:text-blue-800">
                        Manifiesto Aéreo GDS
                      </p>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        Comandos Amadeus, Sabre o carga Web.
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* GRUPO 3: Importar desde Excel (Acción Rápida Destacada) */}
          <button
            onClick={() => {
              setExcelImportedData(null)
              setExcelImportRawText('')
              setShowExcelImportModal(true)
            }}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/25 active:scale-95"
            title="Importar pasajeros y pagos automáticamente desde Excel o Portapapeles"
          >
            <FileSpreadsheet size={15} />
            <span>Importar Excel</span>
          </button>

          {/* GRUPO 4: Acción Primaria: Registrar Pasajeros */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAddPaxMenu(prev => !prev)
                setShowExportMenu(false)
              }}
              className="btn-primary flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95 transition-all text-xs font-black uppercase tracking-wider whitespace-nowrap"
            >
              <Plus size={16} />
              <span>Registrar Pasajeros</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showAddPaxMenu ? 'rotate-180' : ''}`} />
            </button>

            {showAddPaxMenu && (
              <>
                {/* Backdrop invisible para cerrar al hacer clic afuera */}
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setShowAddPaxMenu(false)}
                />

                {/* Menú Desplegable Flotante */}
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Modalidad de Asignación
                    </span>
                  </div>

                  {/* Opción A: Ingreso Individual */}
                  <button
                    onClick={() => {
                      setShowAddPaxMenu(false)
                      const freeSlot = (pasajeros || []).find(p => !p || !p.nombres || String(p.nombres).trim() === '')
                      if (!freeSlot) {
                        showToast('Todos los cupos de este bloqueo están ocupados.', 'error')
                        return
                      }
                      handleOpenSingleSlot(freeSlot)
                    }}
                    className="w-full text-left p-3 rounded-2xl hover:bg-blue-50/60 flex items-start gap-3 transition-colors group mt-1"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all shadow-xs">
                      <User size={17} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 group-hover:text-primary">
                        Ingreso Individual (1 a 1)
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                        Asigna datos y documentos de un pasajero en el siguiente cupo disponible.
                      </p>
                    </div>
                  </button>

                  {/* Opción B: Ingreso por Grupo */}
                  <button
                    onClick={() => {
                      setShowAddPaxMenu(false)
                      handleOpenGroupModal()
                    }}
                    className="w-full text-left p-3 rounded-2xl hover:bg-purple-50/60 flex items-start gap-3 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs">
                      <Layers size={17} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 group-hover:text-purple-600">
                        Ingreso por Grupo
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                        Crea un grupo con nombre oficial (ej. Tercera Edad) y múltiples pasajeros.
                      </p>
                    </div>
                  </button>

                  <div className="my-1.5 border-t border-gray-100"></div>

                  {/* Opción C: Importar desde Excel */}
                  <button
                    onClick={() => {
                      setShowAddPaxMenu(false)
                      setExcelImportedData(null)
                      setExcelImportRawText('')
                      setShowExcelImportModal(true)
                    }}
                    className="w-full text-left p-3 rounded-2xl hover:bg-emerald-50/70 flex items-start gap-3 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                      <FileSpreadsheet size={17} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-gray-900 group-hover:text-emerald-800">
                          Importar desde Excel
                        </p>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700">
                          Inteligente
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                        Carga tablas de Excel (.xlsx, .csv o copiado directo) con nombres, hoteles y pagos.
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Flight Countdown Precision Timer */}
      {bloqueo.fecha_salida && (
        <BloqueoCountdownTimer fechaSalida={bloqueo.fecha_salida} className="mt-0" />
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Ocupación Total</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-gray-900">{metrics.ocupados} / {metrics.totalCupos}</span>
            <span className="text-xs font-bold text-gray-500">({metrics.porcentaje}%)</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: `${metrics.porcentaje}%` }} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Cupos Disponibles</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{metrics.disponibles}</p>
          <span className="text-xs text-gray-400 font-medium">Libres para venta</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Total Recaudado</span>
          <p className="text-2xl font-black text-gray-900 mt-1">${metrics.totalCobrado.toLocaleString('es-EC')}</p>
          <span className="text-xs text-gray-400 font-medium">Suma de abonos</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Saldo por Cobrar</span>
          <p className="text-2xl font-black text-amber-600 mt-1">${metrics.totalPendiente.toLocaleString('es-EC')}</p>
          <span className="text-xs text-gray-400 font-medium">Pendiente de cobro</span>
        </div>
      </div>

      {/* Control Financiero Administrativo: Inversión, Recuperado y Meta */}
      {isPrivileged && metrics.inversionTotal > 0 && (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2.5 rounded-2xl ${metrics.inversionCubierta ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                <Target size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">
                  Control de Inversión (Administración)
                </span>
                <p className="text-sm font-black text-gray-900">
                  {metrics.inversionCubierta ? (
                    <span className="text-emerald-700 flex items-center gap-1.5 font-bold">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      ¡Meta de inversión 100% recuperada!
                    </span>
                  ) : (
                    <span>
                      Falta para la meta: <strong className="text-amber-800">${metrics.faltaRecuperarDinero.toLocaleString('es-EC')} USD</strong>
                      {metrics.faltanPaxMeta > 0 && (
                        <span className="text-gray-400 font-normal text-xs ml-1.5">
                          (Faltan {metrics.faltanPaxMeta} cupos a precio de venta)
                        </span>
                      )}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className={`text-xs font-black px-3 py-1 rounded-full ${
                metrics.inversionCubierta ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {metrics.porcentajeRecuperado}% recuperado
              </span>
              {metrics.inversionCubierta && metrics.gananciaLiquidaActual > 0 && (
                <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  +${metrics.gananciaLiquidaActual.toLocaleString('es-EC')} ganancia
                </span>
              )}
            </div>
          </div>

          {/* Barra visual de progreso de inversión */}
          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.inversionCubierta ? 'bg-emerald-500' : metrics.porcentajeRecuperado >= 50 ? 'bg-primary' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, metrics.porcentajeRecuperado)}%` }}
            />
          </div>

          {/* Cuadrícula de 3 datos financieros */}
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-gray-50/80 p-2.5 rounded-2xl border border-gray-150">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Inversión Total</span>
              <strong className="text-xs sm:text-sm font-black text-gray-900 mt-0.5 block">
                ${metrics.inversionTotal.toLocaleString('es-EC')} USD
              </strong>
              <span className="text-[9px] text-gray-400 font-medium">Costo de cupos</span>
            </div>

            <div className="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-200/60">
              <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">Dinero Recuperado</span>
              <strong className="text-xs sm:text-sm font-black text-emerald-800 mt-0.5 block">
                ${metrics.totalCobrado.toLocaleString('es-EC')} USD
              </strong>
              <span className="text-[9px] text-emerald-600 font-medium">Cobrado real</span>
            </div>

            <div className={`p-2.5 rounded-2xl border ${
              metrics.inversionCubierta ? 'bg-emerald-50/70 border-emerald-200/60' : 'bg-amber-50/70 border-amber-200/60'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                metrics.inversionCubierta ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {metrics.inversionCubierta ? 'Ganancia Líquida' : 'Falta por Recuperar'}
              </span>
              <strong className={`text-xs sm:text-sm font-black mt-0.5 block ${
                metrics.inversionCubierta ? 'text-emerald-800' : 'text-amber-900'
              }`}>
                {metrics.inversionCubierta
                  ? `+$${metrics.gananciaLiquidaActual.toLocaleString('es-EC')} USD`
                  : `$${metrics.faltaRecuperarDinero.toLocaleString('es-EC')} USD`
                }
              </strong>
              <span className={`text-[9px] font-medium ${
                metrics.inversionCubierta ? 'text-emerald-600' : 'text-amber-700'
              }`}>
                {metrics.inversionCubierta ? 'En caja CTB' : 'Para no perder'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Resumen y Disponibilidad de Hoteles y Cupos */}
      {configuredHoteles && configuredHoteles.length > 0 ? (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                <Hotel size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-gray-900 tracking-tight">
                    Hoteles & Ocupación de Cupos
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                    {configuredHoteles.length} {configuredHoteles.length === 1 ? 'Hotel' : 'Hoteles'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-medium">
                  Distribución de los {bloqueo.cupos_totales} cupos totales entre los hoteles contratados.
                </p>
              </div>
            </div>

            {isPrivileged && (
              <button
                onClick={handleOpenEditBloqueoModal}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                <Settings size={13} />
                <span>Configurar Hoteles</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {configuredHoteles.map((h, hIdx) => {
              const hKey = (h?.nombre || '').trim().toLowerCase()
              const stat = hotelStats[hKey] || { ocupados: 0, disponibles: Number(h?.cupos) || 0 }
              const totCupos = Number(h?.cupos) || 0
              const ocupados = stat.ocupados
              const disponibles = stat.disponibles
              const pct = totCupos > 0 ? Math.min(100, Math.round((ocupados / totCupos) * 100)) : 0
              const isFull = totCupos > 0 && disponibles === 0
              const isOver = totCupos > 0 && ocupados > totCupos

              return (
                <div
                  key={h?.id || h?.nombre || hIdx}
                  className={`p-4 rounded-2xl border transition-all ${
                    isOver
                      ? 'bg-red-50/40 border-red-200'
                      : isFull
                      ? 'bg-amber-50/30 border-amber-200'
                      : 'bg-gray-50/60 border-gray-150 hover:border-gray-200 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-gray-900 truncate" title={h.nombre}>
                        {h.nombre}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-bold text-gray-600 px-2 py-0.5 rounded-md bg-white border border-gray-200">
                          {h.categoria?.split(' ')[0] || '4★'}
                        </span>
                        {h.regimen && (
                          <span className="text-[10px] font-semibold text-gray-500 px-2 py-0.5 rounded-md bg-white border border-gray-200">
                            {h.regimen}
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                        isOver
                          ? 'bg-red-600 text-white'
                          : isFull
                          ? 'bg-amber-500 text-white'
                          : totCupos === 0
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isOver
                        ? '⚠️ Excedido'
                        : isFull
                        ? 'Agotado'
                        : totCupos === 0
                        ? `Abierto · ${metrics.disponibles} libres`
                        : `${disponibles} libres`}
                    </span>
                  </div>

                  {/* Barra de progreso de cupos */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className="text-gray-500 text-[11px]">
                        {totCupos > 0 ? (
                          <>
                            <strong className="text-gray-900">{ocupados}</strong> de{' '}
                            <strong className="text-gray-900">{totCupos}</strong> cupos fijos
                          </>
                        ) : (
                          <>
                            <strong className="text-gray-900">{ocupados}</strong> asignados · <span className="text-blue-700 font-bold">Cupo abierto (hasta {metrics.totalCupos} PAX)</span>
                          </>
                        )}
                      </span>
                      <span className={`text-[11px] font-black ${isOver ? 'text-red-600' : isFull ? 'text-amber-600' : 'text-gray-600'}`}>
                        {totCupos > 0 ? `${pct}%` : `${metrics.porcentaje}% ocupado`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOver ? 'bg-red-500' : isFull ? 'bg-amber-500' : totCupos === 0 ? 'bg-blue-500' : 'bg-primary'
                        }`}
                        style={{ width: `${totCupos > 0 ? Math.min(100, pct) : metrics.porcentaje}%` }}
                      />
                    </div>
                  </div>

                  {/* Habitaciones y tarifas disponibles */}
                  {Array.isArray(h.habitaciones) && h.habitaciones.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-gray-200/60 flex flex-wrap gap-1.5">
                      {h.habitaciones.map(r => (
                        <span
                          key={r.id}
                          className="text-[10px] bg-white text-gray-700 px-2 py-0.5 rounded-lg border border-gray-200 font-semibold inline-flex items-center gap-1"
                        >
                          <span className="font-bold text-gray-900">{r.tipo}:</span>
                          <span className="text-emerald-700 font-black">${Number(r.precio) || 0}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* View Mode Toggle Strip: Vista Tabla vs Distribución Rooming */}
      <div className="bg-white p-2.5 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl">
          <button
            onClick={() => setViewMode('tabla')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'tabla'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Users size={15} />
            <span>Lista de Pasajeros</span>
          </button>
          <button
            onClick={() => setViewMode('rooming')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              viewMode === 'rooming'
                ? 'bg-white text-primary shadow-sm font-black'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Hotel size={15} />
            <span>Habitaciones & Hoteles</span>
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-gray-500 px-2 sm:px-0">
          <span className="flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>{metrics.ocupados} Pasajeros Registrados</span>
          </span>
          <span className="flex items-center gap-1.5 font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
            <span>{metrics.disponibles} Cupos Libres</span>
          </span>
        </div>
      </div>

      {/* Barra de Acciones Masivas Flotante */}
      {selectedSlotIds.length > 0 && (
        <div className="sticky top-20 z-30 bg-gray-900/95 backdrop-blur-md text-white p-4 rounded-3xl shadow-2xl border border-gray-800 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-sm shadow-md">
              {selectedSlotIds.length}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <span>{selectedSlotIds.length} {selectedSlotIds.length === 1 ? 'Cupo Seleccionado' : 'Cupos Seleccionados'}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                  Acciones en Lote
                </span>
              </p>
              <p className="text-[11px] text-gray-400">
                Aplica pagos, asigna hotel, copia nombres o agrupa en un solo clic
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Liquidación 100% */}
            <button
              onClick={handleBatchMarkPaid}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow transition-all flex items-center gap-1.5 active:scale-95"
              title="Marcar liquidación de pago completa al 100%"
            >
              <CheckCircle2 size={14} />
              <span>Liquidación 100%</span>
            </button>

            {/* 2. Asignar Hotel Masivo */}
            <button
              onClick={() => {
                if (configuredHoteles && configuredHoteles.length > 0) {
                  setBatchHotelForm(prev => ({ ...prev, hotel: configuredHoteles[0].nombre || '' }))
                }
                setShowBatchHotelModal(true)
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow transition-all flex items-center gap-1.5 active:scale-95"
              title="Asignar hotel y categoría de habitación a los seleccionados"
            >
              <Hotel size={14} />
              <span>Asignar Hotel</span>
            </button>

            {/* 3. Copiar Nombres */}
            <button
              onClick={handleCopySelectedNames}
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white font-black text-xs uppercase tracking-wider border border-gray-700 transition-all flex items-center gap-1.5 active:scale-95"
              title="Copiar lista de nombres seleccionados al portapapeles"
            >
              <Copy size={14} />
              <span className="hidden sm:inline">Copiar Nombres</span>
            </button>

            {/* 4. Formar Grupo */}
            <button
              onClick={() => setShowGroupExistingModal(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow transition-all flex items-center gap-1.5 active:scale-95"
              title="Agrupar pasajeros seleccionados bajo un nombre oficial"
            >
              <FolderPlus size={14} />
              <span>Formar Grupo</span>
            </button>

            {/* Cancelar */}
            <button
              onClick={() => setSelectedSlotIds([])}
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs font-bold transition-colors ml-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar pasajero, grupo, cotización..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white text-gray-900 placeholder:text-gray-400 font-semibold rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 border border-gray-200"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {['todos', 'ocupados', 'libres', 'pendientes'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {st === 'todos' ? 'Todos los Cupos' : st === 'ocupados' ? 'Ocupados' : st === 'libres' ? 'Cupos Libres' : 'Saldo Pendiente'}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW SWITCH: ROOMING DISTRIBUTION VS MAIN PASSENGER TABLE */}
      {viewMode === 'rooming' ? (
        <div className="space-y-6">
          {roomingDistribution.length === 0 ? (
            <div className="text-center p-16 bg-white rounded-3xl border border-gray-100">
              <Hotel size={40} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-black text-gray-800">No hay pasajeros asignados para rooming</h3>
              <p className="text-xs text-gray-400 mt-1">Asigna pasajeros individuales o por grupo para ver la distribución de habitaciones por estrellas.</p>
            </div>
          ) : (
            roomingDistribution.map((catGroup, idx) => {
              let starBadge = '⭐⭐⭐⭐'
              if (catGroup.category.includes('Clase 1')) {
                starBadge = '⭐⭐⭐'
              } else if (catGroup.category.includes('Clase 3')) {
                starBadge = '⭐⭐⭐⭐⭐'
              } else if (catGroup.category.includes('VIP') || catGroup.category.includes('Luxury')) {
                starBadge = '👑 VIP'
              }

              return (
                <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                        <Hotel size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                            Categoría Hotelera
                          </span>
                          <span className="text-xs font-black px-2 py-0.5 rounded-full bg-gray-100">
                            {starBadge}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-gray-900 tracking-tight">
                          {catGroup.category}
                        </h3>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-500">
                      Total en esta categoría: <strong className="text-gray-900">{catGroup.totalPax} Pasajeros</strong> ({catGroup.rooms.length} Habitaciones)
                    </div>
                  </div>

                  {/* Room cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {catGroup.rooms.map((room, rIdx) => (
                      <div
                        key={rIdx}
                        className={`p-4 rounded-2xl border transition-all ${
                          room.isComplete
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BedDouble size={16} className="text-gray-700" />
                            <span className="text-xs font-black text-gray-900 uppercase">
                              Hab. {room.roomType} #{room.roomIndex}
                            </span>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            room.isComplete
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}>
                            {room.isComplete ? `Completa (${room.passengers.length}/${room.capacity})` : `Falta ${room.capacity - room.passengers.length} PAX`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] mb-2 gap-1">
                          <p className="font-bold text-gray-400 truncate">
                            Grupo / Agencia: <span className="text-gray-700 font-semibold">{room.grupoNombre}</span>
                          </p>
                          {room.hotel && (
                            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 truncate shrink-0 max-w-[140px]">
                              🏨 {room.hotel}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 pt-1 border-t border-gray-100">
                          {room.passengers.map((pax) => (
                            <div
                              key={pax.id}
                              onClick={() => handleOpenSingleSlot(pax)}
                              className="flex items-center justify-between bg-white p-2 rounded-xl border border-gray-100 hover:border-primary/40 cursor-pointer shadow-2xs transition-all group"
                              title="Clic para editar pasajero"
                            >
                              <div className="truncate pr-2">
                                <p className="text-xs font-black text-gray-800 group-hover:text-primary uppercase truncate">
                                  {pax.nombres} {pax.apellidos || ''}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  Cupo #{pax.numero_cupo} · {pax.tipo_documento}: {pax.numero_documento || 'Sin doc'}
                                </p>
                              </div>
                              <Edit3 size={13} className="text-gray-400 group-hover:text-primary shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* MAIN PASSENGER TABLE */
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Mobile responsive scroll hint */}
          <div className="md:hidden flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 font-medium">
            <span>👉 Desliza horizontalmente para ver toda la tabla 👈</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="py-4 px-3 text-center w-10">
                    <button onClick={selectAllOccupied} title="Seleccionar ocupados" className="text-gray-400 hover:text-gray-700">
                      <CheckSquare size={14} />
                    </button>
                  </th>
                  <th className="py-4 px-3 text-center w-12"># Cupo</th>
                  <th className="py-4 px-4 min-w-[210px]">Pasajero (Nombre y Documento)</th>
                  <th className="py-4 px-4 min-w-[150px]">Agencia y Ciudad</th>
                  <th className="py-4 px-4">Nº Cotización</th>
                  <th className="py-4 px-4 min-w-[130px]">Operativo y Vendedor</th>
                  <th className="py-4 px-4 min-w-[160px]">Hotel y Habitación</th>
                  <th className="py-4 px-4 min-w-[160px]">Pagos y Cuotas</th>
                  <th className="py-4 px-4 text-right">Falta por Pagar</th>
                  <th className="py-4 px-4 min-w-[150px]">Notas</th>
                  <th className="py-4 px-4 text-center">Gestionar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-medium">
                {filteredSlots.map((slot, sIdx) => {
                  if (!slot) return null
                  const isOccupied = Boolean(slot.nombres && String(slot.nombres).trim() !== '')
                  const precio = Number(slot.precio_acordado) || 0
                  const isSelected = selectedSlotIds.includes(slot.id)
                  const planPagos = getSlotInstallments(slot) || []
                  const totalPagado = isOccupied
                    ? (Array.isArray(planPagos) && planPagos.length > 0
                        ? planPagos.filter(p => p && p.estado === 'pagado').reduce((acc, p) => acc + (Number(p?.monto) || 0), 0)
                        : (Number(slot.abono_1) || 0) + (Number(slot.abono_2) || 0) + (Number(slot.abono_3) || 0))
                    : 0
                  const realFaltante = isOccupied ? Math.max(0, precio - totalPagado) : 0
                  const isPaid = isOccupied && realFaltante === 0 && precio > 0
                  const readiness = getDataReadiness(slot) || { status: 'libre', label: 'Disponible', color: 'bg-gray-100 text-gray-500 border-gray-200' }

                  return (
                    <tr
                      key={slot?.id || `cupo-${slot?.numero_cupo || sIdx}`}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-purple-50/60' : !isOccupied ? 'bg-gray-50/20 text-gray-400' : 'text-gray-800'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        {isOccupied && (
                          <button
                            onClick={() => toggleSelectSlot(slot.id)}
                            className="text-gray-400 hover:text-primary transition-colors"
                          >
                            {isSelected ? <CheckSquare size={16} className="text-purple-600" /> : <Square size={16} />}
                          </button>
                        )}
                      </td>

                      {/* # PAX */}
                      <td className="py-3 px-3 text-center font-black">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs ${
                          isOccupied ? 'bg-primary/10 text-primary font-black' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {slot.numero_cupo}
                        </span>
                      </td>

                      {/* Pasajero & Documentación */}
                      <td className="py-3 px-4">
                        {isOccupied ? (
                          <div>
                            <p className="font-black text-gray-900 leading-tight uppercase">
                              {slot.nombres} {slot.apellidos || ''}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {slot.grupo_nombre && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/50">
                                  <Users size={10} /> {slot.grupo_nombre}
                                </span>
                              )}
                              <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${readiness?.color || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                {readiness?.label || 'Disponible'}
                              </span>
                            </div>
                            {slot.numero_documento && (
                              <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                                {slot.tipo_documento || 'Doc'}: <span className="font-mono text-gray-800">{slot.numero_documento}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 italic flex items-center gap-1 text-[11px]">
                            <Plus size={12} /> Cupo Disponible
                          </span>
                        )}
                      </td>

                      {/* Agencia & Ciudad */}
                      <td className="py-3 px-4">
                        {isOccupied ? (
                          <div>
                            <p className="font-bold text-gray-800 leading-tight">{slot.agencia || 'Directo'}</p>
                            {slot.ciudad && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                                {slot.ciudad}
                              </span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Cotización */}
                      <td className="py-3 px-4">
                        {slot.codigo_cotizacion ? (
                          <span className="font-mono text-[11px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg">
                            {slot.codigo_cotizacion}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Operativo & Comercial */}
                      <td className="py-3 px-4">
                        {isOccupied ? (
                          <div>
                            <p className="font-bold text-gray-800 text-[11px]">Op: {slot.operativo_nombre || 'S/A'}</p>
                            <p className="text-gray-500 text-[10px]">Com: {slot.comercial_nombre || 'S/A'}</p>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Hotel & Categoría */}
                      <td className="py-3 px-4">
                        {isOccupied ? (
                          <div>
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                (slot.categoria_habitacion || '').includes('Clase 1')
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : (slot.categoria_habitacion || '').includes('Clase 3')
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : (slot.categoria_habitacion || '').includes('VIP')
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}>
                                {slot.categoria_habitacion || 'Clase 2 (Estándar / 4★)'}
                              </span>
                            </div>
                            <p className="font-bold text-gray-800 text-[11px] leading-tight">
                              Hab. {slot.tipo_habitacion || 'Doble'} · <span className="text-gray-600 font-medium">{slot.hoteles || 'Estándar'}</span>
                            </p>
                            <span className="text-[10px] text-gray-400 block mt-0.5">{slot.tipo_servicio}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Plan de Pagos Dinámico */}
                      <td className="py-3 px-4">
                        {isOccupied ? (
                          <div>
                            <div className="flex items-center gap-1 text-xs font-black text-gray-900">
                              <span>${totalPagado.toLocaleString('es-EC')}</span>
                              <span className="text-gray-400 font-normal">de ${precio.toLocaleString('es-EC')}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {planPagos.length} {planPagos.length === 1 ? 'cuota' : 'cuotas'}
                              </span>
                              {slot.fecha_limite_pago_agencia && (
                                <span className="text-[10px] text-amber-700 font-bold">
                                  Cobro: {slot.fecha_limite_pago_agencia}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Faltante */}
                      <td className="py-3 px-4 text-right">
                        {isOccupied ? (
                          <div>
                            <span className={`font-mono font-black text-sm ${realFaltante === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              ${realFaltante.toLocaleString('es-EC')}
                            </span>
                            <span className={`block text-[9px] font-black uppercase tracking-wider ${
                              isPaid ? 'text-emerald-600' : 'text-amber-600'
                            }`}>
                              {isPaid ? '✓ PAGADO' : 'PENDIENTE'}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Observaciones */}
                      <td className="py-3 px-4 text-[11px] text-gray-600 max-w-[200px] truncate">
                        {slot.observaciones || '—'}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenSingleSlot(slot)}
                            className="p-2 rounded-xl bg-gray-50 hover:bg-primary hover:text-white text-gray-600 transition-colors shadow-sm"
                            title="Editar / Asignar Pasajero"
                          >
                            <Edit3 size={14} />
                          </button>
                          {isOccupied && (
                            <>
                              <button
                                onClick={() => handleSharePassengerWhatsApp(slot)}
                                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 transition-colors shadow-sm"
                                title="Enviar Comprobante WhatsApp a la Agencia"
                              >
                                <Share2 size={14} />
                              </button>
                              <button
                                onClick={() => handleReleaseSlot(slot)}
                                className="p-2 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                                title="Liberar Cupo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: INGRESO INDIVIDUAL (PERSONA POR PERSONA) */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight">
                    Ingreso Individual · Cupo #{selectedSlotNumber}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {bloqueo.titulo} · Tarifa Base: ${bloqueo.precio_venta_pax} USD
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSingleModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSingleBooking} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Autocompletar desde Excel / Portapapeles */}
              <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-emerald-700" />
                    <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                      Autocompletar datos desde Excel o Portapapeles
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    Búsqueda inteligente
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-snug">
                  Copia una fila de Excel o texto del pasajero (Nombre, Cédula, Agencia, Ciudad, Habitación, Hotel, Abonos) y pégala aquí:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Pega aquí (ej: 1  CARLOS MENDOZA  0923847581  INOVA TOURS  GYE  TWIN  GIMANI  500)..."
                    value={singlePasteText}
                    onChange={(e) => setSinglePasteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleInterpretSinglePaste()
                      }
                    }}
                    className="input flex-1 bg-white text-gray-900 border border-emerald-300 font-mono text-xs focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleInterpretSinglePaste}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
                  >
                    <Zap size={14} />
                    <span>Interpretar</span>
                  </button>
                </div>
                {singlePasteDetectedInfo && (
                  <div className="text-[11px] text-emerald-900 font-bold bg-white/90 border border-emerald-200 rounded-xl p-2 flex items-center gap-2">
                    <Check size={14} className="text-emerald-600 shrink-0" />
                    <span>{singlePasteDetectedInfo}</span>
                  </div>
                )}
              </div>

              {/* Agencia & Trazabilidad */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-2">
                  1. Agencia y Trazabilidad Comercial
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Agencia Solicitante *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Inova Viajes"
                      value={singleForm.agencia}
                      onChange={(e) => setSingleForm({ ...singleForm, agencia: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Ciudad *</label>
                    <select
                      value={singleForm.ciudad}
                      onChange={(e) => setSingleForm({ ...singleForm, ciudad: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    >
                      <option value="GYE">Guayaquil (GYE)</option>
                      <option value="UIO">Quito (UIO)</option>
                      <option value="CUE">Cuenca (CUE)</option>
                      <option value="Nacional">Nacional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Código Cotización</label>
                    <input
                      type="text"
                      placeholder="CTB-BLQ-XXXX"
                      value={singleForm.codigo_cotizacion}
                      onChange={(e) => setSingleForm({ ...singleForm, codigo_cotizacion: e.target.value.toUpperCase() })}
                      className="input w-full uppercase font-mono font-bold bg-white text-gray-900 border border-gray-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Operativo Asignado</label>
                    <select
                      value={singleForm.operativo_id}
                      onChange={(e) => {
                        const op = operativosList.find(o => o.id === e.target.value)
                        setSingleForm({ ...singleForm, operativo_id: e.target.value, operativo_nombre: op?.nombre || '' })
                      }}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    >
                      <option value="">Seleccionar operativo...</option>
                      {operativosList.map(op => (
                        <option key={op.id} value={op.id}>{op.nombre} ({op.ciudad || 'EC'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Comercial</label>
                    <select
                      value={singleForm.comercial_id}
                      onChange={(e) => {
                        const com = comercialesList.find(c => c.id === e.target.value)
                        setSingleForm({ ...singleForm, comercial_id: e.target.value, comercial_nombre: com?.nombre || '' })
                      }}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    >
                      <option value="">Seleccionar comercial...</option>
                      {comercialesList.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Tipo de Servicio</label>
                    <input
                      type="text"
                      value={singleForm.tipo_servicio}
                      onChange={(e) => setSingleForm({ ...singleForm, tipo_servicio: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Ficha Pasajero (Aerolínea) */}
              <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-800 flex items-center gap-1.5">
                    <Plane size={14} className="text-primary" /> 2. Ficha de Pasajero (Datos de Aerolínea)
                  </h4>
                  <span className="text-[10px] text-gray-500 font-semibold">Campos opcionales / editables</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Nombres</label>
                    <input
                      type="text"
                      placeholder="Ej. MERCY JULIA"
                      value={singleForm.nombres}
                      onChange={(e) => setSingleForm({ ...singleForm, nombres: e.target.value.toUpperCase() })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-bold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Apellidos</label>
                    <input
                      type="text"
                      placeholder="Ej. BARRA CEVALLOS"
                      value={singleForm.apellidos}
                      onChange={(e) => setSingleForm({ ...singleForm, apellidos: e.target.value.toUpperCase() })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-bold uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Tipo Documento</label>
                    <select
                      value={singleForm.tipo_documento}
                      onChange={(e) => setSingleForm({ ...singleForm, tipo_documento: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    >
                      <option value="Cédula">Cédula</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="DNI">DNI / Extranjero</option>
                      <option value="RUC">RUC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Número Documento</label>
                    <input
                      type="text"
                      placeholder={singleForm.tipo_documento === 'Pasaporte' ? 'Ej. A12345678' : '0912345678'}
                      value={singleForm.numero_documento}
                      onChange={(e) => setSingleForm({ ...singleForm, numero_documento: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1 flex items-center justify-between">
                      <span>Tipo Habitación</span>
                      {selectedSingleHotelObj && (
                        <span className="text-[10px] text-blue-600 font-bold truncate max-w-[120px]">
                          {selectedSingleHotelObj.nombre}
                        </span>
                      )}
                    </label>
                    <select
                      value={singleForm.tipo_habitacion}
                      onChange={(e) => handleSingleRoomSelect(e.target.value)}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-bold"
                    >
                      {availableSingleRooms.map((r, i) => (
                        <option key={r.id || i} value={r.tipo}>
                          {r.tipo} {r.precio ? `($${Number(r.precio).toLocaleString('es-EC')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-amber-900 font-black mb-1 flex items-center gap-1">
                      <Star size={12} className="text-amber-500 fill-amber-500" /> Categoría Hotel (Estrellas)
                    </label>
                    <select
                      value={singleForm.categoria_habitacion || 'Clase 2 (Estándar / 4★)'}
                      onChange={(e) => setSingleForm({ ...singleForm, categoria_habitacion: e.target.value })}
                      className="input w-full bg-amber-50/50 text-gray-900 border border-amber-300 font-bold text-xs"
                    >
                      <option value="Clase 1 (Económica / 3★)">⭐ Clase 1 (Económica / 3★)</option>
                      <option value="Clase 2 (Estándar / 4★)">⭐⭐ Clase 2 (Estándar / 4★)</option>
                      <option value="Clase 3 (Superior / 5★)">⭐⭐⭐ Clase 3 (Superior / 5★)</option>
                      <option value="Clase VIP / Luxury">👑 Clase VIP / Luxury</option>
                    </select>
                  </div>
                </div>

                {/* Additional Airline Data */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Fecha Nacimiento</label>
                    <input
                      type="date"
                      value={singleForm.fecha_nacimiento || ''}
                      onChange={(e) => setSingleForm({ ...singleForm, fecha_nacimiento: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">
                      {singleForm.tipo_documento === 'Pasaporte' ? 'Caducidad Pasaporte *' : 'Caducidad Doc.'}
                    </label>
                    <input
                      type="date"
                      value={singleForm.caducidad_pasaporte || ''}
                      onChange={(e) => setSingleForm({ ...singleForm, caducidad_pasaporte: e.target.value })}
                      className={`input w-full bg-white text-gray-900 border font-semibold ${
                        isPassportExpiringSoon ? 'border-amber-400 bg-amber-50/40' : 'border-gray-200'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Nacionalidad</label>
                    <input
                      type="text"
                      placeholder="ECUATORIANA"
                      value={singleForm.nacionalidad || 'ECUATORIANA'}
                      onChange={(e) => setSingleForm({ ...singleForm, nacionalidad: e.target.value.toUpperCase() })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Género</label>
                    <select
                      value={singleForm.genero || 'M'}
                      onChange={(e) => setSingleForm({ ...singleForm, genero: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    >
                      <option value="M">Masculino (M)</option>
                      <option value="F">Femenino (F)</option>
                    </select>
                  </div>
                </div>

                {/* IATA Passport Warning */}
                {singleForm.tipo_documento === 'Pasaporte' && singleForm.caducidad_pasaporte && isPassportExpiringSoon && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5 text-xs font-medium">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">¡Advertencia IATA / Migración!</strong>
                      <p className="mt-0.5 text-amber-800">
                        El pasaporte vence en menos de 6 meses respecto a la fecha de salida del vuelo ({bloqueo?.fecha_salida || 'próxima'}). La aerolínea o migración podrían impedir el embarque.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Hoteles y Plan de Pagos Ilimitado */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-800 flex items-center gap-1.5">
                    <CreditCard size={14} /> 3. Hoteles & Plan de Pagos Ilimitado
                  </h4>
                  <button
                    type="button"
                    onClick={addSingleInstallment}
                    className="text-xs font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200"
                  >
                    + Agregar Cuota / Abono
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Hotel size={13} className="text-blue-600" /> Hotel Asignado
                      </span>
                      {selectedSingleHotelObj && (() => {
                        const hKey = (selectedSingleHotelObj.nombre || '').trim().toLowerCase()
                        const stat = hotelStats[hKey]
                        const tot = Number(selectedSingleHotelObj.cupos) || 0
                        const disp = stat ? stat.disponibles : tot
                        return (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tot > 0 && disp <= 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                            {tot > 0 ? `${disp} de ${tot} cupos disponibles` : `🌐 Cupo Abierto (${metrics.disponibles} libres)`}
                          </span>
                        )
                      })()}
                    </label>
                    {configuredHoteles.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          value={configuredHoteles.some(h => h.nombre === singleForm.hoteles) ? singleForm.hoteles : (singleForm.hoteles ? '__custom__' : '')}
                          onChange={(e) => handleSingleHotelSelect(e.target.value)}
                          className="input w-full bg-white text-gray-900 border border-gray-200 font-bold"
                        >
                          <option value="">-- Seleccionar Hotel del Bloqueo --</option>
                          {configuredHoteles.map(h => {
                            const hKey = (h?.nombre || '').trim().toLowerCase()
                            const stat = hotelStats[hKey]
                            const tot = Number(h.cupos) || 0
                            const disp = stat ? stat.disponibles : tot
                            const isAgotado = tot > 0 && disp <= 0
                            return (
                              <option key={h.id} value={h.nombre} disabled={isAgotado && singleForm.hoteles !== h.nombre}>
                                {h.nombre} ({h.categoria?.split(' ')[0] || '4★'}) {tot > 0 ? `· [${disp}/${tot} disp.]` : '· [🌐 Cupo Abierto]'} {isAgotado ? '❌ ¡AGOTADO!' : ''}
                              </option>
                            )
                          })}
                          <option value="__custom__">➕ Otro hotel no listado...</option>
                        </select>

                        {(!configuredHoteles.some(h => h.nombre === singleForm.hoteles) || singleForm.hoteles === '__custom__') && (
                          <input
                            type="text"
                            placeholder="Escribe el nombre del hotel..."
                            value={singleForm.hoteles === '__custom__' ? '' : singleForm.hoteles}
                            onChange={(e) => setSingleForm({ ...singleForm, hoteles: e.target.value })}
                            className="input w-full bg-gray-50 text-gray-900 border border-gray-300 font-semibold text-xs"
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Ej. Hotel Decameron Barú"
                        value={singleForm.hoteles}
                        onChange={(e) => setSingleForm({ ...singleForm, hoteles: e.target.value })}
                        className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-gray-800 font-black mb-1">Precio Total Acordado ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={singleForm.precio_acordado}
                      onChange={(e) => setSingleForm({ ...singleForm, precio_acordado: e.target.value })}
                      className="input w-full bg-white text-primary font-black text-sm border border-gray-200"
                    />
                  </div>
                </div>

                {/* Dynamic Installments List */}
                <div className="space-y-2 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                  {singleForm.plan_pagos.map((item, index) => (
                    <div key={item.id} className="flex flex-col sm:flex-row items-center gap-2 bg-white p-2.5 rounded-xl border border-emerald-200/70 shadow-sm">
                      <div className="w-full sm:w-44">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateSingleInstallment(item.id, 'label', e.target.value)}
                          placeholder={`Cuota ${index + 1}`}
                          className="input w-full py-1 text-xs font-bold text-gray-800 bg-gray-50 border-gray-200"
                        />
                      </div>

                      <div className="relative w-full sm:w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Monto"
                          value={item.monto}
                          onChange={(e) => updateSingleInstallment(item.id, 'monto', e.target.value)}
                          className="input w-full py-1 pl-6 text-xs font-black text-emerald-800 bg-white border-gray-200"
                        />
                      </div>

                      <div className="w-full sm:w-36">
                        <input
                          type="date"
                          value={item.fecha}
                          onChange={(e) => updateSingleInstallment(item.id, 'fecha', e.target.value)}
                          className="input w-full py-1 text-xs font-semibold text-gray-800 bg-white border-gray-200"
                        />
                      </div>

                      <div className="w-full sm:w-28">
                        <select
                          value={item.estado}
                          onChange={(e) => updateSingleInstallment(item.id, 'estado', e.target.value)}
                          className={`input w-full py-1 text-xs font-black border ${
                            item.estado === 'pagado' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <option value="pagado">Pagado</option>
                          <option value="pendiente">Pendiente</option>
                        </select>
                      </div>

                      {singleForm.plan_pagos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSingleInstallment(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Fecha Compromiso Cobro Agencia</label>
                    <input
                      type="date"
                      value={singleForm.fecha_limite_pago_agencia}
                      onChange={(e) => setSingleForm({ ...singleForm, fecha_limite_pago_agencia: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Observaciones</label>
                    <input
                      type="text"
                      placeholder="Notas de habitaciones, traslados..."
                      value={singleForm.observaciones}
                      onChange={(e) => setSingleForm({ ...singleForm, observaciones: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSingleModal(false)}
                  className="px-5 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary px-7 py-3 rounded-2xl font-black uppercase tracking-wider shadow-lg shadow-primary/25"
                >
                  {saving ? 'Guardando...' : 'Guardar Pasajero'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INGRESO POR GRUPO (NOMBRE POR NOMBRE) */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-purple-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight">
                    Ingreso por Grupo (Nombre por Nombre)
                  </h3>
                  <p className="text-xs text-purple-800 font-medium">
                    {bloqueo.titulo} · Asigna múltiples cupos y crea el grupo en un solo paso.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGroupModal(false)}
                className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGroupBooking} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Grupo Name & Agencia */}
              <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-purple-950 font-black mb-1">Nombre del Grupo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Tercera Edad Cuenca"
                      value={groupForm.grupo_nombre}
                      onChange={(e) => setGroupForm({ ...groupForm, grupo_nombre: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-purple-200 font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Agencia Solicitante *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Jennifer Castro / Inova"
                      value={groupForm.agencia}
                      onChange={(e) => setGroupForm({ ...groupForm, agencia: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Ciudad *</label>
                    <select
                      value={groupForm.ciudad}
                      onChange={(e) => setGroupForm({ ...groupForm, ciudad: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    >
                      <option value="GYE">Guayaquil (GYE)</option>
                      <option value="UIO">Quito (UIO)</option>
                      <option value="CUE">Cuenca (CUE)</option>
                      <option value="Nacional">Nacional</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Operativo</label>
                    <select
                      value={groupForm.operativo_id}
                      onChange={(e) => {
                        const op = operativosList.find(o => o.id === e.target.value)
                        setGroupForm({ ...groupForm, operativo_id: e.target.value, operativo_nombre: op?.nombre || '' })
                      }}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    >
                      <option value="">Seleccionar...</option>
                      {operativosList.map(op => (
                        <option key={op.id} value={op.id}>{op.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Comercial</label>
                    <select
                      value={groupForm.comercial_id}
                      onChange={(e) => {
                        const com = comercialesList.find(c => c.id === e.target.value)
                        setGroupForm({ ...groupForm, comercial_id: e.target.value, comercial_nombre: com?.nombre || '' })
                      }}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    >
                      <option value="">Seleccionar...</option>
                      {comercialesList.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-gray-800 font-bold mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Hotel size={13} className="text-purple-600" /> Hotel Asignado
                      </span>
                      {selectedGroupHotelObj && (() => {
                        const hKey = (selectedGroupHotelObj.nombre || '').trim().toLowerCase()
                        const stat = hotelStats[hKey]
                        const tot = Number(selectedGroupHotelObj.cupos) || 0
                        const disp = stat ? stat.disponibles : tot
                        const isOver = tot > 0 && groupForm.pasajeros_lista.length > disp
                        return (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOver ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                            {tot > 0 ? `${disp} de ${tot} cupos disponibles` : `🌐 Cupo Abierto (${metrics.disponibles} libres)`}
                          </span>
                        )
                      })()}
                    </label>
                    {configuredHoteles.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          value={configuredHoteles.some(h => h.nombre === groupForm.hoteles) ? groupForm.hoteles : (groupForm.hoteles ? '__custom__' : '')}
                          onChange={(e) => handleGroupHotelSelect(e.target.value)}
                          className="input w-full bg-white text-gray-900 border border-gray-200 font-bold"
                        >
                          <option value="">-- Seleccionar Hotel --</option>
                          {configuredHoteles.map(h => {
                            const hKey = (h?.nombre || '').trim().toLowerCase()
                            const stat = hotelStats[hKey]
                            const tot = Number(h.cupos) || 0
                            const disp = stat ? stat.disponibles : tot
                            const isAgotado = tot > 0 && disp <= 0
                            const notEnough = tot > 0 && disp < groupForm.pasajeros_lista.length
                            return (
                              <option key={h.id} value={h.nombre} disabled={isAgotado && groupForm.hoteles !== h.nombre}>
                                {h.nombre} ({h.categoria?.split(' ')[0] || '4★'}) {tot > 0 ? `· [${disp}/${tot} disp.]` : '· [🌐 Cupo Abierto]'} {isAgotado ? '❌ ¡AGOTADO!' : (notEnough ? '⚠️ Cupos insuficientes' : '')}
                              </option>
                            )
                          })}
                          <option value="__custom__">➕ Otro hotel no listado...</option>
                        </select>

                        {selectedGroupHotelObj && Number(selectedGroupHotelObj.cupos) > 0 && groupForm.pasajeros_lista.length > (hotelStats[(selectedGroupHotelObj.nombre || '').trim().toLowerCase()]?.disponibles ?? 0) && (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 flex items-center gap-1.5 font-bold">
                            <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                            <span>Alerta: El grupo ({groupForm.pasajeros_lista.length} pax) supera los {hotelStats[(selectedGroupHotelObj.nombre || '').trim().toLowerCase()]?.disponibles ?? 0} cupos libres de este hotel.</span>
                          </div>
                        )}

                        {(!configuredHoteles.some(h => h.nombre === groupForm.hoteles) || groupForm.hoteles === '__custom__') && (
                          <input
                            type="text"
                            placeholder="Escribe el nombre del hotel..."
                            value={groupForm.hoteles === '__custom__' ? '' : groupForm.hoteles}
                            onChange={(e) => setGroupForm({ ...groupForm, hoteles: e.target.value })}
                            className="input w-full bg-gray-50 text-gray-900 border border-gray-300 font-semibold text-xs"
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Ej. Hotel Decameron Barú"
                        value={groupForm.hoteles}
                        onChange={(e) => setGroupForm({ ...groupForm, hoteles: e.target.value })}
                        className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-amber-900 font-bold mb-1 flex items-center gap-1">
                      <Star size={12} className="text-amber-500 fill-amber-500" /> Categoría Base
                    </label>
                    <select
                      value={groupForm.categoria_habitacion || 'Clase 2 (Estándar / 4★)'}
                      onChange={(e) => setGroupForm({ ...groupForm, categoria_habitacion: e.target.value })}
                      className="input w-full bg-amber-50/50 text-gray-900 border border-amber-300 font-bold"
                    >
                      <option value="Clase 1 (Económica / 3★)">⭐ Clase 1 (3★)</option>
                      <option value="Clase 2 (Estándar / 4★)">⭐⭐ Clase 2 (4★)</option>
                      <option value="Clase 3 (Superior / 5★)">⭐⭐⭐ Clase 3 (5★)</option>
                      <option value="Clase VIP / Luxury">👑 Clase VIP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-800 font-black mb-1">Precio por PAX ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={groupForm.precio_por_pax}
                      onChange={(e) => setGroupForm({ ...groupForm, precio_por_pax: e.target.value })}
                      className="input w-full bg-white text-primary font-black border border-gray-200"
                    />
                  </div>
                </div>
              </div>

              {/* LISTA DE PASAJEROS NOMBRE POR NOMBRE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-900 flex items-center gap-1.5">
                    <Users size={15} className="text-purple-600" />
                    Pasajeros del Grupo ({groupForm.pasajeros_lista.length} cupos a ocupar)
                  </h4>
                  <button
                    type="button"
                    onClick={addGroupPassenger}
                    className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-black text-xs uppercase tracking-wider border border-purple-200"
                  >
                    + Agregar Otro Pasajero
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {groupForm.pasajeros_lista.map((pax, idx) => (
                    <div key={pax.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 text-[11px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="Nombres *"
                        value={pax.nombres}
                        onChange={(e) => updateGroupPassenger(pax.id, 'nombres', e.target.value.toUpperCase())}
                        className="input flex-1 py-1.5 text-xs font-bold uppercase bg-white text-gray-900 border border-gray-200"
                      />
                      <input
                        type="text"
                        placeholder="Apellidos"
                        value={pax.apellidos}
                        onChange={(e) => updateGroupPassenger(pax.id, 'apellidos', e.target.value.toUpperCase())}
                        className="input flex-1 py-1.5 text-xs font-bold uppercase bg-white text-gray-900 border border-gray-200"
                      />
                      <input
                        type="text"
                        placeholder="Cédula / Pasaporte (Opcional)"
                        value={pax.numero_documento}
                        onChange={(e) => updateGroupPassenger(pax.id, 'numero_documento', e.target.value)}
                        className="input w-36 py-1.5 text-xs bg-white text-gray-900 border border-gray-200"
                      />
                      <select
                        value={pax.tipo_habitacion}
                        onChange={(e) => updateGroupPassenger(pax.id, 'tipo_habitacion', e.target.value)}
                        className="input w-32 py-1.5 text-xs font-bold bg-white text-gray-900 border border-gray-200"
                      >
                        {availableGroupRooms.map((r, i) => (
                          <option key={r.id || i} value={r.tipo}>
                            {r.tipo} {r.precio ? `($${r.precio})` : ''}
                          </option>
                        ))}
                      </select>
                      <select
                        value={pax.categoria_habitacion || groupForm.categoria_habitacion || 'Clase 2 (Estándar / 4★)'}
                        onChange={(e) => updateGroupPassenger(pax.id, 'categoria_habitacion', e.target.value)}
                        className="input w-32 py-1.5 text-xs font-bold bg-amber-50/50 text-gray-900 border border-amber-300"
                        title="Categoría de Hotel / Estrellas"
                      >
                        <option value="Clase 1 (Económica / 3★)">⭐ Cl. 1 (3★)</option>
                        <option value="Clase 2 (Estándar / 4★)">⭐⭐ Cl. 2 (4★)</option>
                        <option value="Clase 3 (Superior / 5★)">⭐⭐⭐ Cl. 3 (5★)</option>
                        <option value="Clase VIP / Luxury">👑 VIP / Lux</option>
                      </select>
                      {groupForm.pasajeros_lista.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGroupPassenger(pax.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* PLAN DE PAGOS DEL GRUPO (ILIMITADO) */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-900 flex items-center gap-1.5">
                    <DollarSign size={14} /> Plan de Pagos del Grupo
                  </h4>
                  <button
                    type="button"
                    onClick={addGroupInstallment}
                    className="px-2.5 py-1 rounded-xl bg-white text-emerald-800 font-bold text-xs border border-emerald-200 shadow-sm"
                  >
                    + Agregar Cuota
                  </button>
                </div>

                <div className="space-y-2">
                  {groupForm.plan_pagos.map((item, index) => (
                    <div key={item.id} className="flex flex-col sm:flex-row items-center gap-2 bg-white p-2.5 rounded-xl border border-emerald-200/70 shadow-sm">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateGroupInstallment(item.id, 'label', e.target.value)}
                        placeholder={`Cuota ${index + 1}`}
                        className="input w-full sm:w-44 py-1 text-xs font-bold bg-gray-50 text-gray-800 border-gray-200"
                      />
                      <div className="relative w-full sm:w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Monto"
                          value={item.monto}
                          onChange={(e) => updateGroupInstallment(item.id, 'monto', e.target.value)}
                          className="input w-full py-1 pl-6 text-xs font-black text-emerald-800 bg-white border-gray-200"
                        />
                      </div>
                      <input
                        type="date"
                        value={item.fecha}
                        onChange={(e) => updateGroupInstallment(item.id, 'fecha', e.target.value)}
                        className="input w-full sm:w-36 py-1 text-xs font-semibold bg-white text-gray-800 border-gray-200"
                      />
                      <select
                        value={item.estado}
                        onChange={(e) => updateGroupInstallment(item.id, 'estado', e.target.value)}
                        className="input w-full sm:w-28 py-1 text-xs font-black bg-white border-gray-200 text-gray-900"
                      >
                        <option value="pagado">Pagado</option>
                        <option value="pendiente">Pendiente</option>
                      </select>
                      {groupForm.plan_pagos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGroupInstallment(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-5 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary px-7 py-3 rounded-2xl font-black uppercase tracking-wider shadow-lg shadow-primary/25 bg-purple-700 hover:bg-purple-800"
                >
                  {saving ? 'Registrando Grupo...' : `Asignar Grupo (${groupForm.pasajeros_lista.length} PAX)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: AGRUPAR PASAJEROS EXISTENTES */}
      {showGroupExistingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-gray-100 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
                <FolderPlus size={18} className="text-purple-600" />
                Agrupar {selectedSlotIds.length} Pasajeros
              </h3>
              <button
                onClick={() => setShowGroupExistingModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Asigna un nombre común a los pasajeros seleccionados para identificarlos como grupo (ej. <em>Tercera Edad GYE</em>, <em>Familia Gómez</em>).
            </p>

            <form onSubmit={handleGroupExisting} className="space-y-4">
              <div>
                <label className="block text-gray-800 font-black text-xs mb-1">Nombre del Grupo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Tercera Edad GYE"
                  value={existingGroupName}
                  onChange={(e) => setExistingGroupName(e.target.value)}
                  className="input w-full bg-white text-gray-900 border border-purple-200 font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGroupExistingModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-purple-700 hover:bg-purple-800"
                >
                  Guardar Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GDS: MANIFIESTO AÉREO */}
      {showGdsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black">
                  <Plane size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
                    Manifiesto Aéreo & Formato GDS
                  </h3>
                  <p className="text-xs text-blue-800 font-medium">
                    {bloqueo?.titulo} ({bloqueo?.codigo}) · {gdsManifestData.totalPax} Pasajeros Registrados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGdsModal(false)}
                className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Tabs de Formato */}
              <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setGdsFormat('amadeus')}
                  className={`flex-1 py-2 px-3 rounded-xl font-black text-xs transition-all ${
                    gdsFormat === 'amadeus'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Amadeus / Sabre (GDS)
                </button>
                <button
                  type="button"
                  onClick={() => setGdsFormat('web')}
                  className={`flex-1 py-2 px-3 rounded-xl font-black text-xs transition-all ${
                    gdsFormat === 'web'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Excel Web (Tabular)
                </button>
                <button
                  type="button"
                  onClick={() => setGdsFormat('simple')}
                  className={`flex-1 py-2 px-3 rounded-xl font-black text-xs transition-all ${
                    gdsFormat === 'simple'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Texto Limpio (WhatsApp)
                </button>
              </div>

              {/* Guía informativa */}
              <div className="text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200">
                {gdsFormat === 'amadeus' && (
                  <p>
                    📌 <strong>Formato Estándar IATA:</strong> <code>ORDEN.APELLIDO/NOMBRE TITULO - DOC - DOB</code>. Listo para ingresar en consolas Amadeus, Sabre o Kiu.
                  </p>
                )}
                {gdsFormat === 'web' && (
                  <p>
                    📌 <strong>Formato Tabular:</strong> Columnas separadas por tabulaciones. Selecciona, copia y pega directamente en portales de emisión de aerolíneas o Excel.
                  </p>
                )}
                {gdsFormat === 'simple' && (
                  <p>
                    📌 <strong>Texto Limpio:</strong> Resumen enumerado con nombres completos, documentos y tipo de habitación. Ideal para WhatsApp o correos de confirmación.
                  </p>
                )}
              </div>

              {/* Textarea Preview */}
              <div>
                <label className="block text-gray-700 font-bold mb-1">
                  Vista Previa del Manifiesto ({gdsManifestData.totalPax} PAX)
                </label>
                <textarea
                  readOnly
                  rows={10}
                  value={gdsManifestData[gdsFormat] || 'No hay pasajeros registrados con nombre en este bloqueo.'}
                  className="w-full p-3 font-mono text-xs bg-gray-900 text-emerald-400 rounded-2xl border border-gray-800 focus:outline-none selection:bg-emerald-700 selection:text-white"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-[11px] text-gray-400 font-medium">
                {gdsManifestData.totalPax} pasajeros en lista
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGdsModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={gdsManifestData.totalPax === 0}
                  onClick={() => {
                    const content = gdsManifestData[gdsFormat]
                    if (!content) return
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(content).then(() => {
                        setCopiedGds(true)
                        showToast('¡Manifiesto copiado al portapapeles con éxito!', 'success')
                        setTimeout(() => setCopiedGds(false), 2500)
                      })
                    }
                  }}
                  className={`btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider ${
                    copiedGds ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {copiedGds ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedGds ? '¡Copiado!' : 'Copiar al Portapapeles'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASIGNACIÓN MASIVA DE HOTEL */}
      {showBatchHotelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-gray-100 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  <Hotel size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight">
                    Asignar Hotel en Bloque
                  </h3>
                  <p className="text-xs text-blue-700 font-medium">
                    {selectedSlotIds.length} pasajeros seleccionados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchHotelModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Aplica hotel y acomodación al mismo tiempo a todos los cupos seleccionados.
            </p>

            <form onSubmit={handleBatchAssignHotel} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-800 font-black mb-1">Hotel Destino *</label>
                {configuredHoteles && configuredHoteles.length > 0 ? (
                  <select
                    value={batchHotelForm.hotel}
                    onChange={(e) => setBatchHotelForm({ ...batchHotelForm, hotel: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-blue-200 font-bold"
                    required
                  >
                    <option value="">-- Seleccionar de los hoteles contratados --</option>
                    {configuredHoteles.map((h, i) => (
                      <option key={i} value={h.nombre}>
                        {h.nombre} ({h.cupos || 0} cupos contratados)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Ej. Hotel Decameron Punta Centinela"
                    value={batchHotelForm.hotel}
                    onChange={(e) => setBatchHotelForm({ ...batchHotelForm, hotel: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-blue-200 font-bold"
                  />
                )}
              </div>

              <div>
                <label className="block text-gray-800 font-black mb-1">Tipo de Habitación</label>
                <select
                  value={batchHotelForm.tipo_habitacion}
                  onChange={(e) => setBatchHotelForm({ ...batchHotelForm, tipo_habitacion: e.target.value })}
                  className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                >
                  <option value="Doble">Doble (2 personas)</option>
                  <option value="Simple">Simple (SGL - 1 persona)</option>
                  <option value="Triple">Triple (3 personas)</option>
                  <option value="Cuádruple">Cuádruple (4 personas)</option>
                  <option value="Matrimonial">Matrimonial (1 cama)</option>
                  <option value="Twin">Twin (2 camas separadas)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-800 font-black mb-1">Categoría del Hotel</label>
                <select
                  value={batchHotelForm.categoria_habitacion}
                  onChange={(e) => setBatchHotelForm({ ...batchHotelForm, categoria_habitacion: e.target.value })}
                  className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                >
                  <option value="Clase 1 (Económica / 3★)">⭐ Clase 1 (Económica / 3★)</option>
                  <option value="Clase 2 (Estándar / 4★)">⭐⭐ Clase 2 (Estándar / 4★)</option>
                  <option value="Clase 3 (Superior / 5★)">⭐⭐⭐ Clase 3 (Superior / 5★)</option>
                  <option value="Clase VIP / Luxury">👑 Clase VIP / Luxury</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBatchHotelModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-blue-600 hover:bg-blue-700 shadow-md"
                >
                  {saving ? 'Guardando...' : 'Aplicar a Selección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: IMPORTACIÓN INTELIGENTE DESDE EXCEL / PORTAPAPELES */}
      {(showExcelImportModal || showQuickPasteModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/30">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
                    Importar Pasajeros desde Excel o Portapapeles
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium">
                    {bloqueo.titulo} · Asigna automáticamente pasajeros y pagos a los cupos libres.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowExcelImportModal(false)
                  setShowQuickPasteModal(false)
                }}
                className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors shadow-xs"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Selector de Modo de Procesamiento */}
              <div className="bg-gray-50/90 border border-gray-200/90 rounded-2xl p-3.5 space-y-2">
                <label className="block text-gray-900 font-black text-xs uppercase tracking-wider">
                  Modo de Procesamiento:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExcelImportMode('sync')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                      excelImportMode === 'sync'
                        ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950 shadow-2xs'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <RefreshCw size={16} className={`shrink-0 mt-0.5 ${excelImportMode === 'sync' ? 'text-emerald-700' : 'text-gray-400'}`} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs">Sincronizar y Actualizar</span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-200/80 text-emerald-900">
                          Sin Duplicar
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                        Empareja por Nº de Cupo (# PAX) o Nombre. Si el cupo ya existe, actualiza nombres, abonos y hoteles sin duplicar.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExcelImportMode('append')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                      excelImportMode === 'append'
                        ? 'bg-blue-50/90 border-blue-400 text-blue-950 shadow-2xs'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Plus size={16} className={`shrink-0 mt-0.5 ${excelImportMode === 'append' ? 'text-blue-700' : 'text-gray-400'}`} />
                    <div>
                      <span className="font-black text-xs">Solo Asignar en Cupos Libres</span>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                        No toca ningún cupo existente. Rellena únicamente los cupos vacíos restantes del bloqueo.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Selector de Pestañas */}
              <div className="flex border-b border-gray-200 gap-6">
                <button
                  type="button"
                  onClick={() => setExcelImportTab('paste')}
                  className={`pb-3 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all relative ${
                    excelImportTab === 'paste'
                      ? 'text-emerald-700 border-b-2 border-emerald-600'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <FileSpreadsheet size={15} />
                  <span>Pegar desde Portapapeles / Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExcelImportTab('file')}
                  className={`pb-3 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all relative ${
                    excelImportTab === 'file'
                      ? 'text-emerald-700 border-b-2 border-emerald-600'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <UploadCloud size={15} />
                  <span>Subir Archivo (.xlsx / .csv)</span>
                </button>
              </div>

              {/* Pestaña 1: Pegar Texto */}
              {excelImportTab === 'paste' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-gray-800 font-black">
                      Copia las celdas en tu Excel y pégalas aquí:
                    </label>
                    <span className="text-[11px] text-gray-500 font-medium">
                      Soporta tablas con cabecera (# PAX, Nombres, Agencia, Hotel...) o filas directas
                    </span>
                  </div>
                  <textarea
                    rows={7}
                    value={excelImportRawText}
                    onChange={(e) => setExcelImportRawText(e.target.value)}
                    placeholder="Pega aquí la tabla o celdas copiadas de Excel o Google Sheets..."
                    className="w-full p-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-mono text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleParseExcelText}
                      disabled={isParsingExcelImport || !excelImportRawText.trim()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <Zap size={14} />
                      <span>{isParsingExcelImport ? 'Procesando...' : 'Interpretar Datos de Excel'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Pestaña 2: Subir Archivo */}
              {excelImportTab === 'file' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-3xl p-8 text-center bg-gray-50/60 hover:bg-emerald-50/30 transition-all cursor-pointer relative group">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                      <UploadCloud size={28} />
                    </div>
                    <p className="font-black text-gray-800 text-sm">
                      Haz clic para subir o arrastra tu archivo Excel
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      Archivos soportados: .xlsx, .xls, .csv
                    </p>
                  </div>
                </div>
              )}

              {/* Previsualización de Datos Interpretados */}
              {excelImportedData && (
                <div className="space-y-4 pt-3 border-t border-gray-100 animate-in fade-in duration-200">
                  {(() => {
                    const toUpdateCount = excelImportPlan.filter(it => it.isUpdate).length
                    const toAssignCount = excelImportPlan.filter(it => !it.isUpdate && it.targetSlot).length
                    const noSlotCount = excelImportPlan.filter(it => !it.targetSlot).length

                    return (
                      <>
                        {/* Tarjetas de Resumen */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                              Pasajeros en Excel
                            </p>
                            <p className="text-xl font-black text-emerald-900 mt-0.5">
                              {excelImportedData.passengers.length}
                            </p>
                          </div>

                          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                              <RefreshCw size={11} className="text-amber-600" />
                              <span>Se Actualizarán</span>
                            </p>
                            <p className="text-xl font-black text-amber-900 mt-0.5">
                              {toUpdateCount} cupos
                            </p>
                            <span className="text-[10px] text-amber-700 font-medium">Sin duplicar</span>
                          </div>

                          <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1">
                              <Plus size={11} className="text-blue-600" />
                              <span>Nuevos a Asignar</span>
                            </p>
                            <p className="text-xl font-black text-blue-900 mt-0.5">
                              {toAssignCount} cupos
                            </p>
                            <span className="text-[10px] text-blue-700 font-medium">En cupos libres</span>
                          </div>

                          <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                              Total en Abonos
                            </p>
                            <p className="text-xl font-black text-purple-900 mt-0.5">
                              ${excelImportedData.totalAbonado.toLocaleString('en-US')}
                            </p>
                          </div>
                        </div>

                        {noSlotCount > 0 && (
                          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                            <span>
                              Atención: Hay {noSlotCount} pasajeros del Excel que no tienen cupos disponibles en el bloqueo.
                            </span>
                          </div>
                        )}

                        {/* Tabla de Previsualización */}
                        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                          <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                            <span className="font-black text-gray-700 uppercase tracking-wider text-[11px]">
                              Previsualización de Sincronización ({excelImportPlan.length})
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {toUpdateCount} se actualizarán · {toAssignCount} nuevos cupos
                            </span>
                          </div>

                          <div className="max-h-60 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-gray-50 text-gray-400 font-black uppercase text-[10px] sticky top-0 z-10 border-b border-gray-100">
                                <tr>
                                  <th className="py-2 px-3">Acción / Cupo</th>
                                  <th className="py-2 px-3">Pasajero</th>
                                  <th className="py-2 px-3">Agencia</th>
                                  <th className="py-2 px-3">Ciudad</th>
                                  <th className="py-2 px-3">Habitación</th>
                                  <th className="py-2 px-3">Hotel</th>
                                  <th className="py-2 px-3 text-right">Abonos</th>
                                  <th className="py-2 px-3">Observaciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                                {excelImportPlan.map((item, idx) => {
                                  const p = item.passenger
                                  return (
                                    <tr key={idx} className="hover:bg-gray-50/60">
                                      <td className="py-2 px-3">
                                        {item.isReplacement ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px]">
                                            <RefreshCw size={10} className="shrink-0" />
                                            <span>Reemplaza Cupo #{item.cupoNumber}</span>
                                          </span>
                                        ) : item.isUpdate ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-bold text-[10px]">
                                            <RefreshCw size={10} className="shrink-0" />
                                            <span>Actualiza Cupo #{item.cupoNumber}</span>
                                          </span>
                                        ) : item.targetSlot ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                                            <Plus size={10} className="shrink-0" />
                                            <span>Nuevo en Cupo #{item.cupoNumber}</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-900 font-bold text-[10px]">
                                            <AlertTriangle size={10} className="shrink-0" />
                                            <span>Sin cupo libre</span>
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 font-black text-gray-900">
                                        {p.is_unnamed_reservation && item.targetSlot?.nombres && !item.targetSlot.nombres.includes('(POR ASIGNAR)') && item.targetSlot.nombres !== '-'
                                          ? [item.targetSlot.nombres, item.targetSlot.apellidos].filter(Boolean).join(' ')
                                          : p.nombres
                                        }
                                      </td>
                                      <td className="py-2 px-3 font-semibold text-gray-700">
                                        {p.agencia || (item.targetSlot?.agencia || 'Directo')}
                                      </td>
                                      <td className="py-2 px-3">
                                        <span className="px-1.5 py-0.5 rounded bg-gray-100 font-bold text-[10px]">
                                          {p.ciudad || (item.targetSlot?.ciudad || 'GYE')}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3">
                                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                                          {p.tipo_habitacion || (item.targetSlot?.tipo_habitacion || 'Doble')}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 font-bold text-gray-700 truncate max-w-[130px]">
                                        {p.hoteles || (item.targetSlot?.hoteles || '-')}
                                      </td>
                                      <td className="py-2 px-3 text-right font-black text-emerald-700 font-mono">
                                        {p.total_abonos > 0 ? `$${p.total_abonos.toLocaleString('en-US')}` : '-'}
                                      </td>
                                      <td className="py-2 px-3 text-gray-500 truncate max-w-[140px]">
                                        {p.observaciones || '-'}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => {
                  setShowExcelImportModal(false)
                  setShowQuickPasteModal(false)
                }}
                className="px-5 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyExcelImport}
                disabled={saving || !excelImportedData || excelImportedData.passengers.length === 0 || excelImportPlan.filter(it => it.targetSlot).length === 0}
                className="btn-primary px-7 py-3 rounded-2xl font-black uppercase tracking-wider shadow-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Check size={16} />
                <span>
                  {saving
                    ? 'Sincronizando...'
                    : `Sincronizar y Aplicar ${excelImportPlan.filter(it => it.targetSlot).length} Pasajeros (Sin Duplicar)`
                  }
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: EDITAR BLOQUEO (ADMIN / SUPERADMIN) */}
      {showEditBloqueoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight">
                    Editar Parámetros del Bloqueo
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {bloqueo.codigo} · Modifica fechas, cupos, precio de venta o estado.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditBloqueoModal(false)}
                className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditBloqueo} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Título del Bloqueo *</label>
                  <input
                    type="text"
                    required
                    value={editBloqueoForm.titulo}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, titulo: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Código del Bloqueo *</label>
                  <input
                    type="text"
                    required
                    value={editBloqueoForm.codigo}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, codigo: e.target.value.toUpperCase() })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-bold uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Destino *</label>
                  <input
                    type="text"
                    required
                    value={editBloqueoForm.destino}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, destino: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Aerolínea *</label>
                  <input
                    type="text"
                    required
                    value={editBloqueoForm.aerolinea}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, aerolinea: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Fecha de Salida *</label>
                  <input
                    type="date"
                    required
                    value={editBloqueoForm.fecha_salida}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, fecha_salida: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Fecha de Retorno</label>
                  <input
                    type="date"
                    value={editBloqueoForm.fecha_retorno}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, fecha_retorno: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Fecha Límite Emisión</label>
                  <input
                    type="date"
                    value={editBloqueoForm.fecha_limite_emision}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, fecha_limite_emision: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Fecha Límite Pago</label>
                  <input
                    type="date"
                    value={editBloqueoForm.fecha_limite_pago}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, fecha_limite_pago: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Cupos Totales *</label>
                  <input
                    type="number"
                    min={metrics.ocupados || 1}
                    required
                    value={editBloqueoForm.cupos_totales}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, cupos_totales: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-bold"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Mínimo {metrics.ocupados} (ocupados actualmente)
                  </span>
                </div>
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Precio Venta Sugerido ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editBloqueoForm.precio_venta_pax}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, precio_venta_pax: e.target.value })}
                    className="input w-full bg-white text-primary font-black border border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-gray-800 font-bold mb-1">Estado</label>
                  <select
                    value={editBloqueoForm.estado}
                    onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, estado: e.target.value })}
                    className="input w-full bg-white text-gray-900 border border-gray-200 font-bold"
                  >
                    <option value="activo">Activo</option>
                    <option value="completado">Completado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Configuración de Hoteles y Habitaciones */}
              <div className="pt-3 border-t border-gray-100 bg-gray-50/70 p-4 rounded-2xl">
                <BloqueoHotelesConfig
                  hoteles={editBloqueoForm.hoteles || []}
                  onChange={(newHoteles) => setEditBloqueoForm({ ...editBloqueoForm, hoteles: newHoteles })}
                  precioBaseSugerido={Number(editBloqueoForm.precio_venta_pax) || Number(bloqueo?.precio_venta_pax) || 0}
                  cuposTotalesBloqueo={Number(editBloqueoForm.cupos_totales) || Number(bloqueo?.cupos_totales) || 30}
                />
              </div>

              <div>
                <label className="block text-gray-800 font-bold mb-1">Notas / Políticas del Bloqueo</label>
                <textarea
                  rows={3}
                  value={editBloqueoForm.notas}
                  onChange={(e) => setEditBloqueoForm({ ...editBloqueoForm, notas: e.target.value })}
                  className="input w-full p-2.5 bg-white text-gray-900 border border-gray-200 font-medium"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                {isPrivileged && bloqueo.estado !== 'eliminado' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBloqueoModal(false)
                      handleDeleteThisBloqueo()
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Mover a Papelera</span>
                  </button>
                ) : <div />}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditBloqueoModal(false)}
                    className="px-5 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary px-7 py-3 rounded-2xl font-black uppercase tracking-wider shadow-lg"
                  >
                    {saving ? 'Guardando...' : 'Guardar Cambios del Bloqueo'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
