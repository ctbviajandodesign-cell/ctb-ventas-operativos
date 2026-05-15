'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { 
  Download, 
  Search, 
  CheckCircle,
  FileText,
  Edit,
  XCircle,
  Save,
  QrCode as QrIcon,
  Trash2,
  MapPin,
  Users,
  Clock,
  Building2,
  DollarSign,
  FileDown
} from 'lucide-react'
import { generateVoucherPDF } from '@/lib/pdf-generator'

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingVoucher, setEditingVoucher] = useState(null)
  const [viewingVoucher, setViewingVoucher] = useState(null)
  const [search, setSearch] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    fetchVouchers()
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  async function fetchVouchers() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    setProfile(p)
    
    let query = supabase
      .from('vouchers')
      .select('*')
      .order('created_at', { ascending: false })

    if (p?.rol !== 'admin') {
      query = query.eq('operativo_id', user.id)
    }

    const { data } = await query
    setVouchers(data || [])
    setLoading(false)
  }

  const handleDeleteVoucher = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar este voucher permanentemente?')) return
    const { error } = await supabase.from('vouchers').delete().eq('id', id)
    if (!error) fetchVouchers()
  }

  const handleUpdateVoucher = async (e) => {
    e.preventDefault()
    const { error } = await supabase
      .from('vouchers')
      .update({
        agencia: editingVoucher.agencia,
        valor_total: editingVoucher.valor_total,
        destino: editingVoucher.destino,
        fecha_viaje_desde: editingVoucher.fecha_viaje_desde,
        fecha_viaje_hasta: editingVoucher.fecha_viaje_hasta,
        fecha_caducidad: editingVoucher.fecha_caducidad,
        notas: editingVoucher.notas
      })
      .eq('id', editingVoucher.id)
    
    if (!error) {
      setEditingVoucher(null)
      fetchVouchers()
    }
  }

  const downloadQR = (id) => {
    const svg = document.getElementById(id)
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.download = `Voucher-${id}.png`
      downloadLink.href = `${pngFile}`
      downloadLink.click()
    }
    img.src = "data:image/svg+xml;base64," + btoa(svgData)
  }

  const filtered = vouchers.filter(v => 
    v.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    v.agencia?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="p-8 text-center text-gray-400 font-medium animate-pulse">Cargando archivo de vouchers...</div>

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Archivo de Vouchers</h1>
          <p className="text-gray-500 text-sm font-medium italic underline decoration-success/30">Gestión de certificados y validación QR.</p>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input 
            className="input pl-10" 
            placeholder="Buscar código o agencia..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden border-t-4 border-t-success">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                <th className="py-4 px-6">Código</th>
                <th className="py-4 px-6">Agencia / Destino</th>
                <th className="py-4 px-6 text-right">Valor</th>
                <th className="py-4 px-6">Vigencia</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((voucher) => (
                <tr 
                  key={voucher.id} 
                  className="group hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setViewingVoucher(voucher)}
                >
                  <td className="py-4 px-6 font-mono text-xs font-bold text-success">{voucher.codigo}</td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-gray-800 text-sm">{voucher.agencia || 'CTB Directo'}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">{voucher.destino}</div>
                  </td>
                  <td className="py-4 px-6 text-right font-black text-gray-900">
                    ${Number(voucher.valor_total || 0).toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-[10px] font-medium text-gray-500">
                      {voucher.fecha_viaje_desde} al {voucher.fecha_viaje_hasta}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setViewingVoucher(voucher)}
                        className="p-2 text-gray-400 hover:text-success hover:bg-success/5 rounded-lg transition-colors"
                        title="Ver Detalle"
                      >
                        <QrIcon size={18} />
                      </button>
                      <button 
                        onClick={() => setEditingVoucher(voucher)}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="Editar Voucher"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => generateVoucherPDF(voucher)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Descargar PDF Profesional"
                      >
                        <FileDown size={18} />
                      </button>
                      <button 
                        onClick={() => downloadQR(voucher.codigo)}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="Descargar PNG (Solo QR)"
                      >
                        <Download size={18} />
                      </button>
                      {profile?.rol === 'admin' && (
                        <button 
                          onClick={() => handleDeleteVoucher(voucher.id)}
                          className="p-2 text-danger hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    {/* Hidden SVG for download */}
                    <div className="hidden">
                      <QRCodeSVG 
                        id={voucher.codigo}
                        value={`${baseUrl}/v/${voucher.codigo}`}
                        size={512}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Visualizador de Voucher COMPLETO */}
      {viewingVoucher && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-gray-900 p-8 text-center text-white space-y-4">
              <div className="inline-block bg-white p-4 rounded-2xl shadow-xl">
                <QRCodeSVG 
                  value={`${baseUrl}/v/${viewingVoucher.codigo}`}
                  size={150}
                  level="H"
                />
              </div>
              <div>
                <h2 className="text-2xl font-black">{viewingVoucher.codigo}</h2>
                <span className="badge-success inline-block mt-2">VOUCHER ACTIVO</span>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Building2 size={10} /> Agencia
                  </p>
                  <p className="text-sm font-black text-gray-800 leading-tight">
                    {viewingVoucher.agencia || 'CTB Directo'}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <DollarSign size={10} /> Valor
                  </p>
                  <p className="text-lg font-black text-primary leading-none">
                    ${Number(viewingVoucher.valor_total || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary h-fit"><MapPin size={16} /></div>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Destino</p>
                    <p className="text-sm font-bold text-gray-800">{viewingVoucher.destino || 'Sin destino'}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary h-fit"><Users size={16} /></div>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pasajeros</p>
                    <div className="mt-1">
                      {Array.isArray(viewingVoucher.pasajeros) ? viewingVoucher.pasajeros.map((n, i) => (
                        <p key={i} className="text-xs font-bold text-gray-800">{n}</p>
                      )) : (
                        <p className="text-xs font-bold text-gray-400 italic">No especificados</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary h-fit"><Clock size={16} /></div>
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Inicio Viaje</p>
                      <p className="text-xs font-bold text-gray-800">{viewingVoucher.fecha_viaje_desde}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Caducidad QR</p>
                      <p className="text-xs font-bold text-danger">{viewingVoucher.fecha_caducidad}</p>
                    </div>
                  </div>
                </div>
              </div>

              {viewingVoucher.notas && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 italic text-xs text-amber-800">
                  <p className="font-black text-[9px] uppercase tracking-widest mb-1 opacity-60">Notas del Operativo</p>
                  "{viewingVoucher.notas}"
                </div>
              )}
            </div>

            <div className="p-8 bg-gray-50 flex flex-col gap-2">
              <button 
                onClick={() => generateVoucherPDF(viewingVoucher)}
                className="btn-primary py-4 flex items-center justify-center gap-2"
              >
                <FileDown size={20} /> Descargar PDF Oficial
              </button>
              <button 
                onClick={() => downloadQR(viewingVoucher.codigo)}
                className="py-3 text-xs font-black text-primary uppercase tracking-widest hover:bg-primary/5 rounded-2xl transition-all"
              >
                Descargar Solo Código QR (PNG)
              </button>
              <button 
                onClick={() => setViewingVoucher(null)}
                className="py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Voucher */}
      {editingVoucher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <form onSubmit={handleUpdateVoucher} className="bg-white rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-primary p-8 text-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">Editar Voucher</h2>
                <button type="button" onClick={() => setEditingVoucher(null)}><XCircle size={24} /></button>
              </div>
              <p className="text-xs opacity-80 mt-1 uppercase tracking-widest font-bold">{editingVoucher.codigo}</p>
            </div>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Agencia</label>
                  <input 
                    className="input text-sm" 
                    value={editingVoucher.agencia || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, agencia: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Destino</label>
                  <input 
                    className="input text-sm" 
                    value={editingVoucher.destino || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, destino: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Valor Total ($)</label>
                <input 
                  type="number"
                  className="input text-sm font-bold" 
                  value={editingVoucher.valor_total || 0}
                  onChange={e => setEditingVoucher({...editingVoucher, valor_total: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Válido Desde</label>
                  <input 
                    type="date"
                    className="input text-sm" 
                    value={editingVoucher.fecha_viaje_desde || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, fecha_viaje_desde: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Válido Hasta</label>
                  <input 
                    type="date"
                    className="input text-sm" 
                    value={editingVoucher.fecha_viaje_hasta || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, fecha_viaje_hasta: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Fecha Caducidad QR</label>
                <input 
                  type="date"
                  className="input text-sm" 
                  value={editingVoucher.fecha_caducidad || ''}
                  onChange={e => setEditingVoucher({...editingVoucher, fecha_caducidad: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Notas Adicionales</label>
                <textarea 
                  className="input text-sm min-h-[80px]" 
                  value={editingVoucher.notas || ''}
                  onChange={e => setEditingVoucher({...editingVoucher, notas: e.target.value})}
                />
              </div>
            </div>

            <div className="p-8 bg-gray-50 flex gap-3">
              <button 
                type="submit"
                className="flex-1 btn-primary py-4 flex items-center justify-center gap-2"
              >
                <Save size={20} /> Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
