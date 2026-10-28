'use client'

import { useState } from 'react'
import { XCircle, Save, PhoneCall, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/utils/toast'
import { logActivity } from '@/utils/audit'
import { parseEmergencyContacts, formatEmergencyContacts } from '@/utils/emergencyContacts'

export default function VoucherEditModal({ voucher, onClose, onSuccess }) {
  const [editingVoucher, setEditingVoucher] = useState(voucher)
  const [emergencyContacts, setEmergencyContacts] = useState(() => parseEmergencyContacts(voucher?.numero_emergencia))
  const [loading, setLoading] = useState(false)

  const handleUpdateVoucher = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const emergencyStr = formatEmergencyContacts(emergencyContacts)
      const pasajerosArr = typeof editingVoucher.pasajeros === 'string'
        ? editingVoucher.pasajeros.split('\n').map(s => s.trim()).filter(Boolean)
        : editingVoucher.pasajeros || []

      const vchPayload = {
        agencia: editingVoucher.agencia,
        destino: editingVoucher.destino,
        pasajeros: pasajerosArr,
        fecha_viaje_desde: editingVoucher.fecha_viaje_desde,
        fecha_viaje_hasta: editingVoucher.fecha_viaje_hasta,
        fecha_caducidad: editingVoucher.fecha_viaje_hasta,
        numero_emergencia: emergencyStr || null,
        notas: editingVoucher.notas,
        recordatorio_texto: editingVoucher.recordatorio_texto || null,
        recordatorio_dias_antes: editingVoucher.recordatorio_dias_antes || null
      }

      let { error } = await supabase
        .from('vouchers')
        .update(vchPayload)
        .eq('id', editingVoucher.id)

      let missingEmergencyCol = false
      if (error && (error.code === '42703' || error.message?.includes('numero_emergencia'))) {
        missingEmergencyCol = Boolean(vchPayload.numero_emergencia)
        const { numero_emergencia: _ignored, ...fallbackPayload } = vchPayload
        if (missingEmergencyCol) {
          fallbackPayload.notas = fallbackPayload.notas
            ? `${fallbackPayload.notas}\n[Emergencia: ${vchPayload.numero_emergencia}]`
            : `[Emergencia: ${vchPayload.numero_emergencia}]`
        }
        const retry = await supabase.from('vouchers').update(fallbackPayload).eq('id', editingVoucher.id)
        error = retry.error
      }

      if (!error) {
        logActivity('editar_voucher', `Se editó el voucher ${editingVoucher.codigo} (Agencia: ${editingVoucher.agencia}, Destino: ${editingVoucher.destino}).`)
        if (missingEmergencyCol) {
          showToast('Voucher actualizado (contacto en notas). Falta migración SQL para columna numero_emergencia.', 'warning')
        } else {
          showToast('Voucher actualizado correctamente.')
        }
        onSuccess()
      } else {
        showToast(error.message, 'error')
      }
    } catch (error) {
      showToast('Error al actualizar el voucher', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[160] flex items-center justify-center p-4">
      <form onSubmit={handleUpdateVoucher} className="bg-white rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="bg-primary p-8 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black">Editar Voucher</h2>
            <button type="button" onClick={onClose}><XCircle size={24} /></button>
          </div>
          <p className="text-xs opacity-80 mt-1 uppercase tracking-widest font-bold">{editingVoucher.codigo}</p>
        </div>

        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Agencia</label>
              <input
                className="input text-sm"
                value={editingVoucher.agencia || ''}
                onChange={e => setEditingVoucher({...editingVoucher, agencia: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Destino</label>
              <input
                className="input text-sm"
                value={editingVoucher.destino || ''}
                onChange={e => setEditingVoucher({...editingVoucher, destino: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-gray-400 uppercase">Nombres de Pasajeros (uno por línea)</label>
            <textarea
              className="input text-sm min-h-[90px] font-mono"
              placeholder="Juan Pérez&#10;María García&#10;Carlos López..."
              value={Array.isArray(editingVoucher.pasajeros) ? editingVoucher.pasajeros.join('\n') : (editingVoucher.pasajeros || '')}
              onChange={e => setEditingVoucher({...editingVoucher, pasajeros: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Válido Desde</label>
              <input
                type="date"
                className="input text-sm"
                value={editingVoucher.fecha_viaje_desde || ''}
                onChange={e => setEditingVoucher({...editingVoucher, fecha_viaje_desde: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Válido Hasta</label>
              <input
                type="date"
                className="input text-sm"
                value={editingVoucher.fecha_viaje_hasta || ''}
                onChange={e => setEditingVoucher({...editingVoucher, fecha_viaje_hasta: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Días antes para Recordatorio</label>
              <input
                type="number"
                min="0"
                placeholder="Ej: 5"
                className="input text-sm"
                value={editingVoucher.recordatorio_dias_antes || ''}
                onChange={e => setEditingVoucher({...editingVoucher, recordatorio_dias_antes: e.target.value ? Number(e.target.value) : null})}
              />
              <p className="text-[10px] text-gray-400 font-bold">Aviso en Telegram antes del inicio del viaje</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase">Nota del Recordatorio</label>
              <input
                className="input text-sm"
                placeholder="Ej: Pagar a hotel y traslados"
                value={editingVoucher.recordatorio_texto || ''}
                onChange={e => setEditingVoucher({...editingVoucher, recordatorio_texto: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100">
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

          <div className="space-y-1">
            <label className="text-xs font-black text-gray-400 uppercase">Notas Adicionales</label>
            <textarea
              className="input text-sm min-h-[80px]"
              value={editingVoucher.notes || editingVoucher.notas || ''}
              onChange={e => setEditingVoucher({...editingVoucher, notas: e.target.value})}
            />
          </div>
        </div>

        <div className="p-8 bg-gray-50 flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 btn-primary py-4 flex items-center justify-center gap-2 ${loading ? 'opacity-50' : ''}`}
          >
            <Save size={20} /> {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
