import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { format, isPast, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { 
  CheckCircle2, 
  Clock, 
  Trash2, 
  AlertCircle,
  Users as UsersIcon,
  Edit
} from 'lucide-react'

export default function QuotesTable({ quotes, isAdmin, onUpdate }) {
  
  const getStatusBadge = (quote) => {
    const isExpired = quote.fecha_caducidad && isPast(parseISO(`${quote.fecha_caducidad}T${quote.hora_caducidad || '23:59:00'}`))
    
    if (quote.estado === 'ganada') return <span className="badge-success">GANADA</span>
    if (quote.estado === 'perdida') return <span className="badge-danger">PERDIDA</span>
    
    if (isExpired && quote.estado === 'abierta') {
      return (
        <span className="badge-danger animate-pulse flex items-center gap-1">
          <AlertCircle size={12} /> CADUCADA
        </span>
      )
    }
    
    return <span className="badge-warning">ABIERTA</span>
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar esta proforma?')) return
    const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
    if (!error) onUpdate()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest">
            <th className="py-4 px-4">Código</th>
            <th className="py-4 px-4">Agencia / Destino</th>
            <th className="py-4 px-4">Pasajeros</th>
            <th className="py-4 px-4">Operativo</th>
            <th className="py-4 px-4">Caducidad</th>
            <th className="py-4 px-4">Estado</th>
            <th className="py-4 px-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {quotes.map((quote) => (
            <tr key={quote.id} className="group hover:bg-gray-50 transition-colors">
              <td className="py-4 px-4 font-mono text-xs font-bold text-primary">{quote.codigo}</td>
              <td className="py-4 px-4">
                <div className="font-bold text-gray-800 text-sm">{quote.agencia}</div>
                <div className="text-[10px] text-gray-400">{quote.destino}</div>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <UsersIcon size={14} /> {quote.nombres_pasajeros?.length || 0}
                </div>
              </td>
              <td className="py-4 px-4 text-xs font-bold text-primary">{quote.profiles?.nombre}</td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-1 text-gray-500 text-[10px] font-medium">
                  <Clock size={12} /> {quote.fecha_caducidad ? format(parseISO(quote.fecha_caducidad), 'dd MMM', { locale: es }) : 'N/A'} {quote.hora_caducidad}
                </div>
              </td>
              <td className="py-4 px-4">{getStatusBadge(quote)}</td>
              <td className="py-4 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link 
                    href={`/dashboard/cotizaciones/editar/${quote.id}`}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    title="Editar Cotización"
                  >
                    <Edit size={18} />
                  </Link>
                  {quote.estado === 'abierta' && (
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: quote }))}
                      className="p-2 text-success hover:bg-success/10 rounded-lg transition-colors"
                      title="Cerrar Venta"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(quote.id)}
                    className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
