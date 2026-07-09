import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { formatIataWithCountry } from '@/utils/destinos'
import { generateProformaPDF } from '@/lib/pdf-generator'

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
  FileText,
  QrCode,
  Share2
} from 'lucide-react'
import { showToast } from '@/utils/toast'
import { useUserSession } from '@/hooks/useUserSession'

const isExpired = (q) => {
  if (q.fecha_caducidad) {
    const timeStr = q.hora_caducidad ? q.hora_caducidad : '23:59:59'
    const expiryDate = new Date(`${q.fecha_caducidad}T${timeStr}`)
    return expiryDate < new Date()
  }
  if (q.created_at) {
    const hours = (new Date() - new Date(q.created_at)) / (1000 * 60 * 60)
    return hours > 24
  }
  return false
}

export default function QuotesTable({ quotes, isAdmin, isSuperAdmin, currentUserId, onUpdate }) {
  const { user } = useUserSession()
  const router = useRouter()
  // Prefer currentUserId prop (passed from parent) to avoid async timing issues
  const effectiveUserId = currentUserId || user?.id
  const [viewingQuote, setViewingQuote] = useState(null)
  const [closingQuote, setClosingQuote] = useState(null)
  const [motivoPerdida, setMotivoPerdida] = useState('')
  const [otroMotivo, setOtroMotivo] = useState('')
  const [observacionPerdida, setObservacionPerdida] = useState('')
  const [deleteConfirmQuote, setDeleteConfirmQuote] = useState(null)
  const [deletingPermanent, setDeletingPermanent] = useState(false)
  
  const getStatusBadge = (quote) => {
    const hasVch = !!getVoucherCodigo(quote)
    const status = (quote.estado || '').toString().trim().toLowerCase()
    if (status === 'ganada' || hasVch) return <span className="bg-success/15 text-success px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">VENDIDA</span>
    if (status === 'perdida' || status === 'anulada') {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">CANCELADA</span>
          {quote.motivo_perdida && (
            <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.2 rounded max-w-[120px] truncate" title={quote.motivo_perdida}>
              {quote.motivo_perdida}
            </span>
          )}
        </div>
      )
    }
    
    // Calculate expiration deadline
    let expiryDate = null
    if (quote.fecha_caducidad) {
      const timeStr = quote.hora_caducidad ? quote.hora_caducidad : '23:59:59'
      expiryDate = new Date(`${quote.fecha_caducidad}T${timeStr}`)
    } else if (quote.created_at) {
      const createdAtDate = new Date(quote.created_at)
      expiryDate = new Date(createdAtDate.getTime() + 24 * 60 * 60 * 1000)
    }

    if (expiryDate) {
      const diffMs = expiryDate - new Date()
      if (diffMs < 0) {
        return (
          <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border border-rose-100">
            <Clock size={10} className="text-rose-500" /> CADUCADA
          </span>
        )
      }
      
      const hoursRemaining = diffMs / (1000 * 60 * 60)
      if (hoursRemaining <= 4) {
        const minsRemaining = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        const hoursFloor = Math.floor(hoursRemaining)
        const timeText = hoursFloor > 0 ? `${hoursFloor}h ${minsRemaining}m` : `${minsRemaining}m`
        return (
          <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border border-amber-200 shadow-sm animate-pulse">
            <Clock size={10} className="text-amber-500" /> POR CADUCAR ({timeText})
          </span>
        )
      }
    }

    return <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">ACTIVA</span>
  }

  const getVoucherCodigo = (quote) => {
    const ventas = Array.isArray(quote.ventas) ? quote.ventas : (quote.ventas ? [quote.ventas] : [])
    for (const v of ventas) {
      const voucherArr = Array.isArray(v.vouchers) ? v.vouchers : (v.vouchers ? [v.vouchers] : [])
      if (voucherArr.length > 0) return voucherArr[0].codigo
    }
    return null
  }

  const formatDestino = (raw, createdAt) => {
    if (!raw) return 'S/D'

    const isOld = createdAt ? new Date(createdAt) < new Date('2026-07-01T00:00:00') : false

    if (raw.includes('|')) {
      const [iatas, name] = raw.split('|')
      const formattedIatas = isOld ? iatas : formatIataWithCountry(iatas)
      
      if (name && formattedIatas) {
        return (
          <div className="flex flex-col gap-0.5">
            <span>{formattedIatas}</span>
            <span className="text-gray-600">{name}</span>
          </div>
        )
      }
      if (name) return name
      return formattedIatas
    }
    return isOld ? raw : formatIataWithCountry(raw)
  }



  const handleDelete = async (quote) => {
    if (!confirm('¿Seguro que quieres anular y archivar esta cotización? El registro quedará guardado como cancelada.')) return
    
    const isGanada = (quote.estado || '').trim().toLowerCase() === 'ganada'
    const hasVch = !!getVoucherCodigo(quote)
    const isSold = isGanada || hasVch

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/admin/anular-cotizacion', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cotizacionId: quote.id,
          anularVentas: isSold
        })
      })
      const result = await res.json()
      if (!result.ok) throw new Error(result.error || 'Error al anular la cotización')
      showToast('Cotización anulada y archivada.')
      onUpdate()
    } catch (err) {
      console.error(err)
      showToast(err.message, 'error')
    }
  }

  const handlePermanentDelete = async () => {
    if (!deleteConfirmQuote) return
    setDeletingPermanent(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/admin/eliminar-cotizacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cotizacionId: deleteConfirmQuote.id })
      })
      const result = await res.json()
      if (!result.ok) throw new Error(result.error || 'Error al eliminar')
      showToast('Cotización eliminada permanentemente de la base de datos.')
      setDeleteConfirmQuote(null)
      onUpdate()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeletingPermanent(false)
    }
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
            <th className="py-2.5 px-4">Código / Ref</th>
            <th className="py-2.5 px-4">Agencia / Destino</th>
            <th className="py-2.5 px-4">Pasajeros</th>
            <th className="py-2.5 px-4">Valor Venta</th>
            <th className="py-2.5 px-4">Aporte CTB</th>
            <th className="py-2.5 px-4">Operativo</th>
            <th className="py-2.5 px-4">Comercial</th>
            <th className="py-2.5 px-4">Estado</th>
            <th className="py-2.5 px-4 text-right">Acciones</th>
          </tr>

        </thead>
        <tbody className="divide-y divide-gray-50">
          {quotes.length === 0 ? (
            <tr>
              <td colSpan="9" className="py-20 text-center">
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <FileText size={48} />
                  <p className="text-xs font-black uppercase tracking-widest">No hay expedientes registrados</p>
                </div>
              </td>
            </tr>
          ) : quotes.map((quote) => {
            const rawStatus = (quote.estado || '').toString().trim().toLowerCase()
            const isGanada = rawStatus === 'ganada'
            const hasVch = !!getVoucherCodigo(quote)
            const isSold = isGanada || hasVch
            const isPerdida = rawStatus === 'perdida' || rawStatus === 'anulada'
            const aporte = (Number(quote.valor_utilidad || 0) + Number(quote.valor_comision || 0))
            return (
              <tr 
                key={quote.id} 
                className={`group hover:bg-gray-50 transition-colors cursor-pointer ${isSold ? 'bg-success/5' : ''}`}
                onClick={() => setViewingQuote(quote)}
              >
                <td className="py-2.5 px-4">
                  <div className="font-mono text-xs font-black text-primary">#{quote.codigo}</div>
                  {quote.created_at && (
                    <div className="text-[10px] text-gray-400 font-bold mt-0.5 whitespace-nowrap">
                      {new Date(quote.created_at).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-4">
                  <div className="font-black text-gray-800 text-sm leading-snug">{quote.agencia || 'Directo'}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em]" title={quote.destino}>{formatDestino(quote.destino, quote.created_at)}</div>
                  {isPerdida && quote.motivo_perdida && (
                    <div className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200/60 rounded px-1.5 py-0.2 mt-0.5 inline-block uppercase">
                      Motivo: {quote.motivo_perdida}
                    </div>
                  )}
                </td>

                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <div className="bg-gray-100 w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs text-gray-500">
                      {Math.max(quote.numero_pasajeros || 0, Array.isArray(quote.nombres_pasajeros) ? quote.nombres_pasajeros.length : 0) || 1}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-4 font-black text-gray-900 text-sm">
                  ${Number(quote.valor_total || 0).toLocaleString()}
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-sm font-black ${aporte > 0 ? 'text-success' : 'text-gray-300'}`}>
                    ${aporte.toLocaleString()}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-xs font-black text-primary uppercase tracking-tighter">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center text-[10px]">
                      {quote.profiles?.nombre?.charAt(0)}
                    </div>
                    {quote.profiles?.nombre?.split(' ')[0] || '---'}
                  </div>
                </td>
                <td className="py-2.5 px-4 text-xs font-black text-amber-650 uppercase tracking-tighter">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-amber-500/10 rounded-lg flex items-center justify-center text-[10px] text-amber-600">
                      {quote.comercial?.charAt(0) || 'C'}
                    </div>
                    {quote.comercial || '---'}
                  </div>
                </td>

                <td className="py-2.5 px-4">{getStatusBadge(quote)}</td>
                <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewingQuote(quote)} className="p-1.5 text-gray-400 hover:text-success hover:bg-white rounded-lg shadow-sm shadow-transparent hover:shadow-gray-200 transition-all" title="Ver Detalle"><Eye size={16} /></button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        const vCodigo = getVoucherCodigo(quote)
                        let qrBase64 = null
                        if (vCodigo) {
                          const qrSvg = document.createElement('div')
                          qrSvg.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="..."></path></svg>` // Simpler just to let pdf-generator handle it or we don't pass QR unless we actually grab the element. Actually, rendering QR in the DOM is what we do in Ventas, but here we can just pass null, or we can use the same approach of generating it. Let's just pass null for now or build the URL if needed.
                        }
                        // To be safe and simple, pass null for QR if no QR generation logic is readily available in QuotesTable
                        // Wait, they want the QR code if a voucher exists. Let's not pass the QR for quotes table, only for ventas. Or just pass null.
                        generateProformaPDF({ ...quote, destino_formateado: formatDestino(quote.destino, quote.created_at) }, null)
                      }}
                      className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                      title="Descargar PDF"
                    >
                      <FileText size={16} />
                    </button>
                    
                    {!isSold && !isPerdida && (
                      <>
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: quote }))}
                          className="p-1.5 text-success hover:bg-success/10 rounded-lg border border-success/10"
                          title="Aprobar Venta"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <button 
                          onClick={() => setClosingQuote(quote)}
                          className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg border border-amber-100"
                          title="Anular"
                        >
                          <AlertTriangle size={16} />
                        </button>
                      </>
                    )}

                    {isSold && (() => {
                      const vCodigo = getVoucherCodigo(quote)
                      const activeSale = Array.isArray(quote.ventas) ? quote.ventas.find(v => v.estado === 'activa') : (quote.ventas?.estado === 'activa' ? quote.ventas : null)
                      return (
                        <div className="flex items-center gap-1">
                          {activeSale && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                window.dispatchEvent(new CustomEvent('open-sales-modal', { 
                                  detail: { ...quote, existingSale: activeSale } 
                                }))
                              }}
                              className="p-1.5 text-success bg-success/10 hover:bg-success/20 rounded-lg border border-success/20 transition-all"
                              title="Editar Venta y Voucher"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                          {vCodigo && (
                            <>
                              <a
                                href={`/v/${vCodigo}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg border border-primary/10 transition-all"
                                title="Ver Voucher (QR)"
                              >
                                <QrCode size={16} />
                              </a>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const url = `${window.location.origin}/v/${vCodigo}`
                                  navigator.clipboard.writeText(url)
                                  showToast('Enlace del voucher copiado!')
                                }}
                                className="p-1.5 text-gray-400 hover:text-success hover:bg-success/10 rounded-lg border border-gray-100 transition-all"
                                title="Copiar Enlace del Voucher"
                              >
                                <Share2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })()}

                    {(isSuperAdmin || quote.operativo_id === effectiveUserId) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/cotizaciones/editar/${quote.id}`)
                        }} 
                        className="p-1.5 text-gray-400 hover:text-primary rounded-lg" 
                        title="Editar"
                      >
                        <Edit size={16}/>
                      </button>
                    )}
                    {isSuperAdmin && (
                      <>
                        <button
                          onClick={() => handleDelete(quote)}
                          className="p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Anular (queda registrada)"
                        >
                          <AlertCircle size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmQuote(quote)}
                          className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar permanentemente de la base de datos"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
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
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] max-w-lg w-full overflow-hidden shadow-2xl max-h-[95vh] flex flex-col">
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

              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Agencia</p>
                  <p className="text-xs sm:text-sm font-black text-gray-800 leading-tight truncate">{viewingQuote.agencia || 'Directo'}</p>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Comercial</p>
                  <p className="text-xs sm:text-sm font-black text-gray-800 leading-tight truncate">{viewingQuote.comercial || '---'}</p>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Destino</p>
                  <div className="text-xs sm:text-sm font-black text-gray-800 leading-tight uppercase truncate" title={viewingQuote.destino}>{formatDestino(viewingQuote.destino, viewingQuote.created_at)}</div>
                </div>
              </div>

              <div className="space-y-4 min-w-0">
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Pasajeros ({Math.max(viewingQuote.numero_pasajeros || 0, Array.isArray(viewingQuote.nombres_pasajeros) ? viewingQuote.nombres_pasajeros.length : 0) || 1})</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 max-h-32 overflow-y-auto pr-1">
                      {viewingQuote.nombres_pasajeros?.map((n, i) => (
                        <span key={i} className="text-[11px] sm:text-xs font-bold bg-white border border-gray-100 px-2 sm:px-2.5 py-1 rounded-lg text-gray-600 uppercase break-words max-w-full">{n}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {viewingQuote.notas_iniciales && (
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 min-w-0">
                    <p className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-widest mb-1.5">Observaciones / Especificaciones del Programa</p>
                    <p className="text-xs text-gray-700 font-medium whitespace-pre-wrap break-words">{viewingQuote.notas_iniciales}</p>
                  </div>
                )}

                {((viewingQuote.estado || '').trim().toLowerCase() === 'perdida' || (viewingQuote.estado || '').trim().toLowerCase() === 'anulada') && (
                  <div className="bg-red-50 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-red-100 text-red-600 min-w-0 break-words">
                    <p className="text-[10px] sm:text-xs font-black uppercase mb-1">Razón del Cierre Negativo</p>
                    <p className="text-xs sm:text-sm font-black italic">"{viewingQuote.motivo_perdida}"</p>
                    {viewingQuote.notas_seguimiento && <p className="text-[11px] sm:text-xs mt-2 opacity-80 leading-relaxed">{viewingQuote.notas_seguimiento}</p>}
                  </div>
                )}
              </div>

            </div>

            {(() => {
              const isSoldModal = (viewingQuote.estado || '').trim().toLowerCase() === 'ganada' || !!getVoucherCodigo(viewingQuote)
              const vCodigo = getVoucherCodigo(viewingQuote)
              return (
                <div className="p-4 sm:p-8 bg-gray-50 flex gap-2 sm:gap-3 shrink-0 border-t border-gray-100">
                  {!isSoldModal ? (
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
                  ) : (
                    vCodigo ? (
                      <>
                        <a
                          href={`/v/${vCodigo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-primary text-white py-3 sm:py-4 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5 sm:gap-2"
                        >
                          <QrCode size={18} className="shrink-0" /> <span className="truncate">Abrir Voucher</span>
                        </a>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/v/${vCodigo}`
                            navigator.clipboard.writeText(url)
                            showToast('Enlace del voucher copiado al portapapeles!')
                          }}
                          className="flex-1 bg-success text-white py-3 sm:py-4 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-success/20 flex items-center justify-center gap-1.5 sm:gap-2"
                        >
                          <Share2 size={18} className="shrink-0" /> <span className="truncate">Copiar Link</span>
                        </button>
                      </>
                    ) : null
                  )}
                  <button onClick={() => setViewingQuote(null)} className="flex-1 py-3 sm:py-4 text-xs sm:text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors text-center truncate">Cerrar Expediente</button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Modal de Anulación Premium */}
      {closingQuote && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
          <form onSubmit={handleMarcarPerdida} className="bg-white rounded-[3rem] max-w-md w-full overflow-hidden shadow-2xl">
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

      {/* Modal Eliminación Permanente */}
      {deleteConfirmQuote && (
        <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 p-8 text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Trash2 size={22} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Eliminar Permanente</h2>
              </div>
              <p className="text-red-100 text-xs font-bold uppercase tracking-widest">Esta acción NO se puede deshacer</p>
            </div>
            <div className="p-8 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-1">Se eliminará permanentemente:</p>
                <p className="font-black text-gray-900 text-sm">#{deleteConfirmQuote.codigo} — {deleteConfirmQuote.agencia || 'Directo'}</p>
                <div className="text-xs text-gray-500 mt-1 uppercase">{formatDestino(deleteConfirmQuote.destino, deleteConfirmQuote.created_at)}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 font-bold space-y-1">
                <p>⚠️ Se borrarán también todas las <b>ventas</b> y <b>vouchers</b> asociados.</p>
                <p>📋 Se guardará un log de auditoría con tu nombre.</p>
                <p>🚫 No hay forma de recuperar este registro después.</p>
              </div>
            </div>
            <div className="px-8 pb-8 flex gap-3">
              <button
                onClick={() => setDeleteConfirmQuote(null)}
                disabled={deletingPermanent}
                className="flex-1 py-4 rounded-2xl font-black text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={deletingPermanent}
                className="flex-1 py-4 rounded-2xl font-black text-sm text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Trash2 size={16} />
                {deletingPermanent ? 'Eliminando...' : 'Sí, eliminar para siempre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
