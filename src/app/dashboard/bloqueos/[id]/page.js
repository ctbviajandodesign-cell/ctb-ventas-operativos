'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import Link from 'next/link'
import { 
  ArrowLeft, 
  CalendarRange, 
  Plus, 
  Users, 
  Clock, 
  MapPin, 
  Plane, 
  Download, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Search, 
  Filter, 
  Hotel, 
  Building2, 
  User, 
  Tag, 
  FileSpreadsheet,
  X,
  Share2,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { showToast } from '@/utils/toast'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { CTB_CITIES } from '@/data/cities'

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

  // Filtering
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos') // 'todos', 'ocupados', 'libres', 'pendientes'

  // Booking Modal
  const [showModal, setShowModal] = useState(false)
  const [isGroupBooking, setIsGroupBooking] = useState(false)
  const [selectedSlotNumber, setSelectedSlotNumber] = useState(null)
  const [groupSlotsCount, setGroupSlotsCount] = useState(2)

  // Booking Form State
  const [formData, setFormData] = useState({
    numero_cupo: 1,
    grupo_id: '',
    grupo_nombre: '',
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
    requerimientos_especiales: '',
    // Finanzas
    precio_acordado: 0,
    abono_1: 0,
    fecha_abono_1: '',
    abono_2: 0,
    fecha_abono_2: '',
    abono_3: 0,
    fecha_abono_3: '',
    fecha_limite_pago_agencia: '',
    observaciones: ''
  })

  useEffect(() => {
    fetchBloqueoData()
    fetchHelpers()
  }, [id])

  async function fetchHelpers() {
    try {
      const [{ data: ops }, { data: coms }] = await Promise.all([
        supabase.from('profiles').select('id, nombre, ciudad').in('rol', ['operativo', 'comercial', 'admin', 'superadmin']),
        supabase.from('comerciales').select('id, nombre, ciudad')
      ])
      if (ops) setOperativosList(ops)
      if (coms) setComercialesList(coms)
    } catch (e) {
      console.error('Error fetching helpers:', e)
    }
  }

  async function fetchBloqueoData() {
    setLoading(true)
    try {
      const { data: blq, error: blqErr } = await supabase
        .from('bloqueos')
        .select('*')
        .eq('id', id)
        .single()

      if (blqErr) throw blqErr
      setBloqueo(blq)

      const { data: pas, error: pasErr } = await supabase
        .from('bloqueo_pasajeros')
        .select('*')
        .eq('bloqueo_id', id)
        .order('numero_cupo', { ascending: true })

      if (pasErr) throw pasErr
      setPasajeros(pas || [])
    } catch (err) {
      console.error('Error fetching bloqueo detail:', err)
      showToast('Error al cargar detalle del bloqueo.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Summary Metrics
  const metrics = useMemo(() => {
    if (!bloqueo) return {}
    const totalCupos = bloqueo.cupos_totales || 30
    let ocupados = 0
    let totalCobrado = 0
    let totalPendiente = 0

    pasajeros.forEach(p => {
      if (p.nombres && p.nombres.trim() !== '') {
        ocupados++
        const abonos = (Number(p.abono_1) || 0) + (Number(p.abono_2) || 0) + (Number(p.abono_3) || 0)
        const total = Number(p.precio_acordado) || Number(bloqueo.precio_venta_pax) || 0
        totalCobrado += abonos
        totalPendiente += Math.max(0, total - abonos)
      }
    })

    const disponibles = Math.max(0, totalCupos - ocupados)
    const porcentaje = Math.round((ocupados / totalCupos) * 100)
    const breakEvenPax = Number(bloqueo.costo_total_unitario) > 0 && Number(bloqueo.precio_venta_pax) > 0
      ? Math.ceil((Number(bloqueo.costo_total_unitario) * totalCupos) / Number(bloqueo.precio_venta_pax))
      : Math.round(totalCupos * 0.6)

    return {
      totalCupos,
      ocupados,
      disponibles,
      porcentaje,
      totalCobrado,
      totalPendiente,
      breakEvenPax,
      breakEvenCubierto: ocupados >= breakEvenPax
    }
  }, [bloqueo, pasajeros])

  // Open modal for single slot
  const handleOpenSingleSlot = (slot) => {
    setIsGroupBooking(false)
    setSelectedSlotNumber(slot.numero_cupo)
    setFormData({
      numero_cupo: slot.numero_cupo,
      grupo_id: slot.grupo_id || '',
      grupo_nombre: slot.grupo_nombre || '',
      codigo_cotizacion: slot.codigo_cotizacion || `CTB-BLQ-${Date.now().toString().slice(-4)}`,
      agencia: slot.agencia || '',
      ciudad: slot.ciudad || profile?.ciudad || 'GYE',
      tipo_servicio: slot.tipo_servicio || 'PAQUETE COMPLETO',
      operativo_id: slot.operativo_id || user?.id || '',
      operativo_nombre: slot.operativo_nombre || profile?.nombre || '',
      comercial_id: slot.comercial_id || '',
      comercial_nombre: slot.comercial_nombre || '',
      hoteles: slot.hoteles || 'GIMANI + PARAISO',
      nombres: slot.nombres || '',
      apellidos: slot.apellidos || '',
      tipo_documento: slot.tipo_documento || 'Cédula',
      numero_documento: slot.numero_documento || '',
      fecha_nacimiento: slot.fecha_nacimiento || '',
      caducidad_pasaporte: slot.caducidad_pasaporte || '',
      nacionalidad: slot.nacionalidad || 'ECUATORIANA',
      genero: slot.genero || 'M',
      tipo_habitacion: slot.tipo_habitacion || 'Doble',
      requerimientos_especiales: slot.requerimientos_especiales || '',
      precio_acordado: slot.precio_acordado || bloqueo?.precio_venta_pax || 0,
      abono_1: slot.abono_1 || 0,
      fecha_abono_1: slot.fecha_abono_1 || '',
      abono_2: slot.abono_2 || 0,
      fecha_abono_2: slot.fecha_abono_2 || '',
      abono_3: slot.abono_3 || 0,
      fecha_abono_3: slot.fecha_abono_3 || '',
      fecha_limite_pago_agencia: slot.fecha_limite_pago_agencia || '',
      observaciones: slot.observaciones || ''
    })
    setShowModal(true)
  }

  // Open modal for group booking
  const handleOpenGroupBooking = () => {
    setIsGroupBooking(true)
    const availableSlots = pasajeros.filter(p => !p.nombres || p.nombres.trim() === '')
    if (availableSlots.length < 2) {
      showToast('No hay suficientes cupos libres para una reserva grupal.', 'error')
      return
    }

    const defaultGroupSlots = Math.min(4, availableSlots.length)
    setGroupSlotsCount(defaultGroupSlots)

    setFormData({
      numero_cupo: availableSlots[0].numero_cupo,
      grupo_id: `GRP-${Date.now().toString().slice(-6)}`,
      grupo_nombre: '',
      codigo_cotizacion: `CTB-BLQ-${Date.now().toString().slice(-4)}`,
      agencia: '',
      ciudad: profile?.ciudad || 'GYE',
      tipo_servicio: 'PAQUETE COMPLETO',
      operativo_id: user?.id || '',
      operativo_nombre: profile?.nombre || '',
      comercial_id: '',
      comercial_nombre: '',
      hoteles: 'GIMANI + PARAISO',
      nombres: '',
      apellidos: '',
      tipo_documento: 'Cédula',
      numero_documento: '',
      fecha_nacimiento: '',
      caducidad_pasaporte: '',
      nacionalidad: 'ECUATORIANA',
      genero: 'M',
      tipo_habitacion: 'Doble',
      requerimientos_especiales: '',
      precio_acordado: bloqueo?.precio_venta_pax || 0,
      abono_1: 0,
      fecha_abono_1: '',
      abono_2: 0,
      fecha_abono_2: '',
      abono_3: 0,
      fecha_abono_3: '',
      fecha_limite_pago_agencia: '',
      observaciones: ''
    })
    setShowModal(true)
  }

  // Save Booking Handler
  const handleSaveBooking = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Resolve operative & comercial names
      const opObj = operativosList.find(o => o.id === formData.operativo_id)
      const comObj = comercialesList.find(c => c.id === formData.comercial_id)
      const opNombre = opObj ? opObj.nombre : (formData.operativo_nombre || profile?.nombre || 'Operativo')
      const comNombre = comObj ? comObj.nombre : (formData.comercial_nombre || '')

      if (isGroupBooking) {
        // Multi-slot assignment
        const availableSlots = pasajeros.filter(p => !p.nombres || p.nombres.trim() === '')
        const countToAssign = Math.min(Number(groupSlotsCount), availableSlots.length)
        const targetSlots = availableSlots.slice(0, countToAssign)

        const groupName = formData.grupo_nombre.trim() || `Grupo ${formData.agencia || 'Agencia'} (${countToAssign} PAX)`
        const groupUid = formData.grupo_id || `GRP-${Date.now().toString().slice(-6)}`

        // Distribute or assign values
        for (let i = 0; i < targetSlots.length; i++) {
          const slot = targetSlots[i]
          const isLeadPax = i === 0
          const paxName = isLeadPax ? (formData.nombres.trim() || `Líder Grupo - ${formData.agencia}`) : `Pax Acompañante ${i + 1}`

          const payload = {
            grupo_id: groupUid,
            grupo_nombre: groupName,
            codigo_cotizacion: formData.codigo_cotizacion,
            agencia: formData.agencia.trim(),
            ciudad: formData.ciudad,
            tipo_servicio: formData.tipo_servicio,
            operativo_id: formData.operativo_id || null,
            operativo_nombre: opNombre,
            comercial_id: formData.comercial_id || null,
            comercial_nombre: comNombre,
            hoteles: formData.hoteles.trim(),
            nombres: paxName,
            precio_acordado: Number(formData.precio_acordado) || Number(bloqueo.precio_venta_pax) || 0,
            // Primer pasajero lleva los abonos grupales si es plan grupal
            abono_1: isLeadPax ? Number(formData.abono_1) || 0 : 0,
            fecha_abono_1: isLeadPax ? formData.fecha_abono_1 || null : null,
            abono_2: isLeadPax ? Number(formData.abono_2) || 0 : 0,
            fecha_abono_2: isLeadPax ? formData.fecha_abono_2 || null : null,
            abono_3: isLeadPax ? Number(formData.abono_3) || 0 : 0,
            fecha_abono_3: isLeadPax ? formData.fecha_abono_3 || null : null,
            estado_pago: 'pendiente',
            fecha_limite_pago_agencia: formData.fecha_limite_pago_agencia || null,
            observaciones: isLeadPax 
              ? `PAGO TOTAL POR LOS ${countToAssign} PAX. ${formData.observaciones}`
              : `Parte del ${groupName}`
          }

          await supabase
            .from('bloqueo_pasajeros')
            .update(payload)
            .eq('id', slot.id)
        }

        // Notify Telegram
        fetch('/api/notify/bloqueo-venta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bloqueoTitulo: bloqueo.titulo,
            bloqueoCodigo: bloqueo.codigo,
            destino: bloqueo.destino,
            fechaSalida: bloqueo.fecha_salida,
            cuposVendidos: countToAssign,
            pasajerosNombres: groupName,
            agencia: formData.agencia,
            ciudad: formData.ciudad,
            operativoNombre: opNombre,
            comercialNombre: comNombre,
            cuposRestantes: Math.max(0, metrics.disponibles - countToAssign),
            cuposTotales: metrics.totalCupos,
            hoteles: formData.hoteles
          })
        }).catch(err => console.error('Telegram notification error:', err))

        showToast(`¡Grupo de ${countToAssign} cupos registrado con éxito!`, 'success')
      } else {
        // Single slot assignment
        const slot = pasajeros.find(p => p.numero_cupo === selectedSlotNumber)
        if (!slot) throw new Error('Cupo no encontrado')

        const payload = {
          grupo_id: formData.grupo_id || null,
          grupo_nombre: formData.grupo_nombre || null,
          codigo_cotizacion: formData.codigo_cotizacion || null,
          agencia: formData.agencia.trim(),
          ciudad: formData.ciudad,
          tipo_servicio: formData.tipo_servicio,
          operativo_id: formData.operativo_id || null,
          operativo_nombre: opNombre,
          comercial_id: formData.comercial_id || null,
          comercial_nombre: comNombre,
          hoteles: formData.hoteles.trim(),
          nombres: formData.nombres.trim(),
          apellidos: formData.apellidos.trim(),
          tipo_documento: formData.tipo_documento,
          numero_documento: formData.numero_documento.trim(),
          fecha_nacimiento: formData.fecha_nacimiento || null,
          caducidad_pasaporte: formData.caducidad_pasaporte || null,
          nacionalidad: formData.nacionalidad.trim(),
          genero: formData.genero,
          tipo_habitacion: formData.tipo_habitacion,
          requerimientos_especiales: formData.requerimientos_especiales.trim(),
          precio_acordado: Number(formData.precio_acordado) || Number(bloqueo.precio_venta_pax) || 0,
          abono_1: Number(formData.abono_1) || 0,
          fecha_abono_1: formData.fecha_abono_1 || null,
          abono_2: Number(formData.abono_2) || 0,
          fecha_abono_2: formData.fecha_abono_2 || null,
          abono_3: Number(formData.abono_3) || 0,
          fecha_abono_3: formData.fecha_abono_3 || null,
          estado_pago: 'pendiente',
          fecha_limite_pago_agencia: formData.fecha_limite_pago_agencia || null,
          observaciones: formData.observaciones.trim()
        }

        const { error: updError } = await supabase
          .from('bloqueo_pasajeros')
          .update(payload)
          .eq('id', slot.id)

        if (updError) throw updError

        // Notify Telegram if was empty previously
        if (!slot.nombres && formData.nombres) {
          fetch('/api/notify/bloqueo-venta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bloqueoTitulo: bloqueo.titulo,
              bloqueoCodigo: bloqueo.codigo,
              destino: bloqueo.destino,
              fechaSalida: bloqueo.fecha_salida,
              cuposVendidos: 1,
              pasajerosNombres: `${formData.nombres} ${formData.apellidos}`.trim(),
              agencia: formData.agencia,
              ciudad: formData.ciudad,
              operativoNombre: opNombre,
              comercialNombre: comNombre,
              cuposRestantes: Math.max(0, metrics.disponibles - 1),
              cuposTotales: metrics.totalCupos,
              hoteles: formData.hoteles
            })
          }).catch(err => console.error('Telegram notification error:', err))
        }

        showToast(`Cupo #${selectedSlotNumber} guardado correctamente.`, 'success')
      }

      setShowModal(false)
      fetchBloqueoData()
    } catch (err) {
      console.error('Error saving slot:', err)
      showToast('Error al guardar cupo: ' + err.message, 'error')
    } finally {
      setSaving(false)
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
        precio_acordado: bloqueo?.precio_venta_pax || 0,
        abono_1: 0,
        fecha_abono_1: null,
        abono_2: 0,
        fecha_abono_2: null,
        abono_3: 0,
        fecha_abono_3: null,
        fecha_limite_pago_agencia: null,
        observaciones: null,
        estado_pago: 'pendiente'
      }

      await supabase
        .from('bloqueo_pasajeros')
        .update(resetPayload)
        .eq('id', slot.id)

      showToast(`Cupo #${slot.numero_cupo} liberado.`, 'success')
      fetchBloqueoData()
    } catch (err) {
      console.error('Error releasing slot:', err)
      showToast('Error al liberar cupo.', 'error')
    }
  }

  // Export Official Rooming List to Excel
  const handleExportRoomingList = async () => {
    if (!bloqueo || pasajeros.length === 0) return
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Rooming List')

    // Title & Header Styling
    sheet.mergeCells('A1:L1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = `CTB VIAJANDO — ROOMING LIST & MANIFIESTO OFICIAL: ${bloqueo.titulo.toUpperCase()}`
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(1).height = 35

    // Meta details row
    sheet.mergeCells('A2:L2')
    const metaCell = sheet.getCell('A2')
    metaCell.value = `DESTINO: ${bloqueo.destino} | AEROLÍNEA: ${bloqueo.aerolinea || 'N/A'} | FECHA SALIDA: ${bloqueo.fecha_salida} | RETORNO: ${bloqueo.fecha_retorno || 'N/A'}`
    metaCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0066CC' } }
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(2).height = 25

    // Headers
    const headers = [
      '# PAX', 'NOMBRES', 'APELLIDOS', 'DOC / PASAPORTE', 'NACIMIENTO', 'HABITACIÓN',
      'AGENCIA', 'CIUDAD', 'SERVICIO', 'OPERATIVO', 'COMERCIAL', 'HOTELES'
    ]
    sheet.addRow([])
    const headerRow = sheet.addRow(headers)
    headerRow.height = 24
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })

    // Data Rows
    pasajeros.forEach(p => {
      const row = sheet.addRow([
        p.numero_cupo,
        p.nombres || 'LIBRE',
        p.apellidos || '',
        p.numero_documento || '',
        p.fecha_nacimiento || '',
        p.tipo_habitacion || 'DOBLE',
        p.agencia || '',
        p.ciudad || '',
        p.tipo_servicio || '',
        p.operativo_nombre || '',
        p.comercial_nombre || '',
        p.hoteles || ''
      ])

      row.height = 20
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9 }
        cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
        if (colNumber === 1) cell.alignment = { horizontal: 'center' }
        if (!p.nombres) cell.font = { italic: true, color: { argb: 'FF94A3B8' } }
      })
    })

    // Column widths
    sheet.columns = [
      { width: 8 },  // # PAX
      { width: 22 }, // Nombres
      { width: 20 }, // Apellidos
      { width: 16 }, // Doc
      { width: 14 }, // Nacimiento
      { width: 14 }, // Habitación
      { width: 24 }, // Agencia
      { width: 10 }, // Ciudad
      { width: 18 }, // Servicio
      { width: 16 }, // Operativo
      { width: 16 }, // Comercial
      { width: 26 }  // Hoteles
    ]

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Rooming_List_${bloqueo.codigo}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    showToast('Rooming List exportado exitosamente a Excel.', 'success')
  }

  // Filtered passenger grid
  const filteredSlots = useMemo(() => {
    return pasajeros.filter(p => {
      const isOcupado = p.nombres && p.nombres.trim() !== ''
      if (statusFilter === 'ocupados' && !isOcupado) return false
      if (statusFilter === 'libres' && isOcupado) return false
      if (statusFilter === 'pendientes' && (!isOcupado || Number(p.faltante) <= 0)) return false

      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        p.nombres?.toLowerCase().includes(term) ||
        p.apellidos?.toLowerCase().includes(term) ||
        p.agencia?.toLowerCase().includes(term) ||
        p.operativo_nombre?.toLowerCase().includes(term) ||
        p.comercial_nombre?.toLowerCase().includes(term) ||
        p.codigo_cotizacion?.toLowerCase().includes(term) ||
        p.numero_cupo.toString() === term
      )
    })
  }, [pasajeros, statusFilter, searchTerm])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 bg-white rounded-3xl border border-gray-100">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">
          Cargando inventario de cupos...
        </p>
      </div>
    )
  }

  if (!bloqueo) {
    return (
      <div className="p-16 text-center bg-white rounded-3xl border border-gray-100">
        <AlertTriangle size={36} className="text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-black text-gray-900">Bloqueo no encontrado</h2>
        <Link href="/dashboard/bloqueos" className="btn-primary mt-4 inline-flex items-center gap-2 text-xs font-black uppercase">
          <ArrowLeft size={16} /> Volver a Bloqueos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Top Navigation & Bloqueo Overview Header */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/bloqueos"
            className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-100 text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0 mt-1"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-gray-900 text-white">
                {bloqueo.codigo}
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                <MapPin size={13} className="text-primary" /> {bloqueo.destino}
              </span>
              {bloqueo.aerolinea && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                    <Plane size={13} className="text-gray-400" /> {bloqueo.aerolinea}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1">
              {bloqueo.titulo}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                Salida: <strong className="text-gray-800">{format(parseISO(bloqueo.fecha_salida), "EEEE d 'de' MMMM, yyyy", { locale: es })}</strong>
              </span>
              {bloqueo.fecha_limite_emision && (
                <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full font-bold">
                  <Clock size={12} /> Deadline Nombres: {format(parseISO(bloqueo.fecha_limite_emision), "d 'de' MMMM", { locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportRoomingList}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-black text-xs uppercase tracking-wider transition-colors"
          >
            <FileSpreadsheet size={16} />
            Rooming List (Excel)
          </button>

          <button
            onClick={handleOpenGroupBooking}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 font-black text-xs uppercase tracking-wider transition-colors"
          >
            <Layers size={16} />
            Reservar Grupo
          </button>
        </div>
      </div>

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

      {/* Controls & Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por pasajero, agencia, cotización..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent"
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
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {st === 'todos' ? 'Todos los Cupos' : st === 'ocupados' ? 'Ocupados' : st === 'libres' ? 'Disponibles' : 'Con Saldo'}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN PASSENGER GRID / SPREADSHEET TABLE */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="py-4 px-4 text-center w-14"># PAX</th>
                <th className="py-4 px-4 min-w-[200px]">Pasajero / Grupo</th>
                <th className="py-4 px-4 min-w-[150px]">Agencia & Ciudad</th>
                <th className="py-4 px-4">Cotización</th>
                <th className="py-4 px-4 min-w-[120px]">Operativo & Comercial</th>
                <th className="py-4 px-4 min-w-[140px]">Hoteles & Servicio</th>
                <th className="py-4 px-3 text-right">Abono 1</th>
                <th className="py-4 px-3 text-right">Abono 2</th>
                <th className="py-4 px-3 text-right">Abono 3</th>
                <th className="py-4 px-4 text-right">Faltante</th>
                <th className="py-4 px-4 min-w-[150px]">Observaciones</th>
                <th className="py-4 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium">
              {filteredSlots.map((slot) => {
                const isOccupied = slot.nombres && slot.nombres.trim() !== ''
                const faltante = Number(slot.faltante) || 0
                const precio = Number(slot.precio_acordado) || 0
                const abonosSum = (Number(slot.abono_1) || 0) + (Number(slot.abono_2) || 0) + (Number(slot.abono_3) || 0)
                const isPaid = isOccupied && faltante === 0 && precio > 0

                return (
                  <tr
                    key={slot.id}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      !isOccupied ? 'bg-gray-50/20 text-gray-400' : 'text-gray-700'
                    }`}
                  >
                    {/* # PAX */}
                    <td className="py-3 px-4 text-center font-black">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs ${
                        isOccupied ? 'bg-primary/10 text-primary font-black' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {slot.numero_cupo}
                      </span>
                    </td>

                    {/* Pasajero / Grupo */}
                    <td className="py-3 px-4">
                      {isOccupied ? (
                        <div>
                          <p className="font-black text-gray-900 leading-tight uppercase">
                            {slot.nombres} {slot.apellidos || ''}
                          </p>
                          {slot.grupo_nombre && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md mt-0.5">
                              <Users size={10} /> {slot.grupo_nombre}
                            </span>
                          )}
                          {slot.numero_documento && (
                            <p className="text-[10px] text-gray-400">
                              {slot.tipo_documento}: {slot.numero_documento}
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
                          <p className="text-gray-400 text-[10px]">Com: {slot.comercial_nombre || 'S/A'}</p>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Hoteles & Servicio */}
                    <td className="py-3 px-4">
                      {isOccupied ? (
                        <div>
                          <p className="font-bold text-gray-800 text-[11px] leading-tight">{slot.hoteles || 'Estándar'}</p>
                          <span className="text-[10px] text-gray-400 block mt-0.5">{slot.tipo_servicio}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Abonos */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-700">
                      {slot.abono_1 > 0 ? `$${slot.abono_1}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-700">
                      {slot.abono_2 > 0 ? `$${slot.abono_2}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-700">
                      {slot.abono_3 > 0 ? `$${slot.abono_3}` : '—'}
                    </td>

                    {/* Faltante & Estado */}
                    <td className="py-3 px-4 text-right">
                      {isOccupied ? (
                        <div>
                          <span className={`font-mono font-black ${faltante === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            ${faltante.toLocaleString('es-EC')}
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
                    <td className="py-3 px-4 text-[11px] text-gray-500 max-w-[200px] truncate">
                      {slot.observaciones || '—'}
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenSingleSlot(slot)}
                          className="p-1.5 rounded-xl bg-gray-50 hover:bg-primary hover:text-white text-gray-600 transition-colors"
                          title="Editar / Asignar Cupo"
                        >
                          <Edit3 size={14} />
                        </button>
                        {isOccupied && (
                          <button
                            onClick={() => handleReleaseSlot(slot)}
                            className="p-1.5 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                            title="Liberar Cupo"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* BOOKING / PASSENGER ASSIGNMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                  {isGroupBooking ? <Layers size={20} /> : <User size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight">
                    {isGroupBooking ? 'Reserva de Grupo para Bloqueo' : `Asignar Cupo #${selectedSlotNumber}`}
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">
                    {bloqueo.titulo} · Tarifa Base: ${bloqueo.precio_venta_pax} USD
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 hover:text-gray-800 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveBooking} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Grupo Mode Selector */}
              {isGroupBooking && (
                <div className="bg-purple-50/80 p-4 rounded-2xl border border-purple-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-purple-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Layers size={14} /> Configuración de Grupo
                    </span>
                    <span className="text-[11px] text-purple-700 font-bold">
                      Cupos disponibles: {metrics.disponibles}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-700 font-black mb-1">Nombre del Grupo</label>
                      <input
                        type="text"
                        placeholder="Ej. Familia Salazar"
                        value={formData.grupo_nombre}
                        onChange={(e) => setFormData({ ...formData, grupo_nombre: e.target.value })}
                        className="input w-full bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-black mb-1">Número de Cupos a Tomar</label>
                      <input
                        type="number"
                        min={2}
                        max={metrics.disponibles}
                        value={groupSlotsCount}
                        onChange={(e) => setGroupSlotsCount(e.target.value)}
                        className="input w-full bg-white font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Trazabilidad Comercial y Agencia */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-2">
                  1. Agencia y Trazabilidad Comercial
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Agencia Solicitante *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Inova Viajes"
                      value={formData.agencia}
                      onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Ciudad *</label>
                    <select
                      value={formData.ciudad}
                      onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                      className="input w-full"
                    >
                      <option value="GYE">Guayaquil (GYE)</option>
                      <option value="UIO">Quito (UIO)</option>
                      <option value="CUE">Cuenca (CUE)</option>
                      <option value="Nacional">Nacional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Código Cotización</label>
                    <input
                      type="text"
                      placeholder="CTB-2026-XXXX"
                      value={formData.codigo_cotizacion}
                      onChange={(e) => setFormData({ ...formData, codigo_cotizacion: e.target.value.toUpperCase() })}
                      className="input w-full uppercase font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Operativo Asignado</label>
                    <select
                      value={formData.operativo_id}
                      onChange={(e) => {
                        const op = operativosList.find(o => o.id === e.target.value)
                        setFormData({ ...formData, operativo_id: e.target.value, operativo_nombre: op?.nombre || '' })
                      }}
                      className="input w-full"
                    >
                      <option value="">Seleccionar operativo...</option>
                      {operativosList.map(op => (
                        <option key={op.id} value={op.id}>{op.nombre} ({op.ciudad || 'EC'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Comercial</label>
                    <select
                      value={formData.comercial_id}
                      onChange={(e) => {
                        const com = comercialesList.find(c => c.id === e.target.value)
                        setFormData({ ...formData, comercial_id: e.target.value, comercial_nombre: com?.nombre || '' })
                      }}
                      className="input w-full"
                    >
                      <option value="">Seleccionar comercial...</option>
                      {comercialesList.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Tipo de Servicio</label>
                    <input
                      type="text"
                      placeholder="PAQUETE COMPLETO, SOLO LAND TOUR..."
                      value={formData.tipo_servicio}
                      onChange={(e) => setFormData({ ...formData, tipo_servicio: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Datos del Pasajero para Aerolínea (OPCIONALES / NO OBLIGATORIOS) */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-800 flex items-center gap-1.5">
                    <Plane size={14} className="text-primary" /> 2. Ficha de Pasajero (Datos de Aerolínea)
                  </h4>
                  <span className="text-[10px] text-gray-400 font-bold">Campos opcionales / editables</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">
                      {isGroupBooking ? 'Nombre del Líder del Grupo' : 'Nombres'}
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. MERCY o LILIBETH"
                      value={formData.nombres}
                      onChange={(e) => setFormData({ ...formData, nombres: e.target.value.toUpperCase() })}
                      className="input w-full bg-white uppercase font-bold"
                    />
                  </div>
                  {!isGroupBooking && (
                    <div>
                      <label className="block text-gray-600 font-semibold mb-1">Apellidos</label>
                      <input
                        type="text"
                        placeholder="Ej. BARRA SALAZAR"
                        value={formData.apellidos}
                        onChange={(e) => setFormData({ ...formData, apellidos: e.target.value.toUpperCase() })}
                        className="input w-full bg-white uppercase font-bold"
                      />
                    </div>
                  )}
                </div>

                {!isGroupBooking && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-gray-600 font-semibold mb-1">Tipo Documento</label>
                        <select
                          value={formData.tipo_documento}
                          onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value })}
                          className="input w-full bg-white"
                        >
                          <option value="Cédula">Cédula</option>
                          <option value="Pasaporte">Pasaporte</option>
                          <option value="DNI">DNI / Extranjero</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-600 font-semibold mb-1">Número Documento</label>
                        <input
                          type="text"
                          placeholder="0912345678"
                          value={formData.numero_documento}
                          onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
                          className="input w-full bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 font-semibold mb-1">Fecha Nacimiento</label>
                        <input
                          type="date"
                          value={formData.fecha_nacimiento}
                          onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                          className="input w-full bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-gray-600 font-semibold mb-1">Nacionalidad</label>
                        <input
                          type="text"
                          value={formData.nacionalidad}
                          onChange={(e) => setFormData({ ...formData, nacionalidad: e.target.value.toUpperCase() })}
                          className="input w-full bg-white uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 font-semibold mb-1">Género</label>
                        <select
                          value={formData.genero}
                          onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
                          className="input w-full bg-white"
                        >
                          <option value="M">Masculino (M)</option>
                          <option value="F">Femenino (F)</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-600 font-semibold mb-1">Tipo Habitación</label>
                        <select
                          value={formData.tipo_habitacion}
                          onChange={(e) => setFormData({ ...formData, tipo_habitacion: e.target.value })}
                          className="input w-full bg-white font-bold"
                        >
                          <option value="Doble">Doble</option>
                          <option value="Triple">Triple</option>
                          <option value="Matrimonial">Matrimonial</option>
                          <option value="Simple">Simple (SGL)</option>
                          <option value="Twin">Twin</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Hoteles y Pagos */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-2 flex items-center gap-1.5">
                  <DollarSign size={14} /> 3. Hoteles & Plan de Abonos
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Distribución Hotelera</label>
                    <input
                      type="text"
                      placeholder="Ej. GIMANI + PARAISO"
                      value={formData.hoteles}
                      onChange={(e) => setFormData({ ...formData, hoteles: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-black mb-1">
                      {isGroupBooking ? 'Precio por PAX Acordado ($)' : 'Precio Total Acordado ($)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.precio_acordado}
                      onChange={(e) => setFormData({ ...formData, precio_acordado: e.target.value })}
                      className="input w-full font-bold text-primary"
                    />
                  </div>
                </div>

                {/* Abonos Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100">
                  <div>
                    <label className="block text-emerald-900 font-bold mb-1">Abono 1 ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.abono_1}
                      onChange={(e) => setFormData({ ...formData, abono_1: e.target.value })}
                      className="input w-full bg-white font-bold"
                      placeholder="100.00"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-900 font-bold mb-1">Abono 2 ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.abono_2}
                      onChange={(e) => setFormData({ ...formData, abono_2: e.target.value })}
                      className="input w-full bg-white font-bold"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-900 font-bold mb-1">Abono 3 / Saldo ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.abono_3}
                      onChange={(e) => setFormData({ ...formData, abono_3: e.target.value })}
                      className="input w-full bg-white font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Fecha Compromiso Cobro Agencia</label>
                    <input
                      type="date"
                      value={formData.fecha_limite_pago_agencia}
                      onChange={(e) => setFormData({ ...formData, fecha_limite_pago_agencia: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Observaciones</label>
                    <input
                      type="text"
                      placeholder="PAGO TOTAL POR 2 PAX, HABITACIONES GRANDES..."
                      value={formData.observaciones}
                      onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary px-7 py-3 rounded-2xl font-black uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-primary/25"
                >
                  {saving ? 'Guardando...' : (isGroupBooking ? 'Asignar Grupo de Cupos' : 'Guardar Pasajero')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
