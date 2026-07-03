'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Sparkles, 
  RefreshCw, 
  Edit 
} from 'lucide-react'

// Utilidad local para no depender de page.js
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

export default function OperativePanelModal({
  operativePanel,
  setOperativePanel,
  onClose,
  isAdmin,
  selectedOperative,
  setSelectedOperative,
  setEditingVoucher
}) {
  const [profileTab, setProfileTab] = useState('resumen')
  const [loadingPanelAi, setLoadingPanelAi] = useState(false)

  if (!operativePanel) return null

  const handleRefreshAi = () => {
    setLoadingPanelAi(true)
    fetch('/api/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modo: 'INDIVIDUAL_ADMIN',
        metricas: {
          nombreAsesor: operativePanel.nombreCompleto || operativePanel.nombre,
          meta: operativePanel.meta,
          cumplimiento: operativePanel.cumplimiento,
          vouchers: operativePanel.vouchers || 0,
          total: operativePanel.totalCots,
          abiertas: operativePanel.abiertas,
          ganadas: operativePanel.ganadas,
          perdidas: operativePanel.perdidas,
          conversion: operativePanel.conversion,
          totalAporte: operativePanel.ganancia,
          topDestino: operativePanel.topDestino
        }
      })
    })
    .then(r => r.json())
    .then(aiData => { 
      if (aiData.insight) {
        setOperativePanel(prev => prev ? {...prev, aiInsight: aiData.insight} : null) 
      }
    })
    .finally(() => setLoadingPanelAi(false))
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-[3rem] w-full max-w-3xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white p-8 flex items-start justify-between shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg">
              {operativePanel.avatar}
            </div>
            <div>
              <p className="text-xs font-black text-primary uppercase tracking-widest mb-1">Perfil de Operativo</p>
              <h2 className="text-2xl font-black tracking-tight">{operativePanel.nombreCompleto || operativePanel.nombre}</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-bold uppercase tracking-wider">{operativePanel.ciudad} · Meta mensual: ${operativePanel.meta?.toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-xl font-black relative z-10">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-150 bg-gray-50 px-6 pt-2 shrink-0">
          {[
            { id: 'resumen', label: 'Resumen', count: null },
            { id: 'cotizaciones', label: 'Cotizaciones', count: operativePanel.cotizacionesList?.length },
            { id: 'proformas', label: 'Vendidas', count: operativePanel.ventasList?.length },
            { id: 'vouchers', label: 'Vouchers', count: operativePanel.vouchersList?.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setProfileTab(tab.id)}
              className={`px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all mr-4 relative ${
                profileTab === tab.id
                  ? 'border-primary text-primary font-black'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${
                  profileTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-8 space-y-6 overflow-y-auto flex-1">
          {profileTab === 'resumen' && (
            <>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Cumplimiento de Meta (Mes)</span>
                  <span className={`text-xs font-black uppercase ${operativePanel.cumplimiento >= 100 ? 'text-success' : operativePanel.cumplimiento >= 60 ? 'text-primary' : 'text-amber-600'}`}>
                    {Number(operativePanel.cumplimiento).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(operativePanel.cumplimiento, 100)}%`, background: operativePanel.cumplimiento >= 100 ? '#16A34A' : operativePanel.cumplimiento >= 60 ? '#0066CC' : '#F5A623' }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-success font-black">Ganancia CTB: ${operativePanel.ganancia?.toLocaleString()}</span>
                  <span className="text-xs text-gray-400 font-bold">Restan: ${Math.max(0, (operativePanel.meta||0) - (operativePanel.ganancia||0)).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase">Total de Ventas</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">${(operativePanel.valorTotalCliente || operativePanel.totalVendido)?.toLocaleString()}</p>
                </div>
                <div className="bg-success/5 p-5 rounded-2xl border border-success/10">
                  <p className="text-xs font-black text-success/80 uppercase">Ganancia CTB</p>
                  <p className="text-2xl font-black text-success mt-1">${operativePanel.ganancia?.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase">Tasa de Cierre</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{operativePanel.conversion}%</p>
                </div>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <p className="text-xs font-black text-gray-400 uppercase">Vouchers Emitidos</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{operativePanel.vouchers}</p>
                </div>
              </div>

              {/* FEEDBACK DE OPENAI BAJO DEMANDA */}
              <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-6 rounded-3xl text-white relative overflow-hidden border border-indigo-500/20 shadow-xl">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-xl pointer-events-none"></div>
                <div className="flex items-center justify-between gap-4 mb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-xl border border-primary/30 text-primary">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">OpenAI Analytics</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Auditoría Inteligente de Asesor</p>
                    </div>
                  </div>
                  {operativePanel.aiInsight && (
                    <button
                      onClick={handleRefreshAi}
                      disabled={loadingPanelAi}
                      className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                      title="Actualizar auditoría"
                    >
                      <RefreshCw size={14} className={`text-gray-400 ${loadingPanelAi ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
                <div className="relative z-10 min-h-[60px] flex items-center justify-center">
                  {loadingPanelAi ? (
                    <div className="space-y-2 w-full py-2">
                      <div className="h-2.5 bg-white/10 rounded-full animate-pulse w-full"></div>
                      <div className="h-2.5 bg-white/10 rounded-full animate-pulse w-5/6"></div>
                      <div className="h-2.5 bg-white/10 rounded-full animate-pulse w-2/3"></div>
                    </div>
                  ) : operativePanel.aiInsight ? (
                    <p className="text-xs sm:text-sm leading-relaxed text-gray-200 italic font-medium w-full">
                      "{operativePanel.aiInsight}"
                    </p>
                  ) : (
                    <div className="text-center py-2 space-y-3 w-full">
                      <p className="text-xs text-gray-400 max-w-sm mx-auto">
                        No se pudo cargar la auditoría automática.
                      </p>
                      <button
                        onClick={handleRefreshAi}
                        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                      >
                        <RefreshCw size={14} />
                        Reintentar Carga
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Cotizaciones (histórico total)</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Ganadas', val: operativePanel.ganadas, color: 'text-success bg-success/10 border-success/20' },
                    { label: 'En Espera', val: operativePanel.abiertas, color: 'text-primary bg-primary/10 border-primary/20' },
                    { label: 'Caducadas', val: operativePanel.caducadas, color: 'text-rose-600 bg-rose-50 border-rose-100' },
                    { label: 'Perdidas', val: operativePanel.perdidas, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                  ].map(item => (
                    <div key={item.label} className={`p-3 rounded-2xl text-center border ${item.color} min-w-0`}>
                      <p className="text-2xl font-black truncate">{item.val}</p>
                      <p className="text-[10px] font-black uppercase mt-0.5 truncate">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {profileTab === 'cotizaciones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-widest text-gray-400">Cotizaciones Registradas</h3>
                <Link href="/dashboard/cotizaciones/nueva" onClick={onClose} className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline">
                  + Nueva Cotización
                </Link>
              </div>
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Agencia / Destino</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {(!operativePanel.cotizacionesList || operativePanel.cotizacionesList.length === 0) ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">Sin cotizaciones</td>
                      </tr>
                    ) : operativePanel.cotizacionesList.map(q => {
                      const status = (q.estado || '').toString().trim().toLowerCase()
                      const isGanada = status === 'ganada' || (Array.isArray(q.ventas) && q.ventas.some(v => v.estado !== 'anulada'))
                      return (
                        <tr key={q.id} className="hover:bg-gray-50/50 font-semibold">
                          <td className="py-3.5 px-4 font-mono font-black text-primary">#{q.codigo}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-800">{q.agencia || 'Directo'}</div>
                            <div className="text-[10px] text-gray-450 uppercase">{q.destino}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-gray-900">${Number(q.valor_total || 0).toLocaleString()}</td>
                          <td className="py-3.5 px-4">
                            {isGanada ? (
                              <span className="bg-success/10 text-success px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center block">VENDIDA</span>
                            ) : status === 'perdida' || status === 'anulada' ? (
                              <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center block">CANCELADA</span>
                            ) : isExpired(q) ? (
                              <span className="bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center block">CADUCADA</span>
                            ) : (
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center block">ACTIVA</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Link 
                              href={`/dashboard/cotizaciones/editar/${q.id}`} 
                              onClick={onClose}
                              className="p-1.5 text-gray-455 hover:text-primary hover:bg-gray-100 rounded-lg inline-block transition-colors"
                              title="Editar Cotización"
                            >
                              <Edit size={14} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {profileTab === 'proformas' && (
            <div className="space-y-4">
              <h3 className="font-black text-sm uppercase tracking-widest text-gray-400">Vendidas Activas</h3>
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Agencia / Destino</th>
                      <th className="py-3 px-4 text-right">Aporte CTB</th>
                      <th className="py-3 px-4 text-right">Total Venta</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {(!operativePanel.ventasList || operativePanel.ventasList.length === 0) ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">Sin ventas</td>
                      </tr>
                    ) : operativePanel.ventasList.map(v => (
                      <tr key={v.id} className={`hover:bg-gray-50/50 font-semibold ${v.estado === 'anulada' ? 'opacity-50 grayscale' : ''}`}>
                        <td className="py-3.5 px-4 font-mono font-black text-primary">#{v.cotizaciones?.codigo || v.numero_proforma}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-800">{v.cotizaciones?.agencia || 'Directo'}</div>
                          <div className="text-[10px] text-gray-450 uppercase">{v.cotizaciones?.destino}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-success font-black">${(Number(v.comision || 0) + Number(v.utilidad || 0)).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-black text-gray-900">${Number(v.total || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right">
                          {v.estado === 'activa' && (
                            <button 
                              onClick={() => {
                                onClose();
                                window.dispatchEvent(new CustomEvent('open-sales-modal', {
                                  detail: {
                                    ...v.cotizaciones,
                                    id: v.cotizaciones?.id,
                                    agencia: v.cotizaciones?.agencia,
                                    destino: v.cotizaciones?.destino,
                                    codigo: v.cotizaciones?.codigo,
                                    nombres_pasajeros: v.cotizaciones?.nombres_pasajeros,
                                    existingSale: v
                                  }
                                }))
                              }}
                              className="p-1.5 text-gray-455 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                              title="Editar Venta"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {profileTab === 'vouchers' && (
            <div className="space-y-4">
              <h3 className="font-black text-sm uppercase tracking-widest text-gray-400">Vouchers Emitidos</h3>
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Agencia / Destino</th>
                      <th className="py-3 px-4">Vigencia</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {(!operativePanel.vouchersList || operativePanel.vouchersList.length === 0) ? (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">Sin vouchers</td>
                      </tr>
                    ) : operativePanel.vouchersList.map(vch => (
                      <tr key={vch.id} className="hover:bg-gray-50/50 font-semibold">
                        <td className="py-3.5 px-4 font-mono font-bold text-success">{vch.codigo}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-800">{vch.agencia || 'Directo'}</div>
                          <div className="text-[10px] text-gray-455 uppercase">{vch.destino}</div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 font-bold leading-tight">
                          {vch.fecha_viaje_desde} al {vch.fecha_viaje_hasta}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button 
                            onClick={() => setEditingVoucher(vch)}
                            className="p-1.5 text-gray-455 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar Voucher"
                          >
                            <Edit size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {isAdmin && selectedOperative !== operativePanel.id && (
          <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
            <button
              onClick={() => { setSelectedOperative(operativePanel.id); onClose(); }}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-tighter text-sm hover:scale-[1.02] transition-all shadow-lg shadow-primary/20"
            >
              Ver Dashboard Completo de {operativePanel.nombre} →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
