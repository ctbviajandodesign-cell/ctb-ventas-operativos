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
  AlertTriangle,
  TrendingUp
} from 'lucide-react'

export default function QuotesTable({ quotes, isAdmin, onUpdate }) {
  const [viewingQuote, setViewingQuote] = useState(null)
  const [closingQuote, setClosingQuote] = useState(null)
  const [motivoPerdida, setMotivoPerdida] = useState('')
  const [observacionPerdida, setObservacionPerdida] = useState('')
  
  const getStatusBadge = (quote) => {
    const status = (quote.estado || '').toString().trim().toLowerCase()
    
    if (status === 'ganada') return <span className="badge-success">GANADA</span>
    if (status === 'perdida') return <span className="badge-danger">PERDIDA</span>
    if (status === 'anulada') return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">ANULADA</span>
    
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
      onUpdate()
    }
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
            <th className="py-4 px-4">Vencimiento</th>
            <th className="py-4 px-4">Estado</th>
            <th className="py-4 px-4 text-right">Gestión</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {quotes.map((quote) => {
            const rawStatus = (quote.estado || '').toString().trim().toLowerCase()
            const isGanada = rawStatus === 'ganada'
            
            return (
              <tr 
                key={quote.id} 
                className={`group hover:bg-gray-50 transition-colors cursor-pointer ${isGanada ? 'opacity-70 bg-gray-50/30' : ''}`}
                onClick={() => setViewingQuote(quote)}
              >
                <td className="py-4 px-4 font-mono text-xs font-bold text-primary">{quote.codigo}</td>
                <td className="py-4 px-4">
                  <div className="font-bold text-gray-800 text-sm leading-tight">{quote.agencia}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">{quote.destino}</div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1 text-gray-500 text-xs font-bold">
                    <UsersIcon size={14} /> {quote.numero_pasajeros || quote.nombres_pasajeros?.length || 0}
                  </div>
                </td>
                <td className="py-4 px-4 text-xs font-bold text-primary italic uppercase">{quote.profiles?.nombre?.split(' ')[0]}</td>
                <td className="py-4 px-4 text-[10px] font-bold text-gray-500">
                  {quote.fecha_caducidad ? format(parseISO(quote.fecha_caducidad), 'dd MMM', { locale: es }) : 'N/A'}
                </td>
                <td className="py-4 px-4">{getStatusBadge(quote)}</td>
                <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => setViewingQuote(quote)} className="p-2 text-gray-400 hover:text-success rounded-lg" title="Ver Detalle"><Eye size={18} /></button>
                    
                    {!isGanada && (
                      <>
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: quote }))}
                          className="p-2 text-success hover:bg-success/10 rounded-lg border border-success/20 shadow-sm"
                          title="Aprobar / Venta"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button 
                          onClick={() => setClosingQuote(quote)}
                          className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg border border-amber-200"
                          title="Anular"
                        >
                          <AlertTriangle size={18} />
                        </button>
                      </>
                    )}

                    <Link href={`/dashboard/cotizaciones/editar/${quote.id}`} className="p-2 text-gray-400 hover:text-primary rounded-lg" title="Editar"><Edit size={18} /></Link>
                    {isAdmin && <button onClick={() => handleDelete(quote.id)} className="p-2 text-gray-300 hover:text-danger rounded-lg"><Trash2 size={18} /></button>}
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
              <button onClick={() => setViewingQuote(null)} className="absolute top-6 right-6 hover:rotate-90 transition-transform"><XCircle size={24} /></button>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Detalle de Proforma</h2>
              <p className="text-xs opacity-80 mt-1 font-mono">{viewingQuote.codigo}</p>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <DollarSign size={16} className="text-success" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resumen Económico</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">Valor Venta Total</p>
                    <p className="text-xl font-black text-gray-900">${Number(viewingQuote.valor_total || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">Utilidad + Comisión</p>
                    <p className="text-xl font-black text-success">${(Number(viewingQuote.valor_utilidad || 0) + Number(viewingQuote.valor_comision || 0)).toLocaleString()}</p>
                  </div>
                </div>
                <div className="pt-2 flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  <span>Bono Operativo:</span>
                  <span className="text-gray-900">${Number(viewingQuote.valor_bono || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Agencia</p>
                  <p className="text-sm font-black text-gray-800 leading-tight">{viewingQuote.agencia}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Destino</p>
                  <p className="text-sm font-black text-gray-800 leading-tight">{viewingQuote.destino}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 border-l-4 border-primary pl-4">
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Pasajeros ({viewingQuote.numero_pasajeros})</p>
                    <div className="flex flex-wrap gap-2">
                      {viewingQuote.nombres_pasajeros?.map((n, i) => (
                        <span key={i} className="text-[10px] font-bold bg-white border border-gray-100 px-2 py-1 rounded-lg text-gray-600 uppercase">{n}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {(viewingQuote.estado?.toLowerCase().trim() === 'perdida' || viewingQuote.estado?.toLowerCase().trim() === 'anulada') && (
                  <div className="bg-red-50 p-5 rounded-3xl border border-red-100 text-red-600">
                    <p className="text-[9px] font-black uppercase mb-1">Motivo de Pérdida</p>
                    <p className="text-sm font-black">{viewingQuote.motivo_perdida}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 bg-gray-50 flex gap-3">
              {viewingQuote.estado?.toLowerCase().trim() !== 'ganada' && (
                <button 
                  onClick={() => {
                    setViewingQuote(null)
                    window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: viewingQuote }))
                  }}
                  className="flex-1 bg-success text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-success/20 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} /> Aprobar Venta
                </button>
              )}
              <button onClick={() => setViewingQuote(null)} className="flex-1 py-4 text-sm font-bold text-gray-400">Volver</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Anulación */}
      {closingQuote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <form onSubmit={handleMarcarPerdida} className="bg-white rounded-[2.5rem] max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-amber-500 p-8 text-white flex justify-between items-center">
              <h2 className="text-2xl font-black">Anular Proforma</h2>
              <button type="button" onClick={() => setClosingQuote(null)}><XCircle size={24} /></button>
            </div>
            <div className="p-8 space-y-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo de Anulación</label>
              <select required className="input font-bold" value={motivoPerdida} onChange={e => setMotivoPerdida(e.target.value)}>
                <option value="">Selecciona un motivo...</option>
                <option value="Precio (Muy caro)">Precio (Muy caro)</option>
                <option value="Competencia">Competencia</option>
                <option value="Cambio de planes">Cambio de planes</option>
                <option value="Sin respuesta">Sin respuesta</option>
                <option value="Anulada por Operativo">Anulada por Operativo</option>
              </select>
              <button type="submit" className="w-full bg-amber-500 text-white py-4 rounded-2xl font-black text-sm mt-4 shadow-lg shadow-amber-500/20">Confirmar Cierre Negativo</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
