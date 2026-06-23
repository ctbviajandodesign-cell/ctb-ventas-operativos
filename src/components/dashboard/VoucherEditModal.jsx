'use client'

import { useState } from 'react'
import { XCircle, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { showToast } from '@/utils/toast'
import { logActivity } from '@/utils/audit'

export default function VoucherEditModal({ voucher, onClose, onSuccess }) {
  const [editingVoucher, setEditingVoucher] = useState(voucher)
  const [loading, setLoading] = useState(false)

  const handleUpdateVoucher = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const pasajerosArr = typeof editingVoucher.pasajeros === 'string'
        ? editingVoucher.pasajeros.split('\n').map(s => s.trim()).filter(Boolean)
        : editingVoucher.pasajeros || []
        
      const { error } = await supabase
        .from('vouchers')
        .update({
          agencia: editingVoucher.agencia,
          destino: editingVoucher.destino,
          pasajeros: pasajerosArr,
          fecha_viaje_desde: editingVoucher.fecha_viaje_desde,
          fecha_viaje_hasta: editingVoucher.fecha_viaje_hasta,
          fecha_caducidad: editingVoucher.fecha_viaje_hasta,
          notas: editingVoucher.notas,
          recordatorio_texto: editingVoucher.recordatorio_texto || null,
          recordatorio_dias_antes: editingVoucher.recordatorio_dias_antes || null
        })
        .eq('id', editingVoucher.id)
        
      if (!error) {
        logActivity('editar_voucher', `Se editó el voucher ${editingVoucher.codigo} (Agencia: ${editingVoucher.agencia}, Destino: ${editingVoucher.destino}).`)
        showToast('Voucher actualizado correctamente.')
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
