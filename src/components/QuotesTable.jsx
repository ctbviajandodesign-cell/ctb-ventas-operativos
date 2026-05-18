import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, isPast, parseISO, differenceInDays } from 'date-fns'
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
  MessageSquare,
  ChevronDown,
  FileText
} from 'lucide-react'

export default function QuotesTable({ quotes, isAdmin, onUpdate }) {
  const [viewingQuote, setViewingQuote] = useState(null)
  const [closingQuote, setClosingQuote] = useState(null)
  const [motivoPerdida, setMotivoPerdida] = useState('')
  const [otroMotivo, setOtroMotivo] = useState('')
  const [observacionPerdida, setObservacionPerdida] = useState('')
  
  const getStatusBadge = (quote) => {
    const status = (quote.estado || '').toString().trim().toLowerCase()
    if (status === 'ganada') return <span className="badge-success text-xs font-black">GANADA</span>
    if (status === 'perdida') return <span className="badge-danger text-xs font-black">CANCELADA</span>
    if (status === 'anulada') return <span className="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest">ANULADA</span>
    
    // Si está abierta y pasó más de 1 día, mostrar CADUCADA
    if (status === 'abierta' && quote.created_at) {
      const daysOld = differenceInDays(new Date(), parseISO(quote.created_at))
      if (daysOld >= 1) {
        return <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest">CADUCADA</span>
      }
    }
    return <span className="badge-warning text-xs font-black">ABIERTA</span>
  }



  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar esta proforma?')) return
    const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
    if (!error) onUpdate()
  }

  const [loadingClosing, setLoadingClosing] = useState(false)

  const handleMarcarPerdida = async (e) => {
    e.preventDefault()
    if (!motivoPerdida) return
    
    setLoadingClosing(true)
    try {
      const motivoFinal = motivoPerdida === 'Otro' ? `Otro: ${otroMotivo}` : motivoPerdida
      
      const { error } = await supabase
        .from('cotizaciones')
        .update({ 
          estado: 'perdida',
          motivo_perdida: motivoFinal,
          notas_seguimiento: observacionPerdida
        })
        .eq('id', closingQuote.id)
      

      setClosingQuote(null)
      onUpdate()
    } catch (error) {
      console.error('Error al registrar cierre:', error)
    } finally {
      setLoadingClosing(false)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 text-xs font-black uppercase tracking-widest">
            <th className="py-4 px-4">Código / Ref</th>
            <th className="py-4 px-4">Agencia / Destino</th>
            <th className="py-4 px-4">Pasajeros</th>
            <th className="py-4 px-4">Valor Venta</th>
            <th className="py-4 px-4">Aporte CTB</th>
            <th className="py-4 px-4">Operativo</th>
            <th className="py-4 px-4">Estado</th>
            <th className="py-4 px-4 text-right">Acciones</th>
          </tr>

        </thead>
        <tbody className="divide-y divide-gray-50">
          {quotes.length === 0 ? (
            <tr>
              <td colSpan="8" className="py-20 text-center">
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <FileText size={48} />
                  <p className="text-xs font-black uppercase tracking-widest">No hay expedientes registrados</p>
                </div>
              </td>
            </tr>
          ) : quotes.map((quote) => {
            const rawStatus = (quote.estado || '').toString().trim().toLowerCase()
            const isGanada = rawStatus === 'ganada'
            const isPerdida = rawStatus === 'perdida' || rawStatus === 'anulada'
            const aporte = (Number(quote.valor_utilidad || 0) + Number(quote.valor_comision || 0))
            
            return (
              <tr 
                key={quote.id} 
                className={`group hover:bg-gray-50 transition-colors cursor-pointer ${isGanada ? 'bg-success/5' : ''}`}
                onClick={() => setViewingQuote(quote)}
              >
                <td className="py-4 px-4 font-mono text-xs font-black text-primary">#{quote.codigo}</td>
                <td className="py-4 px-4">
                  <div className="font-black text-gray-800 text-sm">{quote.agencia || 'Directo'}</div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-[0.1em]">{quote.destino || 'S/D'}</div>
                  {isPerdida && quote.motivo_perdida && (
                    <div className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200/60 rounded-md px-2 py-0.5 mt-1 inline-block uppercase">
                      Motivo: {quote.motivo_perdida}
                    </div>
                  )}
                  {rawStatus === 'abierta' && quote.created_at && differenceInDays(new Date(), parseISO(quote.created_at)) >= 1 && (
                    <div className="text-[10px] font-black text-amber-700 bg-amber-100 border border-amber-300 rounded-md px-2 py-0.5 mt-1 inline-block uppercase">
                      ⚠️ Sin cerrar por más de 24h
                    </div>
                  )}
                </td>

                <td className="py-4 px-4">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <div className="bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-gray-500">
                      {quote.numero_pasajeros || (Array.isArray(quote.nombres_pasajeros) ? quote.nombres_pasajeros.length : 0)}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 font-black text-gray-900 text-sm">
                  ${Number(quote.valor_total || 0).toLocaleString()}
                </td>
                <td className="py-4 px-4">
                  <span className={`text-sm font-black ${aporte > 0 ? 'text-success' : 'text-gray-300'}`}>
                    ${aporte.toLocaleString()}
                  </span>
                </td>
                <td className="py-4 px-4 text-xs font-black text-primary uppercase tracking-tighter">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs">
                      {quote.profiles?.nombre?.charAt(0)}
                    </div>
                    {quote.profiles?.nombre?.split(' ')[0] || '---'}
                  </div>
                </td>

                <td className="py-4 px-4">{getStatusBadge(quote)}</td>
                <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewingQuote(quote)} className="p-2 text-gray-400 hover:text-success hover:bg-white rounded-lg shadow-sm shadow-transparent hover:shadow-gray-200 transition-all" title="Ver Detalle"><Eye size={18} /></button>
                    
                    {!isGanada && !isPerdida && (
                      <>
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: quote }))}
                          className="p-2 text-success hover:bg-success/10 rounded-lg border border-success/10"
                          title="Aprobar Venta"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button 
                          onClick={() => setClosingQuote(quote)}
                          className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg border border-amber-100"
                          title="Anular"
                        >
                          <AlertTriangle size={18} />
                        </button>
                      </>
                    )}

                    <Link href={`/dashboard/cotizaciones/editar/${quote.id}`} className="p-2 text-gray-400 hover:text-primary rounded-lg" title="Editar"><Edit size={18} /></Link>
                    {isAdmin && (
                      <button onClick={() => handleDelete(quote.id)} className="p-2 text-gray-300 hover:text-danger rounded-lg transition-colors">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300 max-h-[95vh] flex flex-col">
            <div className="bg-primary p-6 sm:p-8 text-white relative shrink-0">
              <button onClick={() => setViewingQuote(null)} className="absolute top-6 right-6 hover:rotate-90 transition-transform"><XCircle size={24} /></button>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter pr-8">Expediente CTB</h2>
              <p className="text-xs opacity-80 mt-1 font-mono truncate">{viewingQuote.codigo}</p>
            </div>

            <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1 max-h-[50vh] sm:max-h-[60vh]">
              <div className="bg-gray-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 min-w-0">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase truncate">Venta Total</p>
                    <p className="text-lg sm:text-xl font-black text-gray-900 truncate">${Number(viewingQuote.valor_total || 0).toLocaleString()}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase truncate">Utilidad + Comisión</p>
                    <p className="text-lg sm:text-xl font-black text-success truncate">${(Number(viewingQuote.valor_utilidad || 0) + Number(viewingQuote.valor_comision || 0)).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Agencia</p>
                  <p className="text-xs sm:text-sm font-black text-gray-800 leading-tight truncate">{viewingQuote.agencia || 'Directo'}</p>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Destino</p>
                  <p className="text-xs sm:text-sm font-black text-gray-800 leading-tight uppercase truncate">{viewingQuote.destino}</p>
                </div>
              </div>

              <div className="space-y-4 min-w-0">
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Pasajeros ({viewingQuote.numero_pasajeros})</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 max-h-32 overflow-y-auto pr-1">
                      {viewingQuote.nombres_pasajeros?.map((n, i) => (
                        <span key={i} className="text-[11px] sm:text-xs font-bold bg-white border border-gray-100 px-2 sm:px-2.5 py-1 rounded-lg text-gray-600 uppercase break-words max-w-full">{n}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {((viewingQuote.estado || '').trim().toLowerCase() === 'perdida' || (viewingQuote.estado || '').trim().toLowerCase() === 'anulada') && (
                  <div className="bg-red-50 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-red-100 text-red-600 min-w-0 break-words">
                    <p className="text-[10px] sm:text-xs font-black uppercase mb-1">Razón del Cierre Negativo</p>
                    <p className="text-xs sm:text-sm font-black italic">"{viewingQuote.motivo_perdida}"</p>
                    {viewingQuote.notas_seguimiento && <p className="text-[11px] sm:text-xs mt-2 opacity-80 leading-relaxed">{viewingQuote.notas_seguimiento}</p>}
                  </div>
                )}
              </div>

            </div>

            <div className="p-4 sm:p-8 bg-gray-50 flex gap-2 sm:gap-3 shrink-0 border-t border-gray-100">
              {(viewingQuote.estado || '').trim().toLowerCase() !== 'ganada' && (
                <button 
                  onClick={() => {
                    const q = {...viewingQuote}
                    setViewingQuote(null)
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: q }))
                    }, 100)
                  }}
                  className="flex-1 bg-success text-white py-3 sm:py-4 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-success/20 flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <CheckCircle2 size={18} className="shrink-0" /> <span className="truncate">Aprobar Venta</span>
                </button>
              )}
              <button onClick={() => setViewingQuote(null)} className="flex-1 py-3 sm:py-4 text-xs sm:text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors text-center truncate">Cerrar Expediente</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Anulación Premium */}
      {closingQuote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
          <form onSubmit={handleMarcarPerdida} className="bg-white rounded-[3rem] max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-[#f5a623] p-10 text-white flex justify-between items-start">
              <div>
                <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">Cierre Negativo</h2>
                <p className="text-xs font-bold opacity-90 uppercase tracking-[0.2em] mt-2">Análisis de pérdida de venta</p>
              </div>
              <button 
                type="button" 
                onClick={() => setClosingQuote(null)}
                className="w-10 h-10 rounded-full border-2 border-white/40 flex items-center justify-center hover:bg-white hover:text-[#f5a623] transition-all group"
              >
                <span className="font-black text-xl leading-none">×</span>
              </button>
            </div>

            <div className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block ml-1">
                  Motivo Principal
                </label>
                <div className="relative">
                  <select 
                    required 
                    className="w-full bg-white border border-gray-100 rounded-2xl py-4 px-5 font-bold text-gray-800 text-sm appearance-none shadow-sm focus:ring-2 focus:ring-[#f5a623]/20 transition-all outline-none" 
                    value={motivoPerdida} 
                    onChange={e => setMotivoPerdida(e.target.value)}
                  >
                    <option value="">Selecciona un motivo...</option>
                    <option value="Precio">1. Precio</option>
                    <option value="No cerró Agencia">2. No cerró Agencia</option>
                    <option value="No contestó Operador">3. No contestó Operador</option>
                    <option value="Otro">4. Otro (Especificar)</option>
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

              {motivoPerdida === 'Otro' && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-xs font-black text-[#f5a623] uppercase tracking-widest block ml-1">
                    Especificar Motivo
                  </label>
                  <input 
                    required 
                    className="w-full bg-white border border-[#f5a623]/20 rounded-2xl py-4 px-5 font-bold text-gray-800 text-sm shadow-sm outline-none focus:border-[#f5a623] transition-all" 
                    placeholder="Escribe el motivo..." 
                    value={otroMotivo} 
                    onChange={e => setOtroMotivo(e.target.value)} 
                  />
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                  <MessageSquare size={14} className="opacity-50" /> Comentarios Adicionales
                </label>
                <textarea 
                  className="w-full bg-white border border-gray-100 rounded-[2rem] py-5 px-6 font-bold text-gray-800 text-sm min-h-[140px] shadow-sm focus:ring-2 focus:ring-[#f5a623]/20 transition-all outline-none resize-none" 
                  placeholder="Detalles sobre por qué se perdió..." 
                  value={observacionPerdida} 
                  onChange={e => setObservacionPerdida(e.target.value)}
                />
              </div>
            </div>


            <div className="p-10 bg-gray-50/50">
              <button 
                type="submit" 
                disabled={loadingClosing}
                className={`w-full ${loadingClosing ? 'bg-gray-300' : 'bg-[#f5a623]'} text-white py-6 rounded-[2rem] font-black text-lg shadow-xl shadow-[#f5a623]/30 hover:scale-[1.02] active:scale-98 transition-all uppercase tracking-tight`}
              >
                {loadingClosing ? 'Registrando...' : 'Registrar Cierre Negativo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
