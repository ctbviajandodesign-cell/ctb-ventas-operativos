'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  Save, 
  ArrowLeft, 
  MapPin, 
  Users, 
  FileText, 
  Plus, 
  Trash2, 
  DollarSign
} from 'lucide-react'
import { showToast } from '@/utils/toast'
import IataSelector from '@/components/IataSelector'
import { useUserSession } from '@/hooks/useUserSession'

export default function NuevaCotizacionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pasajeros, setPasajeros] = useState([''])
  
  const [iatas, setIatas] = useState([''])
  const [destinoNombre, setDestinoNombre] = useState('')
  
  const [comerciales, setComerciales] = useState([])
  const [tipoComercial, setTipoComercial] = useState('')
  const [comercialManual, setComercialManual] = useState('')

  const { user } = useUserSession()

  useEffect(() => {
    if (!user) return
    supabase.from('comerciales').select('id, nombre, ciudad').then(({ data }) => {
      setComerciales(data || [])
    })
  }, [user])
  
  const [formData, setFormData] = useState({
    agencia: '',
    destino: '',
    numero_pasajeros: 1,
    notas_iniciales: '',
    comercial: '',
    valor_total: '',
    valor_comision: '',
    valor_utilidad: '',
    valor_bono: ''
  })

  const handlePasajeroChange = (idx, val) => {
    const n = [...pasajeros]
    n[idx] = val
    setPasajeros(n)
  }

  const removePasajero = (idx) => {
    const n = pasajeros.filter((_, i) => i !== idx)
    setPasajeros(n.length > 0 ? n : [''])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión de usuario activa.')

      const filteredPasajeros = pasajeros.filter(p => p.trim() !== '')
      
      const filteredIatas = iatas.filter(i => i.trim() !== '')
      if (filteredIatas.length === 0 && !destinoNombre.trim()) {
        throw new Error('Debe ingresar al menos un destino (IATA o Nombre).')
      }
      
      const destinoCombined = `${filteredIatas.join(',')}${destinoNombre.trim() ? '|' + destinoNombre.trim() : ''}`

      const { error } = await supabase
        .from('cotizaciones')
        .insert([{
          agencia: formData.agencia,
          destino: destinoCombined,
          numero_pasajeros: formData.numero_pasajeros,
          notas_iniciales: formData.notas_iniciales,
          comercial: formData.comercial,
          operativo_id: user.id,
          estado: 'abierta',
          valor_total: Number(formData.valor_total) || 0,
          valor_comision: Number(formData.valor_comision) || 0,
          valor_utilidad: Number(formData.valor_utilidad) || 0,
          valor_bono: Number(formData.valor_bono) || 0,
          nombres_pasajeros: filteredPasajeros
        }])

      if (error) throw error
      showToast('Cotización registrada con éxito.')
      router.push('/dashboard/cotizaciones')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
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

      <form 
        onSubmit={handleSubmit} 
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault()
          }
        }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* COLUMNA IZQUIERDA: DATOS PRINCIPALES Y PASAJEROS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* CARD 1: REQUERIMIENTO */}
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-xs font-black text-gray-450 uppercase tracking-widest flex items-center gap-2 border-b pb-3 border-gray-50">
              <FileText size={16} className="text-primary" /> Datos del Requerimiento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div>
                <label className="label">Comercial</label>
                <select
                  required
                  className="input mt-1"
                  value={tipoComercial}
                  onChange={e => {
                    const val = e.target.value
                    setTipoComercial(val)
                    if (val === 'sin_comercial') {
                      setFormData({ ...formData, comercial: 'Sin comercial' })
                    } else if (val === 'otro') {
                      setFormData({ ...formData, comercial: comercialManual })
                    } else {
                      setFormData({ ...formData, comercial: val })
                    }
                  }}
                >
                  <option value="" disabled>Seleccione un comercial...</option>
                  
                  {Object.entries(
                    comerciales.reduce((acc, c) => {
                      acc[c.ciudad || 'Otras'] = [...(acc[c.ciudad || 'Otras'] || []), c]
                      return acc
                    }, {})
                  ).map(([ciudad, list]) => (
                    <optgroup key={ciudad} label={ciudad}>
                      {list.map(c => (
                        <option key={c.id} value={c.nombre}>{c.nombre}</option>
                      ))}
                    </optgroup>
                  ))}

                  <option value="sin_comercial">Sin comercial</option>
                </select>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-3">
                <label className="label flex items-center gap-1.5 border-b pb-2">
                  <MapPin size={12} className="text-primary" /> Códigos IATA (Destinos / Conexiones)
                </label>
                
                <div className="space-y-3">
                  {iatas.map((iata, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <IataSelector 
                          value={iata}
                          onChange={(val) => {
                            const newIatas = [...iatas]
                            newIatas[idx] = val
                            setIatas(newIatas)
                          }}
                          placeholder={`Ej: Quito, Colombia o UIO... (Destino #${idx + 1})`}
                        />
                      </div>
                      <div className="flex items-center shrink-0">
                        {idx === iatas.length - 1 && (
                          <button
                            type="button"
                            onClick={() => setIatas([...iatas, ''])}
                            className="p-3 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors shrink-0"
                            title="Añadir otro destino"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                        {iatas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setIatas(iatas.filter((_, i) => i !== idx))}
                            className={`p-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors shrink-0 ${idx === iatas.length - 1 ? 'ml-2' : ''}`}
                            title="Eliminar destino"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="label flex items-center gap-1.5">
                  <FileText size={12} className="text-primary" /> Nombre del Destino (Opcional)
                </label>
                <input
                  className="input mt-1"
                  placeholder="Ej: Tour Mágico por Colombia, Crucero Bahamas..."
                  value={destinoNombre}
                  onChange={e => setDestinoNombre(e.target.value)}
                />
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <Users size={12} className="text-primary" /> Número de Pasajeros
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  max="200"
                  className="input mt-1 font-black text-base"
                  value={formData.numero_pasajeros}
                  onChange={e => setFormData({ ...formData, numero_pasajeros: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          </div>

          {/* CARD 2: PASAJEROS OPCIONALES */}
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-xs font-black text-gray-450 uppercase tracking-widest flex items-center gap-2 border-b pb-3 border-gray-50">
              <Users size={16} className="text-primary" /> Nombres de Pasajeros (Opcionales)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pasajeros.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="input text-xs flex-1"
                    placeholder={`Pasajero #${idx + 1}`}
                    value={p}
                    onChange={e => handlePasajeroChange(idx, e.target.value)}
                  />
                  {pasajeros.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePasajero(idx)}
                      className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPasajeros([...pasajeros, ''])}
              className="inline-flex items-center gap-1 text-xs font-black text-primary hover:text-primary/80 transition-colors uppercase tracking-wider mt-2"
            >
              <Plus size={14} /> Añadir Pasajero
            </button>
          </div>

          {/* CARD 3: OBSERVACIONES */}
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-xs font-black text-gray-450 uppercase tracking-widest flex items-center gap-2 border-b pb-3 border-gray-50">
              <FileText size={16} className="text-primary" /> Observaciones / Especificaciones
            </h3>
            <textarea
              className="input mt-1 min-h-[120px] text-sm resize-none"
              placeholder="Descripción del viaje, preferencias, tipo de servicio requerido..."
              value={formData.notas_iniciales}
              onChange={e => setFormData({ ...formData, notas_iniciales: e.target.value })}
            />
          </div>

        </div>

        {/* COLUMNA DERECHA: VALORES FINANCIEROS Y SUBMIT */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-xs font-black text-gray-450 uppercase tracking-widest flex items-center gap-2 border-b pb-3 border-gray-50">
              <DollarSign size={16} className="text-primary" /> Valores Financieros (Opcionales)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="label">Total Venta ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input font-bold mt-1"
                  placeholder="0.00"
                  value={formData.valor_total}
                  onChange={e => setFormData({ ...formData, valor_total: e.target.value })}
                />
              </div>

              <div>
                <label className="label text-success">Margen ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-success font-bold mt-1 border-success/20 focus:border-success focus:ring-success/20"
                  placeholder="0.00"
                  value={formData.valor_utilidad}
                  onChange={e => setFormData({ ...formData, valor_utilidad: e.target.value })}
                />
              </div>

              <div>
                <label className="label text-success">Comisión ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-success font-bold mt-1 border-success/20 focus:border-success focus:ring-success/20"
                  placeholder="0.00"
                  value={formData.valor_comision}
                  onChange={e => setFormData({ ...formData, valor_comision: e.target.value })}
                />
              </div>

              <div>
                <label className="label text-primary">Bono Counter ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-primary font-bold mt-1 border-primary/20 focus:border-primary focus:ring-primary/20"
                  placeholder="0.00"
                  value={formData.valor_bono}
                  onChange={e => setFormData({ ...formData, valor_bono: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl">
              <p className="text-xs font-black text-primary uppercase tracking-widest mb-1">ℹ Nota</p>
              <p className="text-[11px] text-primary/80 leading-relaxed">
                Los valores financieros y pasajeros que ingreses aquí son opcionales y se pre-cargarán de forma automática cuando confirmes esta cotización como Proforma de Venta.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-base uppercase tracking-tighter shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Guardando...
                </span>
              ) : (
                <>
                  <Save size={18} />
                  Registrar Cotización
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
