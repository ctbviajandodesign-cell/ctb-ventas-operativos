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
  QrCode as QrIcon
} from 'lucide-react'

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const [editingVoucher, setEditingVoucher] = useState(null)
  const [search, setSearch] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    fetchVouchers()
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  async function fetchVouchers() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    
    let query = supabase
      .from('vouchers')
      .select('*')
      .order('created_at', { ascending: false })

    if (profile?.rol !== 'admin') {
      query = query.eq('operativo_id', user.id)
    }

    const { data } = await query
    setVouchers(data || [])
    setLoading(false)
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
                <th className="py-4 px-6">Estado</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((voucher) => (
                <tr key={voucher.id} className="group hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 font-mono text-xs font-bold text-success">{voucher.codigo}</td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-gray-800 text-sm">{voucher.agencia || 'CTB Directo'}</div>
                    <div className="text-[10px] text-gray-400">{voucher.destino}</div>
                  </td>
                  <td className="py-4 px-6 text-right font-black text-gray-900">
                    ${Number(voucher.valor_total || 0).toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-[10px] font-medium text-gray-500">
                      {voucher.fecha_viaje_desde} al {voucher.fecha_viaje_hasta}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="badge-success">ACTIVO</span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedVoucher(voucher)}
                        className="p-2 text-gray-400 hover:text-success hover:bg-success/5 rounded-lg transition-colors"
                        title="Ver QR"
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
                        onClick={() => downloadQR(voucher.codigo)}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="Descargar PNG"
                      >
                        <Download size={18} />
                      </button>
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

      {/* Modal Visualizador de QR */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] max-w-sm w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-gray-900 p-10 text-center text-white space-y-6">
              <div className="inline-block bg-white p-6 rounded-[2rem] shadow-2xl">
                <QRCodeSVG 
                  value={`${baseUrl}/v/${selectedVoucher.codigo}`}
                  size={200}
                  level="H"
                />
              </div>
              <div>
                <h2 className="text-3xl font-black">{selectedVoucher.codigo}</h2>
                <p className="text-[10px] text-gray-400 uppercase tracking-[0.3em] mt-2">Certificado de Seguridad CTB</p>
              </div>
            </div>
            <div className="p-10 flex flex-col gap-3">
              <button 
                onClick={() => downloadQR(selectedVoucher.codigo)}
                className="btn-primary py-4 flex items-center justify-center gap-2"
              >
                <Download size={20} /> Guardar Imagen
              </button>
              <button 
                onClick={() => setSelectedVoucher(null)}
                className="py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Voucher */}
      {editingVoucher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
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
