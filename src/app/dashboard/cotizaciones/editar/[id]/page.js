'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { 
  Save, 
  ArrowLeft, 
  UserPlus, 
  Trash2,
  Calendar,
  Clock,
  DollarSign
} from 'lucide-react'
import { showToast } from '@/utils/toast'
import { logActivity } from '@/utils/audit'

export default function EditarCotizacionPage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    valor_bono: 0,
    comercial: ''
  })

  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function checkAuthAndFetch() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        const { data: p } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', user.id)
          .single()

        if (p?.rol !== 'superadmin') {
          showToast('Acceso restringido. Solo el Super Admin puede editar cotizaciones.', 'error')
          router.push('/dashboard/cotizaciones')
          return
        }

        setProfile(p)
        await fetchQuote()
      } catch (err) {
        console.error('Error de autenticación:', err)
        router.push('/dashboard/cotizaciones')
      }
    }
    checkAuthAndFetch()
  }, [id])

  async function fetchQuote() {
    const { data, error } = await supabase
      .from('cotizaciones')
      .select('id, agencia, destino, numero_pasajeros, fecha_caducidad, hora_caducidad, notas_iniciales, valor_total, valor_comision, valor_utilidad, valor_bono, comercial, nombres_pasajeros')
      .eq('id', id)
      .single()
    
    if (data) {
      setFormData({
        agencia: data.agencia || '',
        destino: data.destino || '',
        numero_pasajeros: data.numero_pasajeros || 1,
        fecha_caducidad: data.fecha_caducidad || '',
        hora_caducidad: data.hora_caducidad || '',
        notas_iniciales: data.notas_iniciales || '',
        valor_total: data.valor_total || 0,
        valor_comision: data.valor_comision || 0,
        valor_utilidad: data.valor_utilidad || 0,
        valor_bono: data.valor_bono || 0,
        comercial: data.comercial || ''
      })
      setPasajeros(data.nombres_pasajeros || [''])
    }
    setLoading(false)
  }

  const handlePasajeroChange = (idx, val) => {
    const n = [...pasajeros]
    n[idx] = val
    setPasajeros(n)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        agencia: formData.agencia,
        comercial: formData.comercial,
        destino: formData.destino,
        numero_pasajeros: formData.numero_pasajeros || 1,
        fecha_caducidad: formData.fecha_caducidad || null,
        hora_caducidad: formData.hora_caducidad || null,
        notas_iniciales: formData.notas_iniciales,
        valor_total: Number(formData.valor_total) || 0,
        valor_comision: Number(formData.valor_comision) || 0,
        valor_utilidad: Number(formData.valor_utilidad) || 0,
        valor_bono: Number(formData.valor_bono) || 0,
        nombres_pasajeros: pasajeros.filter(p => p.trim() !== ''),
        estado: 'abierta',
        created_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('cotizaciones')
        .update(payload)
        .eq('id', id)
      
      if (error) throw error
      
      // Log edit activity
      await logActivity('editar_cotizacion', `Se editó la cotización ID ${id.slice(0, 8)}... (Agencia: ${payload.agencia}, Destino: ${payload.destino}, Total: $${payload.valor_total}).`)

      router.push('/dashboard/cotizaciones')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-10 text-center animate-pulse">Cargando datos de cotización...</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors font-bold">
          <ArrowLeft size={20} /> Cancelar Edición
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Editar Cotización {id.slice(0,8)}</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card space-y-6">
            <h3 className="font-bold text-gray-800 border-b pb-2">Datos Principales</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="label">Agencia</label>
                <input required className="input" value={formData.agencia} onChange={e => setFormData({...formData, agencia: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="label">Comercial</label>
                <input required className="input" value={formData.comercial} onChange={e => setFormData({...formData, comercial: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="label">Destino</label>
                <input required className="input" value={formData.destino} onChange={e => setFormData({...formData, destino: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2 col-span-2">
                <div>
                  <label className="label">Caducidad</label>
                  <input type="date" className="input" value={formData.fecha_caducidad} onChange={e => setFormData({...formData, fecha_caducidad: e.target.value})} />
                </div>
                <div>
                  <label className="label">Hora</label>
                  <input type="time" className="input" value={formData.hora_caducidad} onChange={e => setFormData({...formData, hora_caducidad: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="font-bold text-gray-800 border-b pb-2">Pasajeros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {pasajeros.map((p, i) => (
                <input key={i} className="input text-sm" value={p} onChange={e => handlePasajeroChange(i, e.target.value)} />
              ))}
            </div>
            <button type="button" onClick={() => setPasajeros([...pasajeros, ''])} className="text-xs font-bold text-primary">+ Añadir pasajero</button>
          </div>

          <div className="card space-y-4">
            <h3 className="font-bold text-gray-800 border-b pb-2">Observaciones / Especificaciones del Programa</h3>
            <textarea
              className="input mt-1 min-h-[120px] text-sm resize-none"
              placeholder="Descripción del viaje, preferencias, tipo de servicio requerido..."
              value={formData.notas_iniciales}
              onChange={e => setFormData({ ...formData, notas_iniciales: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card bg-gray-50 border-gray-200 space-y-6">
            <h3 className="font-bold text-gray-800 border-b pb-2">Valores Financieros</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Total Venta ($)</label>
                <input type="number" step="0.01" className="input font-bold" value={formData.valor_total === 0 && formData.valor_total !== '' ? 0 : formData.valor_total || ''} onChange={e => setFormData({...formData, valor_total: e.target.value === '' ? '' : parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="label">Utilidad ($)</label>
                <input type="number" step="0.01" className="input text-success font-bold" value={formData.valor_utilidad === 0 && formData.valor_utilidad !== '' ? 0 : formData.valor_utilidad || ''} onChange={e => setFormData({...formData, valor_utilidad: e.target.value === '' ? '' : parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="label">Comisión ($)</label>
                <input type="number" step="0.01" className="input text-success font-bold" value={formData.valor_comision === 0 && formData.valor_comision !== '' ? 0 : formData.valor_comision || ''} onChange={e => setFormData({...formData, valor_comision: e.target.value === '' ? '' : parseFloat(e.target.value)})} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full py-4 shadow-xl">
              {saving ? 'Guardando...' : 'Actualizar Cotización'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
