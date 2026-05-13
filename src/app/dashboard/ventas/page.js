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
                <tr key={venta.id} className={`group hover:bg-gray-50 transition-colors ${venta.estado === 'anulada' ? 'opacity-50 grayscale' : ''}`}>
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
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {venta.estado === 'activa' && (
                        <button 
                          onClick={() => handleAnular(venta)}
                          className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Anular Venta"
                        >
                          <XCircle size={18} />
                        </button>
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
    </div>
  )
}
