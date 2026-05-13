'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  Save, 
  ArrowLeft, 
  UserPlus, 
  Trash2,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Percent
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
    notas_iniciales: '',
    valor_total: 0,
    valor_comision: 0,
    valor_utilidad: 0,
    valor_bono: 0
  })

  const handleAddPasajero = () => setPasajeros([...pasajeros, ''])
  
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
      router.push('/dashboard/cotizaciones')
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors">
          <ArrowLeft size={20} /> Volver
        </button>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Nueva Cotización Profesional</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Datos del Viaje */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card space-y-6">
            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
              <Calendar size={18} className="text-primary" /> Detalles del Requerimiento
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="label">Agencia solicitante</label>
                <input required className="input" placeholder="Ej: Viajes Mundo" value={formData.agencia} onChange={e => setFormData({...formData, agencia: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="label">Destino</label>
                <input required className="input" placeholder="Ej: Galápagos" value={formData.destino} onChange={e => setFormData({...formData, destino: e.target.value})} />
              </div>
              <div>
                <label className="label">N° Pasajeros</label>
                <input type="number" min="1" required className="input" value={formData.numero_pasajeros} onChange={e => setFormData({...formData, numero_pasajeros: parseInt(e.target.value)})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Caducidad</label>
                  <input type="date" required className="input text-xs" value={formData.fecha_caducidad} onChange={e => setFormData({...formData, fecha_caducidad: e.target.value})} />
                </div>
                <div>
                  <label className="label">Hora</label>
                  <input type="time" required className="input text-xs" value={formData.hora_caducidad} onChange={e => setFormData({...formData, hora_caducidad: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <UserPlus size={18} className="text-primary" /> Lista de Pasajeros
              </h3>
              <button type="button" onClick={handleAddPasajero} className="text-xs font-bold text-primary">+ Agregar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pasajeros.map((p, i) => (
                <input key={i} className="input text-sm" placeholder={`Nombre ${i+1}`} value={p} onChange={e => handlePasajeroChange(i, e.target.value)} />
              ))}
            </div>
          </div>

          <div className="card">
            <label className="label">Notas Internas / Observaciones</label>
            <textarea className="input min-h-[100px] text-sm" placeholder="Especificaciones del programa..." value={formData.notas_iniciales} onChange={e => setFormData({...formData, notas_iniciales: e.target.value})} />
          </div>
        </div>

        {/* Columna Derecha: Valores Financieros */}
        <div className="space-y-6">
          <div className="card bg-primary/5 border-primary/20 space-y-6 sticky top-24">
            <h3 className="font-bold text-primary border-b border-primary/10 pb-2 flex items-center gap-2">
              <DollarSign size={18} /> Proyección Financiera
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="label font-bold text-primary">Valor Total Venta ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-400 font-bold">$</span>
                  <input type="number" step="0.01" className="input pl-8 font-black text-lg" value={formData.valor_total} onChange={e => setFormData({...formData, valor_total: parseFloat(e.target.value)})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary/10">
                <div>
                  <label className="label text-[10px]">Comisión ($)</label>
                  <input type="number" step="0.01" className="input text-sm font-bold text-success" value={formData.valor_comision} onChange={e => setFormData({...formData, valor_comision: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="label text-[10px]">Utilidad ($)</label>
                  <input type="number" step="0.01" className="input text-sm font-bold text-success" value={formData.valor_utilidad} onChange={e => setFormData({...formData, valor_utilidad: parseFloat(e.target.value)})} />
                </div>
              </div>

              <div>
                <label className="label text-[10px]">Bono Counter ($)</label>
                <input type="number" step="0.01" className="input text-sm text-gray-500" value={formData.valor_bono} onChange={e => setFormData({...formData, valor_bono: parseFloat(e.target.value)})} />
              </div>

              <div className="bg-success text-white p-4 rounded-xl shadow-lg shadow-success/20">
                <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest">Aporte a mi Meta</p>
                <h4 className="text-2xl font-black">${(formData.valor_comision + formData.valor_utilidad).toLocaleString()}</h4>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2">
              {loading ? 'Guardando...' : <><Save size={20} /> Guardar Cotización</>}
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}
