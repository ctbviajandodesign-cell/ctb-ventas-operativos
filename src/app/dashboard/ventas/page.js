'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import { 
  TrendingUp, Search, XCircle, Trash2, Edit, DollarSign,
  CheckCircle2, BarChart3, QrCode, ExternalLink, AlertCircle
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import Link from 'next/link'

export default function VentasPage() {
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('activa')
  const { user, profile, isAdmin, loading: sessionLoading } = useUserSession()
  const [errorState, setErrorState] = useState(null)
  const [selectedVenta, setSelectedVenta] = useState(null)
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const [voucherLoading, setVoucherLoading] = useState(false)

  useEffect(() => {
    if (!sessionLoading && user) {
      fetchVentas()
    }
  }, [sessionLoading, user])

  async function fetchVentas() {
    setLoading(true)
    setErrorState(null)
    try {
      let query = supabase
        .from('ventas')
        .select('*, cotizaciones(id, agencia, destino, codigo, nombres_pasajeros, valor_total, valor_comision, valor_utilidad, valor_bono)')
        .order('created_at', { ascending: false })

      if (!isAdmin) {
        query = query.eq('operativo_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error

      setVentas(data || [])
    } catch (error) {
      console.error(error)
      setErrorState('No pudimos cargar la lista de ventas. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  // Stats calculadas
  const stats = useMemo(() => {
    const activas = ventas.filter(v => v.estado === 'activa')
    const anuladas = ventas.filter(v => v.estado === 'anulada')
    const totalVenta = activas.reduce((acc, v) => acc + (Number(v.total) || 0), 0)
    const totalAporte = activas.reduce((acc, v) => acc + (Number(v.comision) || 0) + (Number(v.utilidad) || 0), 0)
    return { activas: activas.length, anuladas: anuladas.length, totalVenta, totalAporte }
  }, [ventas])

  // Gráfico: ventas por semana/mes (agrupado por día)
  const chartData = useMemo(() => {
    const byDay = {}
    ventas
      .filter(v => v.estado === 'activa')
      .forEach(v => {
        const day = v.created_at?.split('T')[0] || 'N/A'
        if (!byDay[day]) byDay[day] = { fecha: day, ventas: 0, aporte: 0 }
        byDay[day].ventas += Number(v.total) || 0
        byDay[day].aporte += (Number(v.comision) || 0) + (Number(v.utilidad) || 0)
      })
    return Object.values(byDay)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-14) // últimas 2 semanas
      .map(d => ({
        ...d,
        fechaLabel: d.fecha !== 'N/A' ? format(parseISO(d.fecha), 'dd MMM', { locale: es }) : 'N/A'
      }))
  }, [ventas])

  const handleAnular = async (venta) => {
    if (!confirm('¿Seguro que deseas ANULAR esta venta? El voucher asociado quedará inactivo.')) return
    try {
      await supabase.from('ventas').update({ estado: 'anulada' }).eq('id', venta.id)
      await supabase.from('vouchers').update({ estado: 'inactivo' }).eq('venta_id', venta.id)
      await supabase.from('cotizaciones').update({ estado: 'en_seguimiento' }).eq('id', venta.cotizacion_id)
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

  const filtered = useMemo(() => {
    let result = ventas
    if (statusFilter !== 'todas') {
      result = result.filter(v => v.estado === statusFilter)
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      result = result.filter(v =>
        v.cotizaciones?.agencia?.toLowerCase().includes(s) ||
        v.cotizaciones?.codigo?.toLowerCase().includes(s) ||
        v.cotizaciones?.destino?.toLowerCase().includes(s)
      )
    }
    return result
  }, [ventas, statusFilter, search])

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando ventas...</p>
      </div>
    </div>
  )

  if (errorState) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <h3 className="text-xl font-bold text-gray-800 mb-2">Error de conexión</h3>
      <p className="text-gray-500 mb-6">{errorState}</p>
      <button onClick={fetchVentas} className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition">
        Reintentar
      </button>
    </div>
  )

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">

      {/* ENCABEZADO */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">Mis Proformas</h1>
        <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-1">Cotizaciones aprobadas y convertidas en venta</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Ventas Activas</p>
          <p className="text-4xl font-black text-gray-900 mt-2">{stats.activas}</p>
          <p className="text-xs text-success font-bold mt-2 uppercase">Confirmadas</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Anuladas</p>
          <p className="text-4xl font-black text-gray-900 mt-2">{stats.anuladas}</p>
          <p className="text-xs text-danger font-bold mt-2 uppercase">Revertidas</p>
        </div>
        <div className="bg-primary/5 border border-primary/10 p-6 rounded-[2rem]">
          <p className="text-xs font-black text-primary/80 uppercase tracking-widest">Total Vendido</p>
          <p className="text-2xl font-black text-primary mt-2">${stats.totalVenta.toLocaleString()}</p>
          <p className="text-xs text-primary/60 font-bold mt-2 uppercase">Solo ventas activas</p>
        </div>
        <div className="bg-gray-900 text-white p-6 rounded-[2rem]">
          <p className="text-xs font-black text-primary uppercase tracking-widest">Mi Ganancia</p>
          <p className="text-2xl font-black mt-2">${stats.totalAporte.toLocaleString()}</p>
          <p className="text-xs text-gray-400 font-bold mt-2 uppercase">Comisión + Utilidad</p>
        </div>

      </div>

      {/* GRÁFICO DE TENDENCIA */}
      {chartData.length > 1 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="font-black text-lg uppercase tracking-tighter text-gray-800 mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-primary" />
            Tendencia de Ventas (Últimos 14 días)
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradVenta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066CC" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0066CC" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAporte" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="fechaLabel" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12, fontWeight: 900 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12, fontWeight: 900 }} />

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload?.length) {
                      return (
                        <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-xl text-xs">
                          <p className="font-black text-primary uppercase text-xs mb-2">{label}</p>
                          <p className="font-black">Venta: ${(payload[0]?.value || 0).toLocaleString()}</p>
                          <p className="font-black text-success">Ganancia: ${(payload[1]?.value || 0).toLocaleString()}</p>
                        </div>

                      )
                    }
                    return null
                  }}
                />
                <Area type="monotone" dataKey="ventas" stroke="#0066CC" strokeWidth={2} fill="url(#gradVenta)" />
                <Area type="monotone" dataKey="aporte" stroke="#16A34A" strokeWidth={2} fill="url(#gradAporte)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-primary rounded-full"></div><span className="text-xs font-black text-gray-400 uppercase">Venta Total</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-success rounded-full"></div><span className="text-xs font-black text-gray-400 uppercase">Mi Ganancia</span></div>
          </div>

        </div>
      )}

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2">
          {[
            { key: 'todas', label: 'Todas' },
            { key: 'activa', label: '✓ Activas' },
            { key: 'anulada', label: '✗ Anuladas' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                statusFilter === tab.key ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-3 text-gray-300" size={16} />
          <input
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-gray-300"
            placeholder="Buscar por código o agencia..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs font-black uppercase tracking-widest">
                <th className="py-4 px-6">Fecha</th>
                <th className="py-4 px-6">Referencia</th>
                <th className="py-4 px-6">Agencia / Destino</th>
                <th className="py-4 px-6 text-right">Total Venta</th>
                <th className="py-4 px-6 text-right">Mi Ganancia</th>
                <th className="py-4 px-6">Estado</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <DollarSign size={48} />
                      <p className="text-xs font-black uppercase tracking-widest">Sin resultados</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((venta) => (
                <tr
                  key={venta.id}
                  className={`group hover:bg-gray-50 transition-colors cursor-pointer ${venta.estado === 'anulada' ? 'opacity-40 grayscale' : ''}`}
                  onClick={async () => {
                    setSelectedVenta(venta)
                    setSelectedVoucher(null)
                    setVoucherLoading(true)
                    const { data } = await supabase
                      .from('vouchers')
                      .select('id, codigo, estado')
                      .eq('venta_id', venta.id)
                      .single()
                    setSelectedVoucher(data || null)
                    setVoucherLoading(false)
                  }}
                >
                  <td className="py-4 px-6 text-xs text-gray-500 font-bold">
                    {format(parseISO(venta.created_at), 'dd MMM yyyy', { locale: es })}
                  </td>
                  <td className="py-4 px-6 font-mono text-xs font-black text-primary">
                    #{venta.cotizaciones?.codigo}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-black text-gray-800 text-sm">{venta.cotizaciones?.agencia}</div>
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">{venta.cotizaciones?.destino}</div>
                  </td>

                  <td className="py-4 px-6 text-right font-black text-gray-900">
                    ${Number(venta.total).toLocaleString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="bg-success/10 text-success px-3 py-1 rounded-xl font-black text-xs">
                      ${(Number(venta.comision) + Number(venta.utilidad)).toLocaleString()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {venta.estado === 'activa'
                      ? <span className="badge-success">ACTIVA</span>
                      : <span className="badge-danger">ANULADA</span>
                    }
                  </td>
                  <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {venta.estado === 'activa' && (
                        <>
                          <button
                            onClick={() => window.dispatchEvent(new CustomEvent('open-sales-modal', {
                              detail: {
                                ...venta.cotizaciones,
                                id: venta.cotizaciones?.id,
                                agencia: venta.cotizaciones?.agencia,
                                destino: venta.cotizaciones?.destino,
                                codigo: venta.cotizaciones?.codigo,
                                nombres_pasajeros: venta.cotizaciones?.nombres_pasajeros,
                                existingSale: venta
                              }
                            }))}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                            title="Editar Venta"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleAnular(venta)}
                            className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-colors"
                            title="Anular Venta"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                      {profile?.rol === 'admin' && (
                        <button
                          onClick={() => handleDelete(venta.id)}
                          className="p-2 text-danger hover:bg-red-50 rounded-xl transition-colors"
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
        </div>
      </div>

      {/* MODAL DETALLE */}
      {selectedVenta && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] max-w-2xl w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-gray-900 p-8 text-white flex justify-between items-start">
              <div>
                <p className="text-xs font-black text-primary uppercase tracking-widest">Detalle de Venta</p>
                <h2 className="text-2xl font-black">#{selectedVenta.cotizaciones?.codigo}</h2>
                <p className="text-sm text-gray-400 mt-1">{selectedVenta.cotizaciones?.agencia} · {selectedVenta.cotizaciones?.destino}</p>
              </div>
              <button onClick={() => { setSelectedVenta(null); setSelectedVoucher(null) }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs font-black text-gray-400 uppercase">Total Venta</p>
                  <p className="text-xl font-black text-gray-900 mt-1">${Number(selectedVenta.total).toLocaleString()}</p>
                </div>
                <div className="bg-success/5 p-4 rounded-2xl">
                  <p className="text-xs font-black text-success/80 uppercase">Mi Ganancia</p>
                  <p className="text-xl font-black text-success mt-1">${(Number(selectedVenta.utilidad) + Number(selectedVenta.comision)).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs font-black text-gray-400 uppercase">Bono</p>
                  <p className="text-xl font-black text-gray-900 mt-1">${Number(selectedVenta.bono_counter || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* VOUCHER */}
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Voucher Emitido</h4>
                {voucherLoading ? (
                  <div className="h-12 bg-gray-100 rounded-2xl animate-pulse"></div>
                ) : selectedVoucher ? (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2.5 rounded-xl"><QrCode size={18} className="text-primary" /></div>
                      <div>
                        <p className="font-black text-gray-900 text-sm">{selectedVoucher.codigo}</p>
                        <p className={`text-xs font-black uppercase ${selectedVoucher.estado === 'activo' ? 'text-success' : 'text-danger'}`}>{selectedVoucher.estado}</p>
                      </div>
                    </div>
                    <Link href="/dashboard/vouchers" onClick={() => setSelectedVenta(null)} className="flex items-center gap-1.5 text-xs font-black text-primary bg-primary/10 px-3 py-2 rounded-xl hover:bg-primary/20 transition-colors">
                      Ver Voucher <ExternalLink size={12} />
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-amber-700">Esta venta no tiene voucher emitido.</p>
                  </div>
                )}
              </div>

              {/* PLAN DE PAGOS */}
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Plan de Pagos</h4>
                {/* Barra progreso */}
                {Array.isArray(selectedVenta.plan_pagos) && selectedVenta.plan_pagos.length > 0 && (() => {
                  const paid = selectedVenta.plan_pagos.filter(m => m.status === 'pagado').reduce((a, m) => a + Number(m.amount), 0)
                  const pct = selectedVenta.total > 0 ? Math.min((paid / selectedVenta.total) * 100, 100) : 0
                  return (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs font-black uppercase mb-1">
                        <span className="text-success">Cobrado: ${paid.toLocaleString()}</span>
                        <span className={paid < selectedVenta.total ? 'text-amber-600' : 'text-success'}>{paid < selectedVenta.total ? `Pendiente: $${(selectedVenta.total - paid).toLocaleString()}` : '✓ Completo'}</span>
                      </div>
                      <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  )
                })()}
                <div className="space-y-2">
                  {Array.isArray(selectedVenta.plan_pagos) && selectedVenta.plan_pagos.length > 0
                    ? selectedVenta.plan_pagos.map((m, i) => (
                      <div key={i} className={`flex justify-between items-center p-3.5 rounded-xl ${m.status === 'pagado' ? 'bg-success/5 border border-success/10' : 'bg-amber-50 border border-amber-100'}`}>
                        <div>
                          <p className="text-xs font-black text-gray-800">{m.label}</p>
                          <p className="text-xs text-gray-400">{m.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-gray-900">${Number(m.amount).toLocaleString()}</p>
                          <p className={`text-xs font-black uppercase ${m.status === 'pagado' ? 'text-success' : 'text-amber-600'}`}>{m.status === 'pagado' ? '✓ Pagado' : 'Pendiente'}</p>
                        </div>
                      </div>
                    ))
                    : <p className="text-xs text-gray-400 italic">Sin plan de pagos registrado</p>
                  }
                </div>
              </div>

              {/* PASAJEROS */}
              {(selectedVenta.cotizaciones?.nombres_pasajeros || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Pasajeros</h4>
                  <div className="flex flex-wrap gap-2">
                    {(selectedVenta.cotizaciones?.nombres_pasajeros || []).map((n, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-black text-primary">{n?.charAt(0)}</div>
                        <p className="text-xs font-bold text-gray-700 uppercase">{n}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <button onClick={() => { setSelectedVenta(null); setSelectedVoucher(null) }} className="text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors">
                Cerrar
              </button>
              {selectedVenta.estado === 'activa' && (
                <button
                  onClick={() => {
                    const q = {
                      ...selectedVenta.cotizaciones,
                      id: selectedVenta.cotizaciones?.id,
                      agencia: selectedVenta.cotizaciones?.agencia,
                      destino: selectedVenta.cotizaciones?.destino,
                      codigo: selectedVenta.cotizaciones?.codigo,
                      nombres_pasajeros: selectedVenta.cotizaciones?.nombres_pasajeros,
                      existingSale: selectedVenta
                    }
                    setSelectedVenta(null)
                    setSelectedVoucher(null)
                    window.dispatchEvent(new CustomEvent('open-sales-modal', { detail: q }))
                  }}
                  className="btn-primary py-3 px-6 text-sm flex items-center gap-2"
                >
                  <Edit size={16} /> Editar Plan de Pagos
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
