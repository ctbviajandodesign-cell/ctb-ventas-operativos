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
  Edit,
  Eye,
  XCircle,
  MapPin,
  Calendar,
  Building2,
  DollarSign
} from 'lucide-react'

export default function QuotesTable({ quotes, isAdmin, onUpdate }) {
  const [viewingQuote, setViewingQuote] = useState(null)
  
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
            <tr 
              key={quote.id} 
              className="group hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setViewingQuote(quote)}
            >
              <td className="py-4 px-4 font-mono text-xs font-bold text-primary">{quote.codigo}</td>
              <td className="py-4 px-4">
                <div className="font-bold text-gray-800 text-sm">{quote.agencia}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">{quote.destino}</div>
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
              <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  <button 
                    onClick={() => setViewingQuote(quote)}
                    className="p-2 text-gray-400 hover:text-success hover:bg-success/5 rounded-lg transition-colors"
                    title="Ver Detalle"
                  >
                    <Eye size={18} />
                  </button>
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
                  {isAdmin && (
                    <button 
                      onClick={() => handleDelete(quote.id)}
                      className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
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

      {/* Modal Visualizador de Cotización COMPLETO */}
      {viewingQuote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-primary p-8 text-white relative">
              <button 
                onClick={() => setViewingQuote(null)}
                className="absolute top-6 right-6 hover:rotate-90 transition-transform"
              >
                <XCircle size={24} />
              </button>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Expediente de Proforma</h2>
              <p className="text-xs opacity-80 mt-1 font-mono">{viewingQuote.codigo}</p>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Building2 size={10} /> Agencia
                  </p>
                  <p className="text-sm font-black text-gray-800 leading-tight">
                    {viewingQuote.agencia}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <MapPin size={10} /> Destino
                  </p>
                  <p className="text-sm font-black text-gray-800 leading-tight">
                    {viewingQuote.destino}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary h-fit"><UsersIcon size={16} /></div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pasajeros ({viewingQuote.nombres_pasajeros?.length})</p>
                    <div className="mt-1 grid grid-cols-1 gap-1">
                      {viewingQuote.nombres_pasajeros?.map((n, i) => (
                        <div key={i} className="text-xs font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                          {n}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary h-fit"><Calendar size={16} /></div>
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Caducidad</p>
                      <p className="text-xs font-bold text-gray-800">
                        {viewingQuote.fecha_caducidad} {viewingQuote.hora_caducidad}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Operativo</p>
                      <p className="text-xs font-bold text-primary underline">{viewingQuote.profiles?.nombre}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign size={14} className="text-success" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resumen Económico</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[8px] text-gray-400 uppercase font-black">Neto por Pax</p>
                      <p className="text-sm font-black text-gray-800">${viewingQuote.valor_neto_pax}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-gray-400 uppercase font-black">Venta por Pax</p>
                      <p className="text-sm font-black text-success">${viewingQuote.valor_venta_pax}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-gray-50 flex gap-3">
              {viewingQuote.estado === 'abierta' && (
                <button 
                  onClick={() => {
                    setViewingQuote(null)
                    window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: viewingQuote }))
                  }}
                  className="flex-1 btn-success py-4 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} /> Cerrar Venta
                </button>
              )}
              <button 
                onClick={() => setViewingQuote(null)}
                className="flex-1 py-4 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cerrar Expediente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
