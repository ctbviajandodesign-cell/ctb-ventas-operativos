'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useUserSession } from '@/hooks/useUserSession'
import { 
  ArrowLeft, 
  ShieldAlert, 
  Calendar, 
  User, 
  Search, 
  Activity,
  Trash2,
  Edit3,
  UserCheck,
  RefreshCw
} from 'lucide-react'
import { showToast } from '@/utils/toast'

export default function AuditoriaPage() {
  const router = useRouter()
  const { profile, loading: sessionLoading } = useUserSession()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!sessionLoading) {
      if (profile?.rol !== 'superadmin') {
        showToast('Acceso denegado. Solo el Super Admin tiene acceso a la auditoría.', 'error')
        router.push('/dashboard')
      } else {
        fetchLogs()
      }
    }
  }, [profile, sessionLoading])

  async function fetchLogs() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('logs_actividad')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Error al cargar auditoría:', err)
      showToast('No se pudieron cargar los logs de auditoría.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getActionBadge = (accion) => {
    switch (accion) {
      case 'anular_cotizacion':
      case 'anular_venta':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-red-50 text-red-600 uppercase tracking-widest border border-red-100">
            <Trash2 size={12} /> Anular
          </span>
        )
      case 'desactivar_venta':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-600 uppercase tracking-widest border border-amber-100">
            <RefreshCw size={12} /> Desactivar
          </span>
        )
      case 'crear_usuario':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-600 uppercase tracking-widest border border-emerald-100">
            <UserCheck size={12} /> Crear Usuario
          </span>
        )
      case 'editar_usuario':
      case 'editar_cotizacion':
      case 'editar_voucher':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-600 uppercase tracking-widest border border-blue-100">
            <Edit3 size={12} /> Modificar
          </span>
        )
      case 'eliminar_usuario':
      case 'eliminar_voucher':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 uppercase tracking-widest border border-rose-200">
            <Trash2 size={12} /> Eliminar
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-gray-50 text-gray-600 uppercase tracking-widest border border-gray-100">
            <Activity size={12} /> Acción
          </span>
        )
    }
  }

  const filteredLogs = logs.filter(log => {
    const term = search.toLowerCase()
    return (
      (log.usuario_nombre || '').toLowerCase().includes(term) ||
      (log.usuario_email || '').toLowerCase().includes(term) ||
      (log.accion || '').toLowerCase().includes(term) ||
      (log.detalles || '').toLowerCase().includes(term)
    )
  })

  if (sessionLoading || loading) {
    return <div className="p-10 text-center animate-pulse text-gray-400 font-medium">Cargando bitácora de auditoría...</div>
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <ShieldAlert size={28} className="text-primary animate-pulse" /> Trazabilidad & Auditoría
            </h1>
            <p className="text-gray-500 text-sm font-medium italic underline decoration-primary/20">
              Historial en tiempo real de cambios críticos, anulaciones y gestión de equipo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
            <input 
              className="input pl-10 text-[16px] sm:text-sm py-3 rounded-2xl" 
              placeholder="Buscar por usuario, acción o detalles..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchLogs}
            className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl border border-gray-200 transition-colors"
            title="Recargar historial"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs font-black uppercase tracking-widest">
                <th className="py-4 px-6"><span className="flex items-center gap-1.5"><Calendar size={13} /> Fecha / Hora</span></th>
                <th className="py-4 px-6"><span className="flex items-center gap-1.5"><User size={13} /> Responsable</span></th>
                <th className="py-4 px-6">Acción</th>
                <th className="py-4 px-6">Detalles del Cambio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-20 text-center">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No se registran actividades de auditoría</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateStr = log.created_at 
                    ? new Date(log.created_at).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })
                    : 'N/A'

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors text-sm">
                      <td className="py-4 px-6 font-mono text-xs text-gray-500 whitespace-nowrap">{dateStr}</td>
                      <td className="py-4 px-6 min-w-[200px]">
                        <div className="font-black text-gray-900 leading-tight">{log.usuario_nombre}</div>
                        <div className="text-xs text-gray-400 lowercase">{log.usuario_email}</div>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">{getActionBadge(log.accion)}</td>
                      <td className="py-4 px-6 text-gray-600 font-medium leading-relaxed max-w-md break-words">{log.detalles}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
