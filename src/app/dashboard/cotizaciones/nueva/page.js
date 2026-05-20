'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, MapPin, Users, FileText } from 'lucide-react'
import { showToast } from '@/utils/toast'

export default function NuevaCotizacionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    agencia: '',
    destino: '',
    numero_pasajeros: 1,
    notas_iniciales: '',
    comercial: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('cotizaciones')
        .insert([{
          agencia: formData.agencia,
          destino: formData.destino,
          numero_pasajeros: formData.numero_pasajeros,
          notas_iniciales: formData.notas_iniciales,
          comercial: formData.comercial,
          operativo_id: user.id,
          estado: 'abierta',
          // Valores financieros en 0 por defecto — se llenan al aprobar
          valor_total: 0,
          valor_comision: 0,
          valor_utilidad: 0,
          valor_bono: 0,
          nombres_pasajeros: []
        }])
      if (error) throw error
      router.push('/dashboard/cotizaciones')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors text-gray-500 hover:text-primary"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">
            Nueva Cotización
          </h1>
          <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
            Registro de requerimiento del cliente
          </p>

        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card única con campos esenciales */}
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 space-y-6">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <FileText size={16} className="text-primary" /> Datos del Requerimiento
          </h3>


          {/* Agencia */}
          <div>
            <label className="label">Agencia / Cliente Solicitante</label>
            <input
              required
              className="input mt-1"
              placeholder="Ej: Viajes Mundo, Juan García..."
              value={formData.agencia}
              onChange={e => setFormData({ ...formData, agencia: e.target.value })}
            />
          </div>

          {/* Comercial */}
          <div>
            <label className="label">Comercial</label>
            <input
              required
              className="input mt-1"
              placeholder="Ej: Nombre del Comercial..."
              value={formData.comercial}
              onChange={e => setFormData({ ...formData, comercial: e.target.value })}
            />
          </div>

          {/* Destino */}
          <div>
            <label className="label flex items-center gap-1.5">
              <MapPin size={12} className="text-primary" /> Destino del Viaje
            </label>
            <input
              required
              className="input mt-1"
              placeholder="Ej: Galápagos, Cancún, París..."
              value={formData.destino}
              onChange={e => setFormData({ ...formData, destino: e.target.value })}
            />
          </div>

          {/* Número de pasajeros */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Users size={12} className="text-primary" /> Número de Pasajeros
            </label>
            <input
              required
              type="number"
              min="1"
              max="200"
              className="input mt-1 w-32 font-black text-lg"
              value={formData.numero_pasajeros}
              onChange={e => setFormData({ ...formData, numero_pasajeros: parseInt(e.target.value) || 1 })}
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="label">Observaciones / Especificaciones del Programa</label>
            <textarea
              className="input mt-1 min-h-[120px] text-sm resize-none"
              placeholder="Descripción del viaje, preferencias, tipo de servicio requerido..."
              value={formData.notas_iniciales}
              onChange={e => setFormData({ ...formData, notas_iniciales: e.target.value })}
            />
          </div>

          <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl">
            <p className="text-xs font-black text-primary uppercase tracking-widest mb-1">ℹ Nota</p>
            <p className="text-xs text-primary/80 leading-relaxed">
              Los valores financieros (total, comisión, utilidad) se registran únicamente al aprobar y convertir esta cotización en Proforma de Venta.
            </p>
          </div>

        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-5 rounded-2xl font-black text-lg uppercase tracking-tighter shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          {loading ? (
            <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Guardando...</span>
          ) : (
            <><Save size={20} /> Registrar Cotización</>
          )}
        </button>
      </form>
    </div>
  )
}
