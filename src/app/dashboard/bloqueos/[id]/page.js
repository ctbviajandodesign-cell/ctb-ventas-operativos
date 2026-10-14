'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Sparkles,
  CheckSquare,
  Square,
  CreditCard,
  FolderPlus
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { showToast } from '@/utils/toast'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

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

  // Multi-selection for grouping existing passengers
  const [selectedSlotIds, setSelectedSlotIds] = useState([])
  const [showGroupExistingModal, setShowGroupExistingModal] = useState(false)
  const [existingGroupName, setExistingGroupName] = useState('')

  // Modals State
  const [showSingleModal, setShowSingleModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [selectedSlotNumber, setSelectedSlotNumber] = useState(null)

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
    hoteles: 'GIMANI + PARAISO',
    codigo_cotizacion: '',
    precio_por_pax: 0,
    // Dynamic list of passengers (nombre por nombre)
    pasajeros_lista: [
      { id: '1', nombres: '', apellidos: '', tipo_documento: 'Cédula', numero_documento: '', tipo_habitacion: 'Doble' },
      { id: '2', nombres: '', apellidos: '', tipo_documento: 'Cédula', numero_documento: '', tipo_habitacion: 'Doble' }
    ],
    // Dynamic payment plan for the group
    plan_pagos: [
      { id: '1', numero: 1, label: 'Abono 1 (Reserva Grupo)', monto: 200, fecha: '', estado: 'pagado', nota: '' }
    ],
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

    return {
      totalCupos,
      ocupados,
      disponibles,
      porcentaje,
      totalCobrado,
      totalPendiente
    }
  }, [bloqueo, pasajeros])

  // Extract payment installments array (from plan_pagos column or fallback)
  const getSlotInstallments = (slot) => {
    if (slot.plan_pagos && Array.isArray(slot.plan_pagos) && slot.plan_pagos.length > 0) {
      return slot.plan_pagos
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

  // Open Single Slot Modal
  const handleOpenSingleSlot = (slot) => {
    setSelectedSlotNumber(slot.numero_cupo)
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
      plan_pagos: initialPlan,
      fecha_limite_pago_agencia: slot.fecha_limite_pago_agencia || '',
      observaciones: slot.observaciones || ''
    })
    setShowSingleModal(true)
  }

  // Open Group Modal
  const handleOpenGroupModal = () => {
    const availableSlots = pasajeros.filter(p => !p.nombres || p.nombres.trim() === '')
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
      hoteles: 'GIMANI + PARAISO',
      codigo_cotizacion: `CTB-BLQ-${Date.now().toString().slice(-4)}`,
      precio_por_pax: bloqueo?.precio_venta_pax || 0,
      pasajeros_lista: [
        { id: '1', nombres: '', apellidos: '', tipo_documento: 'Cédula', numero_documento: '', tipo_habitacion: 'Doble' },
        { id: '2', nombres: '', apellidos: '', tipo_documento: 'Cédula', numero_documento: '', tipo_habitacion: 'Doble' }
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
          tipo_habitacion: 'Doble'
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
        codigo_cotizacion: singleForm.codigo_cotizacion.trim() || null,
        agencia: singleForm.agencia.trim(),
        ciudad: singleForm.ciudad,
        tipo_servicio: singleForm.tipo_servicio,
        operativo_id: singleForm.operativo_id || null,
        operativo_nombre: opNombre,
        comercial_id: singleForm.comercial_id || null,
        comercial_nombre: comNombre,
        hoteles: singleForm.hoteles.trim(),
        nombres: singleForm.nombres.trim(),
        apellidos: singleForm.apellidos.trim(),
        tipo_documento: singleForm.tipo_documento,
        numero_documento: singleForm.numero_documento.trim(),
        fecha_nacimiento: singleForm.fecha_nacimiento || null,
        caducidad_pasaporte: singleForm.caducidad_pasaporte || null,
        nacionalidad: singleForm.nacionalidad.trim(),
        genero: singleForm.genero,
        tipo_habitacion: singleForm.tipo_habitacion,
        requerimientos_especiales: singleForm.requerimientos_especiales.trim(),
        precio_acordado: Number(singleForm.precio_acordado) || Number(bloqueo.precio_venta_pax) || 0,
        abono_1: p1,
        fecha_abono_1: singleForm.plan_pagos[0]?.fecha || null,
        abono_2: p2,
        fecha_abono_2: singleForm.plan_pagos[1]?.fecha || null,
        abono_3: p3,
        fecha_abono_3: singleForm.plan_pagos[2]?.fecha || null,
        fecha_limite_pago_agencia: singleForm.fecha_limite_pago_agencia || null,
        observaciones: singleForm.observaciones.trim()
      }

      // Try update with plan_pagos column if available, else ignore
      const { error: updError } = await supabase
        .from('bloqueo_pasajeros')
        .update({ ...payload, plan_pagos: singleForm.plan_pagos })
        .eq('id', singleForm.slot_id)

      if (updError) {
        // Fallback without plan_pagos column if not migrated yet
        const { error: fallbackErr } = await supabase
          .from('bloqueo_pasajeros')
          .update(payload)
          .eq('id', singleForm.slot_id)
        if (fallbackErr) throw fallbackErr
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

      showToast(`Cupo #${singleForm.numero_cupo} guardado con éxito.`, 'success')
      setShowSingleModal(false)
      fetchBloqueoData()
    } catch (err) {
      console.error('Error saving single slot:', err)
      showToast('Error al guardar cupo: ' + err.message, 'error')
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

    const paxList = groupForm.pasajeros_lista.filter(p => p.nombres && p.nombres.trim() !== '')
    if (paxList.length === 0) {
      showToast('Ingresa al menos el nombre de un pasajero para el grupo.', 'error')
      return
    }

    const availableSlots = pasajeros.filter(p => !p.nombres || p.nombres.trim() === '')
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

      for (let i = 0; i < targetSlots.length; i++) {
        const slot = targetSlots[i]
        const paxData = paxList[i]
        const isLead = i === 0

        const payload = {
          grupo_id: groupUid,
          grupo_nombre: groupName,
          codigo_cotizacion: groupForm.codigo_cotizacion.trim() || null,
          agencia: groupForm.agencia.trim(),
          ciudad: groupForm.ciudad,
          tipo_servicio: groupForm.tipo_servicio,
          operativo_id: groupForm.operativo_id || null,
          operativo_nombre: opNombre,
          comercial_id: groupForm.comercial_id || null,
          comercial_nombre: comNombre,
          hoteles: groupForm.hoteles.trim(),
          nombres: paxData.nombres.trim(),
          apellidos: paxData.apellidos.trim(),
          tipo_documento: paxData.tipo_documento,
          numero_documento: paxData.numero_documento.trim(),
          tipo_habitacion: paxData.tipo_habitacion,
          precio_acordado: Number(groupForm.precio_por_pax) || Number(bloqueo.precio_venta_pax) || 0,
          // First slot holds shared group payment plan
          abono_1: isLead ? p1 : 0,
          fecha_abono_1: isLead ? groupForm.plan_pagos[0]?.fecha || null : null,
          abono_2: isLead ? p2 : 0,
          fecha_abono_2: isLead ? groupForm.plan_pagos[1]?.fecha || null : null,
          abono_3: isLead ? p3 : 0,
          fecha_abono_3: isLead ? groupForm.plan_pagos[2]?.fecha || null : null,
          fecha_limite_pago_agencia: groupForm.fecha_limite_pago_agencia || null,
          observaciones: isLead
            ? `PAGO GRUPAL (${paxList.length} PAX). ${groupForm.observaciones}`
            : `Integrante de ${groupName}`
        }

        const { error: updErr } = await supabase
          .from('bloqueo_pasajeros')
          .update({ ...payload, plan_pagos: isLead ? groupForm.plan_pagos : [] })
          .eq('id', slot.id)

        if (updErr) {
          await supabase.from('bloqueo_pasajeros').update(payload).eq('id', slot.id)
        }
      }

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
      fetchBloqueoData()
    } catch (err) {
      console.error('Error saving group:', err)
      showToast('Error al registrar grupo: ' + err.message, 'error')
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

      showToast(`¡${selectedSlotIds.length} pasajeros asociados al grupo "${name}"!`, 'success')
      setSelectedSlotIds([])
      setExistingGroupName('')
      setShowGroupExistingModal(false)
      fetchBloqueoData()
    } catch (err) {
      console.error('Error grouping passengers:', err)
      showToast('Error al agrupar pasajeros.', 'error')
    }
  }

  // Toggle Slot Selection
  const toggleSelectSlot = (id) => {
    setSelectedSlotIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      return [...prev, id]
    })
  }

  // Select all filtered occupied slots
  const selectAllOccupied = () => {
    const occupiedIds = filteredSlots.filter(p => p.nombres && p.nombres.trim() !== '').map(p => p.id)
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

  // Export Rooming List
  const handleExportRoomingList = async () => {
    if (!bloqueo || pasajeros.length === 0) return
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Rooming List')

    sheet.mergeCells('A1:L1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = `CTB VIAJANDO — ROOMING LIST & MANIFIESTO OFICIAL: ${bloqueo.titulo.toUpperCase()}`
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(1).height = 35

    sheet.mergeCells('A2:L2')
    const metaCell = sheet.getCell('A2')
    metaCell.value = `DESTINO: ${bloqueo.destino} | AEROLÍNEA: ${bloqueo.aerolinea || 'N/A'} | FECHA SALIDA: ${bloqueo.fecha_salida} | RETORNO: ${bloqueo.fecha_retorno || 'N/A'}`
    metaCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0066CC' } }
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(2).height = 25

    const headers = [
      '# PAX', 'GRUPO', 'NOMBRES', 'APELLIDOS', 'DOC / PASAPORTE', 'HABITACIÓN',
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
      { width: 14 }, { width: 24 }, { width: 10 }, { width: 18 }, { width: 16 },
      { width: 16 }, { width: 26 }
    ]

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Rooming_List_${bloqueo.codigo}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    showToast('Rooming List exportado a Excel.', 'success')
  }

  // Filtered list
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
        p.grupo_nombre?.toLowerCase().includes(term) ||
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
          Cargando tabla de pasajeros...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-28">
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
              <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                <MapPin size={13} className="text-primary" /> {bloqueo.destino}
              </span>
              {bloqueo.aerolinea && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
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
                <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full font-bold">
                  <Clock size={12} /> Deadline Nombres: {format(parseISO(bloqueo.fecha_limite_emision), "d 'de' MMMM", { locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: 2 Tipos de Ingreso + Rooming List */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportRoomingList}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-black text-xs uppercase tracking-wider transition-colors border border-emerald-200/60"
          >
            <FileSpreadsheet size={16} />
            Rooming List
          </button>

          <button
            onClick={() => {
              const freeSlot = pasajeros.find(p => !p.nombres || p.nombres.trim() === '')
              if (!freeSlot) {
                showToast('Todos los cupos de este bloqueo están ocupados.', 'error')
                return
              }
              handleOpenSingleSlot(freeSlot)
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 font-black text-xs uppercase tracking-wider shadow-sm transition-all"
          >
            <User size={16} className="text-primary" />
            + Ingreso Individual
          </button>

          <button
            onClick={handleOpenGroupModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-white hover:bg-primary/90 font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/25 transition-all"
          >
            <Layers size={16} />
            + Ingreso por Grupo
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

      {/* Floating / Active Bar for Grouping Selected Existing Passengers */}
      {selectedSlotIds.length > 0 && (
        <div className="bg-purple-900 text-white p-4 rounded-3xl shadow-xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black text-sm">
              {selectedSlotIds.length}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Pasajeros Seleccionados</p>
              <p className="text-[11px] text-purple-200">¿Deseas agruparlos bajo un mismo nombre de grupo?</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedSlotIds([])}
              className="px-3 py-1.5 rounded-xl bg-purple-800 text-purple-200 hover:text-white text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => setShowGroupExistingModal(true)}
              className="px-4 py-2 rounded-xl bg-white text-purple-950 font-black text-xs uppercase tracking-wider shadow hover:bg-purple-50 transition-all flex items-center gap-1.5"
            >
              <FolderPlus size={15} />
              Formar Grupo con Seleccionados
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
              {st === 'todos' ? 'Todos los Cupos' : st === 'ocupados' ? 'Ocupados' : st === 'libres' ? 'Disponibles' : 'Con Saldo'}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN PASSENGER TABLE */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="py-4 px-3 text-center w-10">
                  <button onClick={selectAllOccupied} title="Seleccionar ocupados" className="text-gray-400 hover:text-gray-700">
                    <CheckSquare size={14} />
                  </button>
                </th>
                <th className="py-4 px-3 text-center w-12"># PAX</th>
                <th className="py-4 px-4 min-w-[200px]">Pasajero / Grupo</th>
                <th className="py-4 px-4 min-w-[150px]">Agencia & Ciudad</th>
                <th className="py-4 px-4">Cotización</th>
                <th className="py-4 px-4 min-w-[130px]">Operativo & Comercial</th>
                <th className="py-4 px-4 min-w-[140px]">Hoteles & Servicio</th>
                <th className="py-4 px-4 min-w-[160px]">Plan de Pagos / Abonos</th>
                <th className="py-4 px-4 text-right">Saldo Faltante</th>
                <th className="py-4 px-4 min-w-[150px]">Observaciones</th>
                <th className="py-4 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium">
              {filteredSlots.map((slot) => {
                const isOccupied = slot.nombres && slot.nombres.trim() !== ''
                const faltante = Number(slot.faltante) || 0
                const precio = Number(slot.precio_acordado) || 0
                const isPaid = isOccupied && faltante === 0 && precio > 0
                const isSelected = selectedSlotIds.includes(slot.id)
                const planPagos = getSlotInstallments(slot)
                const totalPagado = planPagos.filter(p => p.estado === 'pagado').reduce((acc, p) => acc + (Number(p.monto) || 0), 0)

                return (
                  <tr
                    key={slot.id}
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

                    {/* Pasajero / Grupo */}
                    <td className="py-3 px-4">
                      {isOccupied ? (
                        <div>
                          <p className="font-black text-gray-900 leading-tight uppercase">
                            {slot.nombres} {slot.apellidos || ''}
                          </p>
                          {slot.grupo_nombre && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md mt-0.5 border border-purple-200/50">
                              <Users size={10} /> {slot.grupo_nombre}
                            </span>
                          )}
                          {slot.numero_documento && (
                            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
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
                          <p className="text-gray-500 text-[10px]">Com: {slot.comercial_nombre || 'S/A'}</p>
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
                          <span className="text-[10px] text-gray-500 block mt-0.5">{slot.tipo_servicio}</span>
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
                          <span className={`font-mono font-black text-sm ${faltante === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
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
                    <td className="py-3 px-4 text-[11px] text-gray-600 max-w-[200px] truncate">
                      {slot.observaciones || '—'}
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenSingleSlot(slot)}
                          className="p-2 rounded-xl bg-gray-50 hover:bg-primary hover:text-white text-gray-600 transition-colors shadow-sm"
                          title="Editar / Asignar Cupo"
                        >
                          <Edit3 size={14} />
                        </button>
                        {isOccupied && (
                          <button
                            onClick={() => handleReleaseSlot(slot)}
                            className="p-2 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Número Documento</label>
                    <input
                      type="text"
                      placeholder="0912345678"
                      value={singleForm.numero_documento}
                      onChange={(e) => setSingleForm({ ...singleForm, numero_documento: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Tipo Habitación</label>
                    <select
                      value={singleForm.tipo_habitacion}
                      onChange={(e) => setSingleForm({ ...singleForm, tipo_habitacion: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-bold"
                    >
                      <option value="Doble">Doble</option>
                      <option value="Triple">Triple</option>
                      <option value="Matrimonial">Matrimonial</option>
                      <option value="Simple">Simple (SGL)</option>
                      <option value="Twin">Twin</option>
                    </select>
                  </div>
                </div>
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
                    <label className="block text-gray-800 font-bold mb-1">Distribución Hotelera</label>
                    <input
                      type="text"
                      placeholder="Ej. GIMANI + PARAISO"
                      value={singleForm.hoteles}
                      onChange={(e) => setSingleForm({ ...singleForm, hoteles: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
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

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                  <div>
                    <label className="block text-gray-800 font-bold mb-1">Hoteles</label>
                    <input
                      type="text"
                      value={groupForm.hoteles}
                      onChange={(e) => setGroupForm({ ...groupForm, hoteles: e.target.value })}
                      className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold"
                    />
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
                        className="input w-28 py-1.5 text-xs font-bold bg-white text-gray-900 border border-gray-200"
                      >
                        <option value="Doble">Doble</option>
                        <option value="Triple">Triple</option>
                        <option value="Matrimonial">Matrimonial</option>
                        <option value="Simple">Simple</option>
                        <option value="Twin">Twin</option>
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
    </div>
  )
}
