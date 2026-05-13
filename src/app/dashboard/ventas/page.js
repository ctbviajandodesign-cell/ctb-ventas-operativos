'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  TrendingUp, 
  Search, 
  XCircle, 
  Trash2, 
  Edit,
  DollarSign,
  AlertTriangle
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export default function VentasPage() {
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [profile, setProfile] = useState(null)
  const [selectedVenta, setSelectedVenta] = useState(null)

  useEffect(() => {
    fetchVentas()
  }, [])

  async function fetchVentas() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)

      let query = supabase
        .from('ventas')
        .select('*, cotizaciones(agencia, destino, codigo)')
        .order('created_at', { ascending: false })

      if (profileData.rol !== 'admin') {
        query = query.eq('operativo_id', user.id)
      }

      const { data } = await query
      setVentas(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleAnular = async (venta) => {
    if (!confirm('¿Seguro que deseas ANULAR esta venta? Esto la restará de tu meta mensual y anulará el voucher asociado.')) return
    
    try {
      const { error } = await supabase
        .from('ventas')
        .update({ estado: 'anulada' })
        .eq('id', venta.id)

      if (error) throw error

      // Anular voucher si existe
      await supabase
        .from('vouchers')
        .update({ estado: 'inactivo' })
        .eq('venta_id', venta.id)

      // Regresar cotización a 'en_seguimiento' para poder re-intentar o cerrar de nuevo
      await supabase
        .from('cotizaciones')
        .update({ estado: 'en_seguimiento' })
        .eq('id', venta.cotizacion_id)

      fetchVentas()
    } catch (error) {
      alert(error.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('ELIMINACIÓN TOTAL: ¿Estás seguro? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('ventas').delete().eq('id', id)
    if (!error) fetchVentas()
  }

  const filtered = ventas.filter(v => 
    v.cotizaciones?.agencia?.toLowerCase().includes(search.toLowerCase()) ||
    v.cotizaciones?.codigo?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="p-8 text-center text-gray-400 font-medium animate-pulse">Cargando libro de ventas...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Registro de Ventas</h1>
          <p className="text-gray-500 text-sm font-medium italic">Control financiero y gestión de cierres.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input 
            className="input pl-10" 
            placeholder="Buscar por código o agencia..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                <th className="py-4 px-6">Fecha</th>
                <th className="py-4 px-6">Referencia</th>
                <th className="py-4 px-6">Agencia / Destino</th>
                <th className="py-4 px-6 text-right">Total ($)</th>
                <th className="py-4 px-6 text-right">Aporte Meta ($)</th>
                <th className="py-4 px-6">Estado</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((venta) => (
                <tr 
                  key={venta.id} 
                  className={`group hover:bg-gray-50 transition-colors cursor-pointer ${venta.estado === 'anulada' ? 'opacity-50 grayscale' : ''}`}
                  onClick={() => setSelectedVenta(venta)}
                >
                  <td className="py-4 px-6 text-xs text-gray-500">
                    {format(parseISO(venta.created_at), 'dd MMM yyyy', { locale: es })}
                  </td>
                  <td className="py-4 px-6 font-mono text-xs font-bold text-primary">
                    {venta.cotizaciones?.codigo}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-gray-800 text-sm">{venta.cotizaciones?.agencia}</div>
                    <div className="text-[10px] text-gray-400">{venta.cotizaciones?.destino}</div>
                  </td>
                  <td className="py-4 px-6 text-right font-bold text-gray-900">
                    ${Number(venta.total).toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="bg-success/10 text-success px-2 py-1 rounded-lg font-black text-xs">
                      ${(Number(venta.comision) + Number(venta.utilidad)).toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {venta.estado === 'activa' ? (
                      <span className="badge-success">ACTIVA</span>
                    ) : (
                      <span className="badge-danger">ANULADA</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {venta.estado === 'activa' && (
                        <>
                          <button 
                            onClick={() => window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: { ...venta.cotizaciones, existingSale: venta } }))}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                            title="Editar Venta"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleAnular(venta)}
                            className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Anular Venta"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                      {profile?.rol === 'admin' && (
                        <button 
                          onClick={() => handleDelete(venta.id)}
                          className="p-2 text-danger hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar Permanente"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
          <DollarSign size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400 font-medium">No se han registrado ventas aún.</p>
        </div>
      )}
      {/* Modal Detalle de Venta */}
      {selectedVenta && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-gray-900 p-8 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Detalle de Cierre</p>
                  <h2 className="text-2xl font-black">{selectedVenta.cotizaciones?.codigo}</h2>
                </div>
                <button onClick={() => setSelectedVenta(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-8 grid grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Información del Viaje</h4>
                <div className="space-y-1">
                  <p className="text-sm font-black text-gray-800">{selectedVenta.cotizaciones?.agencia}</p>
                  <p className="text-xs text-gray-500">{selectedVenta.cotizaciones?.destino}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Pasajeros</p>
                  <p className="text-xs text-gray-700">{selectedVenta.cotizaciones?.nombres_pasajeros?.join(', ')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">Resumen Financiero</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Total Venta</p>
                    <p className="text-sm font-black text-gray-900">${Number(selectedVenta.total).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Utilidad + Com</p>
                    <p className="text-sm font-black text-success">${(Number(selectedVenta.utilidad) + Number(selectedVenta.comision)).toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Pagos Realizados</p>
                  <p className="text-xs text-gray-600">Tarjeta: ${selectedVenta.abono_tarjeta}</p>
                  <p className="text-xs text-gray-600">Efectivo 1: ${selectedVenta.abono_1}</p>
                  <p className="text-xs text-gray-600">Efectivo 2: ${selectedVenta.abono_2}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 flex justify-end gap-2">
              <button 
                onClick={() => {
                  const q = { ...selectedVenta.cotizaciones, existingSale: selectedVenta }
                  setSelectedVenta(null)
                  window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: q }))
                }}
                className="btn-primary py-2 px-6 text-sm flex items-center gap-2"
              >
                <Edit size={16} /> Editar Valores
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
