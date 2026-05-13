'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { format, isPast, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MoreVertical,
  Trash2,
  Edit,
  DollarSign
} from 'lucide-react'

export default function QuotesTable({ quotes, onUpdate, isAdmin }) {
  const [loading, setLoading] = useState(false)

  const getStatusBadge = (quote) => {
    const isExpired = quote.fecha_caducidad && isPast(parseISO(`${quote.fecha_caducidad}T${quote.hora_caducidad || '23:59:59'}`))
    
    if (quote.estado === 'ganada') return <span className="badge-success">GANADA</span>
    if (quote.estado === 'perdida') return <span className="badge-danger">PERDIDA</span>
    if (isExpired && quote.estado === 'abierta') return <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold animate-pulse">CADUCADO</span>
    
    return <span className="badge-primary">ABIERTA</span>
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta cotización? Se borrará todo lo asociado.')) return
    
    const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
    if (!error) onUpdate()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 text-[11px] font-bold uppercase tracking-widest">
            <th className="py-4 px-4">Código</th>
            <th className="py-4 px-4">Agencia / Destino</th>
            <th className="py-4 px-4">Pasajeros</th>
            {isAdmin && <th className="py-4 px-4">Operativo</th>}
            <th className="py-4 px-4">Caducidad</th>
            <th className="py-4 px-4">Estado</th>
            <th className="py-4 px-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {quotes.map((quote) => {
            const isExpired = quote.fecha_caducidad && isPast(parseISO(`${quote.fecha_caducidad}T${quote.hora_caducidad || '23:59:59'}`)) && quote.estado === 'abierta'
            
            return (
              <tr key={quote.id} className={`group hover:bg-gray-50 transition-colors ${isExpired ? 'bg-red-50/50' : ''}`}>
                <td className="py-4 px-4 font-mono text-xs font-bold text-gray-500">{quote.codigo}</td>
                <td className="py-4 px-4">
                  <div className="font-bold text-gray-800">{quote.agencia}</div>
                  <div className="text-xs text-gray-500">{quote.destino}</div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1 font-semibold text-gray-700">
                    <Users size={14} className="text-gray-400" />
                    {quote.numero_pasajeros}
                  </div>
                </td>
                {isAdmin && (
                  <td className="py-4 px-4 text-sm font-medium text-primary">
                    {quote.profiles?.nombre?.split(' ')[0]}
                  </td>
                )}
                <td className="py-4 px-4">
                  <div className={`text-xs font-bold flex items-center gap-1 ${isExpired ? 'text-red-600' : 'text-gray-500'}`}>
                    <Clock size={12} />
                    {quote.fecha_caducidad ? format(parseISO(quote.fecha_caducidad), 'dd MMM', { locale: es }) : '--'}
                    <span className="text-[10px] font-normal opacity-60">{quote.hora_caducidad?.slice(0, 5)}</span>
                  </div>
                </td>
                <td className="py-4 px-4">{getStatusBadge(quote)}</td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {quote.estado === 'abierta' && (
                      <>
                        <Link 
                          href={`/dashboard/cotizaciones/editar/${quote.id}`}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Editar Cotización"
                        >
                          <Edit size={18} />
                        </Link>
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: quote }))}
                          className="p-2 text-success hover:bg-success/10 rounded-lg transition-colors"
                          title="Cerrar Venta"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => handleDelete(quote.id)}
                      className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Users({ size, className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
