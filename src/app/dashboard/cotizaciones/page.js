'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  Save, 
  ArrowLeft, 
  UserPlus, 
  Trash2,
  Calendar,
  Clock
} from 'lucide-react'

export default function NuevaCotizacionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pasajeros, setPasajeros] = useState([''])
  const [formData, setFormData] = useState({
    agencia: '',
    destino: '',
    numero_pasajeros: 1,
    fecha_caducidad: '',
    hora_caducidad: '',
    notas_iniciales: ''
  })

  const handleAddPasajero = () => {
    setPasajeros([...pasajeros, ''])
  }

  const handleRemovePasajero = (index) => {
    const newPasajeros = pasajeros.filter((_, i) => i !== index)
    setPasajeros(newPasajeros)
  }

  const handlePasajeroChange = (index, value) => {
    const newPasajeros = [...pasajeros]
    newPasajeros[index] = value
    setPasajeros(newPasajeros)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('cotizaciones')
        .insert([{
          ...formData,
          operativo_id: user.id,
          nombres_pasajeros: pasajeros.filter(p => p.trim() !== ''),
          estado: 'abierta'
        }])

      if (error) throw error

      router.push('/dashboard')
    } catch (error) {
      alert('Error al guardar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
        >
          <ArrowLeft size={20} />
          Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Cotización</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Información del Viaje</h3>
          </div>
          
          <div>
            <label className="block text-sm font-semibold mb-1">Agencia solicitante</label>
            <input 
              required
              className="input"
              placeholder="Ej: Viajes Ecuador"
              value={formData.agencia}
              onChange={e => setFormData({...formData, agencia: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Destino</label>
            <input 
              required
              className="input"
              placeholder="Ej: Punta Cana"
              value={formData.destino}
              onChange={e => setFormData({...formData, destino: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Número de Pasajeros</label>
            <input 
              type="number"
              min="1"
              required
              className="input"
              value={formData.numero_pasajeros}
              onChange={e => setFormData({...formData, numero_pasajeros: parseInt(e.target.value)})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 flex items-center gap-1">
                <Calendar size={14} /> Caducidad
              </label>
              <input 
                type="date"
                required
                className="input"
                value={formData.fecha_caducidad}
                onChange={e => setFormData({...formData, fecha_caducidad: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 flex items-center gap-1">
                <Clock size={14} /> Hora
              </label>
              <input 
                type="time"
                required
                className="input"
                value={formData.hora_caducidad}
                onChange={e => setFormData({...formData, hora_caducidad: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <UserPlus size={20} className="text-primary" />
              Lista de Pasajeros
            </h3>
            <button 
              type="button"
              onClick={handleAddPasajero}
              className="text-xs font-bold text-primary hover:underline"
            >
              + Agregar otro
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pasajeros.map((pasajero, index) => (
              <div key={index} className="flex gap-2">
                <input 
                  className="input flex-1"
                  placeholder={`Nombre Pasajero ${index + 1}`}
                  value={pasajero}
                  onChange={e => handlePasajeroChange(index, e.target.value)}
                />
                {pasajeros.length > 1 && (
                  <button 
                    type="button"
                    onClick={() => handleRemovePasajero(index)}
                    className="text-danger hover:bg-red-50 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <label className="block text-sm font-semibold mb-1">Notas / Observaciones Iniciales</label>
          <textarea 
            className="input min-h-[100px]"
            placeholder="Detalles especiales del requerimiento..."
            value={formData.notas_iniciales}
            onChange={e => setFormData({...formData, notas_iniciales: e.target.value})}
          />
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-4 text-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-3"
        >
          {loading ? 'Guardando...' : (
            <>
              <Save size={24} />
              Guardar Cotización
            </>
          )}
        </button>
      </form>
    </div>
  )
}
