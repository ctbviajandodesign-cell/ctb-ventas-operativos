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
  DollarSign,
  AlertTriangle
} from 'lucide-react'

export default function QuotesTable({ quotes, isAdmin, onUpdate }) {
  const [viewingQuote, setViewingQuote] = useState(null)
  const [closingQuote, setClosingQuote] = useState(null)
  const [motivoPerdida, setMotivoPerdida] = useState('')
  const [observacionPerdida, setObservacionPerdida] = useState('')
  
  const getStatusBadge = (quote) => {
    // Limpieza agresiva de espacios y minúsculas
    const status = (quote.estado || '').toString().trim().toLowerCase()
    const isExpired = quote.fecha_caducidad && isPast(parseISO(`${quote.fecha_caducidad}T${quote.hora_caducidad || '23:59:00'}`))
    
    if (status === 'ganada') return <span className="badge-success">GANADA</span>
    if (status === 'perdida') return <span className="badge-danger">PERDIDA</span>
    if (status === 'anulada') return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">ANULADA</span>
    
    if (isExpired && status === 'abierta') {
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

  const handleMarcarPerdida = async (e) => {
    e.preventDefault()
    const { error } = await supabase
      .from('cotizaciones')
      .update({ 
        estado: motivoPerdida === 'Anulada por Operativo' ? 'anulada' : 'perdida',
        motivo_perdida: motivoPerdida,
        notas_seguimiento: observacionPerdida
      })
      .eq('id', closingQuote.id)
    
    if (!error) {
      setClosingQuote(null)
      setMotivoPerdida('')
      setObservacionPerdida('')
      onUpdate()
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest bg-gray-50/50">
            <th className="py-4 px-4">Código</th>
            <th className="py-4 px-4">Agencia / Destino</th>
            <th className="py-4 px-4">Pasajeros</th>
            <th className="py-4 px-4">Operativo</th>
            <th className="py-4 px-4">Vencimiento</th>
            <th className="py-4 px-4">Estado</th>
            <th className="py-4 px-4 text-right">Gestión</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {quotes.map((quote) => {
            // Lógica de detección de estado ABIERTA infalible
            const rawStatus = (quote.estado || '').toString().trim().toLowerCase()
            const isAbierta = rawStatus === 'abierta'
            
            return (
              <tr 
                key={quote.id} 
                className={`group hover:bg-gray-50/80 transition-colors cursor-pointer ${!isAbierta ? 'opacity-75 bg-gray-50/20' : ''}`}
                onClick={() => setViewingQuote(quote)}
              >
                <td className="py-4 px-4 font-mono text-xs font-bold text-primary">{quote.codigo}</td>
                <td className="py-4 px-4">
                  <div className="font-black text-gray-800 text-sm leading-tight">{quote.agencia || 'Particular'}</div>
                  <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">{quote.destino || '---'}</div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold">
                    <UsersIcon size={14} className="text-gray-300" /> {quote.nombres_pasajeros?.length || 0}
                  </div>
                </td>
                <td className="py-4 px-4 text-xs font-black text-primary/80 uppercase italic">{quote.profiles?.nombre?.split(' ')[0]}</td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1 text-gray-500 text-[10px] font-bold">
                    <Clock size={12} className="text-gray-300" /> {quote.fecha_caducidad ? format(parseISO(quote.fecha_caducidad), 'dd MMM', { locale: es }) : 'N/A'}
                  </div>
                </td>
                <td className="py-4 px-4">{getStatusBadge(quote)}</td>
                <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => setViewingQuote(quote)}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-white rounded-xl border border-transparent hover:border-gray-100 shadow-sm transition-all"
                      title="Ver Detalle"
                    >
                      <Eye size={18} />
                    </button>
                    
                    {isAbierta && (
                      <>
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: quote }))}
                          className="p-2 bg-success/5 text-success hover:bg-success hover:text-white rounded-xl border border-success/20 shadow-sm transition-all transform hover:scale-110"
                          title="Aprobar Venta"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button 
                          onClick={() => setClosingQuote(quote)}
                          className="p-2 bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white rounded-xl border border-amber-200 shadow-sm transition-all"
                          title="Anular Proforma"
                        >
                          <AlertTriangle size={18} />
                        </button>
                      </>
                    )}

                    <Link 
                      href={`/dashboard/cotizaciones/editar/${quote.id}`}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-white rounded-xl border border-transparent hover:border-gray-100 shadow-sm transition-all"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </Link>

                    {isAdmin && (
                      <button 
                        onClick={() => handleDelete(quote.id)}
                        className="p-2 text-gray-300 hover:text-danger hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
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
              {/* Precios Robustos */}
              <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/10">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign size={16} className="text-primary" />
                  <p className="text-[11px] font-black text-primary uppercase tracking-widest">Resumen Económico Real</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-black mb-1">Costo Neto (Pax)</p>
                    <p className="text-lg font-black text-gray-800">
                      ${Number(viewingQuote.valor_neto_pax || viewingQuote.valor_neto || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-black mb-1">Precio Venta (Pax)</p>
                    <p className="text-lg font-black text-success">
                      ${Number(viewingQuote.valor_venta_pax || viewingQuote.valor_venta || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-primary/10 flex justify-between items-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Proyección Total ({viewingQuote.nombres_pasajeros?.length || 1} Pax)</p>
                  <p className="text-xl font-black text-primary">
                    ${(Number(viewingQuote.valor_venta_pax || viewingQuote.valor_venta || 0) * (viewingQuote.nombres_pasajeros?.length || 1)).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Building2 size={10} /> Agencia
                  </p>
                  <p className="text-sm font-black text-gray-800 leading-tight">
                    {viewingQuote.agencia || 'Venta Directa'}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <MapPin size={10} /> Destino
                  </p>
                  <p className="text-sm font-black text-gray-800 leading-tight uppercase">
                    {viewingQuote.destino || 'Sin definir'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary h-fit"><UsersIcon size={16} /></div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Lista de Pasajeros</p>
                    <div className="mt-2 grid grid-cols-1 gap-1">
                      {viewingQuote.nombres_pasajeros?.map((n, i) => (
                        <div key={i} className="text-xs font-bold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                          {n}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {((viewingQuote.estado || '').trim().toLowerCase() === 'perdida' || (viewingQuote.estado || '').trim().toLowerCase() === 'anulada') && (
                  <div className="bg-red-50 p-5 rounded-3xl border-2 border-red-100">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={14} className="text-red-500" />
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Información de Seguimiento Fallido</p>
                    </div>
                    <p className="text-sm font-black text-red-700">{viewingQuote.motivo_perdida || 'Cierre manual sin motivo'}</p>
                    {viewingQuote.notas_seguimiento && <p className="text-xs text-red-600 mt-2 italic bg-white/50 p-2 rounded-lg">"{viewingQuote.notas_seguimiento}"</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 bg-gray-50 flex gap-3">
              {(viewingQuote.estado || '').trim().toLowerCase() === 'abierta' && (
                <button 
                  onClick={() => {
                    setViewingQuote(null)
                    window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: viewingQuote }))
                  }}
                  className="flex-1 bg-success text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-success/20 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} /> Aprobar Venta
                </button>
              )}
              <button 
                onClick={() => setViewingQuote(null)}
                className="flex-1 py-4 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Volver a Lista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Anulación / Pérdida */}
      {closingQuote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <form onSubmit={handleMarcarPerdida} className="bg-white rounded-[2.5rem] max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300 border border-gray-100">
            <div className="bg-amber-500 p-8 text-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Anular Proforma</h2>
                <button type="button" onClick={() => setClosingQuote(null)} className="hover:rotate-90 transition-transform"><XCircle size={24} /></button>
              </div>
              <p className="text-xs opacity-80 mt-1 font-bold uppercase tracking-widest">Registro para análisis de pérdida</p>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">¿Cuál fue el motivo?</label>
                <select 
                  required
                  className="input text-sm font-bold bg-gray-50 border-gray-100"
                  value={motivoPerdida}
                  onChange={e => setMotivoPerdida(e.target.value)}
                >
                  <option value="">Selecciona una opción...</option>
                  <option value="Precio (Muy caro)">Precio (Muy caro)</option>
                  <option value="Se fue con la competencia">Se fue con la competencia</option>
                  <option value="Cambio de planes / No viaja">Cambio de planes / No viaja</option>
                  <option value="Sin respuesta del cliente">Sin respuesta del cliente</option>
                  <option value="Anulada por Operativo">Anulada (Error/Duplicada)</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comentarios Internos</label>
                <textarea 
                  className="input text-sm min-h-[100px] bg-gray-50 border-gray-100"
                  placeholder="Explica brevemente qué pasó..."
                  value={observacionPerdida}
                  onChange={e => setObservacionPerdida(e.target.value)}
                ></textarea>
              </div>
            </div>

            <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button 
                type="submit"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-500/20"
              >
                Confirmar Cierre Negativo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
// Final Polish v1.2
