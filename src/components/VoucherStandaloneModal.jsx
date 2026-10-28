'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  X, AlertCircle, Hotel, Bus, Plane, Map, QrCode, DollarSign, User, Calendar, PhoneCall, Plus, Trash2
} from 'lucide-react'
import { showToast } from '@/utils/toast'
import { parseEmergencyContacts, formatEmergencyContacts } from '@/utils/emergencyContacts'

export default function VoucherStandaloneModal({ onSaved }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [existingVoucher, setExistingVoucher] = useState(null)
  const isEditing = !!existingVoucher

  const [inclusions, setInclusions] = useState({ hotel: true, traslados: false, boletos: false, tours: false, seguro: false })
  const [emergencyContacts, setEmergencyContacts] = useState([{ id: 1, nombre: '', telefono: '' }])
  const [formData, setFormData] = useState({
    agencia: '',
    destino: '',
    total: 0,
    pasajeros_voucher: '',
    fecha_viaje_desde: '',
    fecha_viaje_hasta: '',
    notas_voucher: '',
    numero_emergencia: '',
    recordatorio_dias_antes: '',
    recordatorio_texto: ''
  })

  useEffect(() => {
    const handleOpen = (e) => {
      const v = e.detail
      if (v) {
        setExistingVoucher(v)
        setEmergencyContacts(parseEmergencyContacts(v.numero_emergencia))
        setFormData({
          agencia: v.agencia || '',
          destino: v.destino || '',
          total: v.valor_total || 0,
          pasajeros_voucher: Array.isArray(v.pasajeros) ? v.pasajeros.join('\n') : (v.pasajeros || ''),
          fecha_viaje_desde: v.fecha_viaje_desde || '',
          fecha_viaje_hasta: v.fecha_viaje_hasta || '',
          notas_voucher: v.notas || '',
          numero_emergencia: v.numero_emergencia || '',
          recordatorio_dias_antes: v.recordatorio_dias_antes?.toString() || '',
          recordatorio_texto: v.recordatorio_texto || ''
        })
        if (v.inclusiones) {
          setInclusions(v.inclusiones)
        }
      } else {
        setExistingVoucher(null)
        setEmergencyContacts([{ id: 1, nombre: '', telefono: '' }])
        setFormData({
          agencia: '',
          destino: '',
          total: 0,
          pasajeros_voucher: '',
          fecha_viaje_desde: '',
          fecha_viaje_hasta: '',
          notas_voucher: '',
          numero_emergencia: '',
          recordatorio_dias_antes: '',
          recordatorio_texto: ''
        })
        setInclusions({ hotel: true, traslados: false, boletos: false, tours: false, seguro: false })
      }
      setIsOpen(true)
    }

    window.addEventListener('open-standalone-voucher-modal', handleOpen)
    return () => window.removeEventListener('open-standalone-voucher-modal', handleOpen)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión activa')

      const pasajerosArr = formData.pasajeros_voucher ? formData.pasajeros_voucher.split('\n').map(s => s.trim()).filter(Boolean) : []
      const emergencyStr = formatEmergencyContacts(emergencyContacts)

      const vchCommon = {
        fecha_viaje_desde: formData.fecha_viaje_desde || null,
        fecha_viaje_hasta: formData.fecha_viaje_hasta || null,
        fecha_caducidad: formData.fecha_viaje_hasta || null,
        inclusiones: inclusions,
        notas: formData.notas_voucher,
        agencia: formData.agencia,
        valor_total: Number(formData.total) || 0,
        pasajeros: pasajerosArr,
        destino: formData.destino,
        numero_emergencia: emergencyStr || null,
        recordatorio_dias_antes: formData.recordatorio_dias_antes ? Number(formData.recordatorio_dias_antes) : null,
        recordatorio_texto: formData.recordatorio_texto || null
      }

      let missingEmergencyCol = false
      if (isEditing) {
        let { error: vchError } = await supabase.from('vouchers').update(vchCommon).eq('id', existingVoucher.id)
        if (vchError && (vchError.code === '42703' || vchError.message?.includes('numero_emergencia'))) {
          missingEmergencyCol = Boolean(vchCommon.numero_emergencia)
          const { numero_emergencia: _ignored, ...fallbackPayload } = vchCommon
          if (missingEmergencyCol) {
            fallbackPayload.notas = fallbackPayload.notas
              ? `${fallbackPayload.notas}\n[Emergencia: ${vchCommon.numero_emergencia}]`
              : `[Emergencia: ${vchCommon.numero_emergencia}]`
          }
          const retry = await supabase.from('vouchers').update(fallbackPayload).eq('id', existingVoucher.id)
          vchError = retry.error
        }
        if (vchError) throw vchError
        if (missingEmergencyCol) {
          showToast('Voucher guardado (contacto en notas). Falta migración SQL para columna numero_emergencia.', 'warning')
        } else {
          showToast('Voucher actualizado correctamente')
        }
      } else {
        const insertPayload = {
          venta_id: null, // Voucher independiente
          operativo_id: user.id,
          codigo: `VCH-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          estado: 'activo',
          ...vchCommon
        }
        let { error: vchError } = await supabase.from('vouchers').insert([insertPayload])
        if (vchError && (vchError.code === '42703' || vchError.message?.includes('numero_emergencia'))) {
          missingEmergencyCol = Boolean(vchCommon.numero_emergencia)
          const { numero_emergencia: _ignored, ...fallbackPayload } = insertPayload
          if (missingEmergencyCol) {
            fallbackPayload.notas = fallbackPayload.notas
              ? `${fallbackPayload.notas}\n[Emergencia: ${vchCommon.numero_emergencia}]`
              : `[Emergencia: ${vchCommon.numero_emergencia}]`
          }
          const retry = await supabase.from('vouchers').insert([fallbackPayload])
          vchError = retry.error
        }
        if (vchError) throw vchError
        if (missingEmergencyCol) {
          showToast('Voucher creado (contacto en notas). Falta migración SQL para columna numero_emergencia.', 'warning')
        } else {
          showToast('Voucher creado correctamente')
        }
      }

      setIsOpen(false)
      if (onSaved) onSaved()
      else window.location.reload()

    } catch (error) {
      console.error('Error al guardar voucher:', error)
      showToast(error.message || 'Error desconocido al guardar el voucher', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const incIcons = { hotel: Hotel, traslados: Bus, boletos: Plane, tours: Map, seguro: AlertCircle }

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className={`p-7 text-white flex justify-between items-start ${isEditing ? 'bg-gray-900' : 'bg-primary'}`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black bg-white/20 px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5">
                <QrCode size={12} /> Voucher Independiente
              </span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">
              {isEditing ? 'Editar Voucher' : 'Nuevo Voucher'}
            </h2>
            <p className="text-xs opacity-90 uppercase tracking-widest mt-1.5">
              Sin venta asociada
            </p>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:rotate-90 hover:bg-white/10 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-7 space-y-7">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase mb-1">Agencia / Cliente</p>
              <input
                type="text"
                className="bg-transparent border-none font-black text-gray-900 text-sm p-0 w-full outline-none"
                placeholder="Ej: Agencia de Viajes XYZ"
                value={formData.agencia}
                required
                onChange={e => setFormData({ ...formData, agencia: e.target.value })}
              />
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase mb-1">Destino</p>
              <input
                type="text"
                className="bg-transparent border-none font-black text-gray-900 text-sm p-0 w-full outline-none"
                placeholder="Ej: UIO | Quito, Ecuador"
                value={formData.destino}
                required
                onChange={e => setFormData({ ...formData, destino: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-400 uppercase mb-1 flex items-center gap-2">
              <DollarSign size={16} /> Valor Referencial (Opcional)
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-gray-400 font-bold">$</span>
              <input
                type="number" step="0.01"
                className="bg-transparent border-none font-black text-gray-900 text-xl p-0 w-full outline-none"
                value={formData.total}
                onChange={e => setFormData({ ...formData, total: e.target.value })}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <User size={16} /> Nombres de Pasajeros / Nombre de Grupo
            </p>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <textarea
                className="bg-transparent border-none font-black text-gray-900 text-sm p-0 w-full outline-none resize-y min-h-[60px]"
                placeholder="Juan Pérez&#10;Familia García..."
                value={formData.pasajeros_voucher}
                required
                onChange={e => setFormData({ ...formData, pasajeros_voucher: e.target.value })}
              />
              <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Un nombre por línea.</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="font-black text-primary uppercase tracking-tighter flex items-center gap-2">
              <QrCode size={16} /> Configuración del Voucher
            </p>

            <div className="grid grid-cols-5 gap-2">
              {Object.entries(incIcons).map(([item, Icon]) => (
                <button key={item} type="button" onClick={() => setInclusions({ ...inclusions, [item]: !inclusions[item] })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-xs ${inclusions[item] ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}>
                  <Icon size={18} />
                  <span className="text-xs font-black uppercase">{item}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase">Inicio del viaje</label>
                <input type="date" required className="input font-bold mt-1 text-xs" value={formData.fecha_viaje_desde} onChange={e => setFormData({ ...formData, fecha_viaje_desde: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase">Fin del viaje</label>
                <input type="date" required className="input font-bold mt-1 text-xs" value={formData.fecha_viaje_hasta} onChange={e => setFormData({ ...formData, fecha_viaje_hasta: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-gray-500 uppercase flex items-center gap-1.5">
                    <PhoneCall size={14} className="text-primary" /> Contactos / Números de Emergencia
                  </label>
                  <button
                    type="button"
                    onClick={() => setEmergencyContacts([...emergencyContacts, { id: Date.now(), nombre: '', telefono: '' }])}
                    className="text-[11px] font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-wider flex items-center gap-1"
                  >
                    <Plus size={13} /> Añadir destino / contacto
                  </button>
                </div>

                <div className="space-y-2">
                  {emergencyContacts.map((c, idx) => (
                    <div key={c.id || idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <input
                          type="text"
                          className="input font-bold text-xs bg-white"
                          placeholder="Destino / Nombre (ej: Cartagena - Wainer V.)"
                          value={c.nombre}
                          onChange={e => {
                            const updated = [...emergencyContacts]
                            updated[idx] = { ...updated[idx], nombre: e.target.value }
                            setEmergencyContacts(updated)
                          }}
                        />
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          className="input font-bold text-xs bg-white font-mono"
                          placeholder="Teléfono (ej: +57 300 2504385)"
                          value={c.telefono}
                          onChange={e => {
                            const updated = [...emergencyContacts]
                            updated[idx] = { ...updated[idx], telefono: e.target.value }
                            setEmergencyContacts(updated)
                          }}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {emergencyContacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setEmergencyContacts(emergencyContacts.filter((_, i) => i !== idx))}
                            className="text-gray-300 hover:text-danger p-1 transition-colors"
                            title="Eliminar contacto"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Si el viaje tiene varios destinos, añade un contacto y teléfono para cada uno.
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-black text-gray-400 uppercase">Notas para el pasajero</label>
                <textarea className="input text-xs mt-1 min-h-[70px]" placeholder="Indicaciones, observaciones..." value={formData.notas_voucher} onChange={e => setFormData({ ...formData, notas_voucher: e.target.value })} />
              </div>
              <div className="col-span-1">
                <label className="text-xs font-black text-gray-400 uppercase">Días para Aviso</label>
                <input type="number" min="0" className="input font-bold mt-1 text-xs" placeholder="Ej: 5" value={formData.recordatorio_dias_antes} onChange={e => setFormData({ ...formData, recordatorio_dias_antes: e.target.value })} />
                <p className="text-[10px] text-gray-400 mt-1">Aviso telegram antes de viaje</p>
              </div>
              <div className="col-span-1">
                <label className="text-xs font-black text-gray-400 uppercase">Nota de aviso</label>
                <input type="text" className="input font-bold mt-1 text-xs" placeholder="Ej: Pago de hotel" value={formData.recordatorio_texto} onChange={e => setFormData({ ...formData, recordatorio_texto: e.target.value })} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className={`w-full py-5 rounded-2xl text-lg font-black uppercase tracking-tighter shadow-xl transition-all hover:scale-[1.01] active:scale-95 text-white ${isEditing ? 'bg-gray-900 shadow-gray-900/20' : 'bg-primary shadow-primary/30'}`}>
            {loading ? 'Guardando...' : isEditing ? '✓ Guardar Cambios' : '✦ Generar Voucher Independiente'}
          </button>
        </form>
      </div>
    </div>
  )
}
