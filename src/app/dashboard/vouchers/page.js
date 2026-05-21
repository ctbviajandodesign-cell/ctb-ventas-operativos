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
  const [selectedCity, setSelectedCity] = useState('todas')
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
    const { data: p } = await supabase.from('profiles').select('rol, ciudad').eq('id', user.id).single()
    setProfile(p)
    
    let query = supabase
      .from('vouchers')
      .select('*, profiles!inner(nombre, ciudad), ventas(id, cotizaciones(comercial))')
      .order('created_at', { ascending: false })

    if (p?.rol !== 'admin') {
      query = query.eq('profiles.ciudad', p.ciudad)
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
    const pasajerosArr = typeof editingVoucher.pasajeros === 'string'
      ? editingVoucher.pasajeros.split('\n').map(s => s.trim()).filter(Boolean)
      : editingVoucher.pasajeros || []
    const { error } = await supabase
      .from('vouchers')
      .update({
        agencia: editingVoucher.agencia,
        destino: editingVoucher.destino,
        pasajeros: pasajerosArr,
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

  const filtered = vouchers.filter(v => {
    const matchSearch = v.codigo?.toLowerCase().includes(search.toLowerCase()) ||
                        v.agencia?.toLowerCase().includes(search.toLowerCase()) ||
                        v.profiles?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
                        (v.ventas?.cotizaciones?.comercial || '').toLowerCase().includes(search.toLowerCase())
    const matchCity = profile?.rol === 'admin' && selectedCity !== 'todas'
      ? v.profiles?.ciudad === selectedCity
      : true
    return matchSearch && matchCity
  })

  const handleExportVouchers = () => {
    if (filtered.length === 0) {
      alert('No hay datos para exportar.')
      return
    }
    const headers = ['Codigo,Agencia,Destino,Pasajeros,Desde,Hasta,Estado,Operativo,Comercial,Notas']
    const rows = filtered.map(v => {
      const codigo = v.codigo || ''
      const agencia = (v.agencia || 'Directo').replace(/,/g, ';')
      const destino = (v.destino || '').replace(/,/g, ';')
      const pasajeros = (Array.isArray(v.pasajeros) ? v.pasajeros.join('; ') : '').replace(/,/g, ';')
      const desde = v.fecha_viaje_desde || ''
      const hasta = v.fecha_viaje_hasta || ''
      const estado = v.estado || 'activo'
      const operativo = v.profiles?.nombre || 'N/A'
      const comercial = v.ventas?.cotizaciones?.comercial || 'N/A'
      const notas = (v.notas || '').replace(/,/g, ';').replace(/\n/g, ' ')
      return `${codigo},${agencia},${destino},${pasajeros},${desde},${hasta},${estado},${operativo},${comercial},${notas}`
    })

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Reporte_Vouchers_CTB_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) return <div className="p-8 text-center text-gray-400 font-medium animate-pulse">Cargando archivo de vouchers...</div>

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Archivo de Vouchers</h1>
          <p className="text-gray-500 text-sm font-medium italic underline decoration-success/30">Gestión de certificados y validación QR.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {profile?.rol === 'admin' && (
            <select
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-black text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
            >
              <option value="todas">Todas las Ciudades</option>
              <option value="Quito">Quito</option>
              <option value="Guayaquil">Guayaquil</option>
              <option value="Cuenca">Cuenca</option>
              <option value="Manta">Manta</option>
              <option value="Loja">Loja</option>
            </select>
          )}

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              className="input pl-10" 
              placeholder="Buscar..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={handleExportVouchers}
            className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-black uppercase tracking-widest px-5 py-3 rounded-2xl flex items-center gap-2 hover:scale-102 transition-all shadow-md shrink-0"
          >
            <Download size={14} /> Exportar XLS
          </button>
        </div>
      </div>

      <div className="card overflow-hidden border-t-4 border-t-success">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs font-black uppercase tracking-widest">
                <th className="py-4 px-6">Código</th>
                <th className="py-4 px-6">Agencia / Destino</th>
                <th className="py-4 px-6 text-right">Valor</th>
                <th className="py-4 px-6">Vigencia</th>
                <th className="py-4 px-6">Operativo</th>
                <th className="py-4 px-6">Comercial</th>
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
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{voucher.destino}</div>
                  </td>
                  <td className="py-4 px-6 text-right font-black text-gray-900">
                    ${Number(voucher.valor_total || 0).toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-xs font-medium text-gray-500">
                      {voucher.fecha_viaje_desde} al {voucher.fecha_viaje_hasta}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-xs font-black text-primary uppercase tracking-tighter">
                    {voucher.profiles?.nombre?.split(' ')[0] || '---'}
                  </td>
                  <td className="py-4 px-6 text-xs font-black text-amber-600 uppercase tracking-tighter">
                    {voucher.ventas?.cotizaciones?.comercial || '---'}
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300 max-h-[95vh] flex flex-col">
            <div className="bg-gray-900 p-6 sm:p-8 text-center text-white space-y-3 sm:space-y-4 shrink-0">
              <div className="inline-block bg-white p-3 sm:p-4 rounded-2xl shadow-xl">
                <QRCodeSVG 
                  value={`${baseUrl}/v/${viewingVoucher.codigo}`}
                  size={120}
                  level="H"
                />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{viewingVoucher.codigo}</h2>
                <span className="badge-success inline-block mt-1 sm:mt-2 text-[10px] sm:text-xs">VOUCHER ACTIVO</span>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1 max-h-[45vh] sm:max-h-[55vh]">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Building2 size={12} className="shrink-0" /> Agencia
                  </p>
                  <p className="text-xs sm:text-sm font-black text-gray-800 leading-tight truncate">
                    {viewingVoucher.agencia || 'CTB Directo'}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Users size={12} className="shrink-0" /> Pasajeros
                  </p>
                  <p className="text-base sm:text-lg font-black text-gray-800 leading-none">
                    {Array.isArray(viewingVoucher.pasajeros) ? viewingVoucher.pasajeros.length : (viewingVoucher.pasajeros || 0)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
                    👤 Operativo
                  </p>
                  <p className="text-xs sm:text-sm font-black text-gray-800 leading-tight truncate">
                    {viewingVoucher.profiles?.nombre || 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-100 min-w-0">
                  <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
                    💼 Comercial
                  </p>
                  <p className="text-xs sm:text-sm font-black text-amber-700 leading-tight truncate">
                    {viewingVoucher.ventas?.cotizaciones?.comercial || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="flex gap-3 sm:gap-4 items-start">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0 mt-0.5"><MapPin size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">Destino</p>
                    <p className="text-xs sm:text-sm font-bold text-gray-800 break-words">{viewingVoucher.destino || 'Sin destino'}</p>
                  </div>
                </div>

                <div className="flex gap-3 sm:gap-4 items-start">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0 mt-0.5"><Users size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">Pasajeros</p>
                    <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto pr-2">
                      {Array.isArray(viewingVoucher.pasajeros) ? viewingVoucher.pasajeros.map((n, i) => (
                        <p key={i} className="text-xs font-bold text-gray-800 break-words">{n}</p>
                      )) : (
                        <p className="text-xs font-bold text-gray-400 italic">No especificados</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 sm:gap-4 items-start">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0 mt-0.5"><Clock size={16} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1 min-w-0">
                    <div>
                      <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">Inicio Viaje</p>
                      <p className="text-xs font-bold text-gray-800">{viewingVoucher.fecha_viaje_desde}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">Caducidad QR</p>
                      <p className="text-xs font-bold text-danger">{viewingVoucher.fecha_caducidad}</p>
                    </div>
                  </div>
                </div>
              </div>

              {viewingVoucher.notas && (
                <div className="bg-amber-50 p-3 sm:p-4 rounded-2xl border border-amber-100 italic text-xs text-amber-800 break-words">
                  <p className="font-black text-[10px] sm:text-xs uppercase tracking-widest mb-1 opacity-80">Notas del Operativo</p>
                  "{viewingVoucher.notas}"
                </div>
              )}
            </div>


            <div className="p-4 sm:p-8 bg-gray-50 flex flex-col gap-2 shrink-0 border-t border-gray-100">
              <button 
                onClick={() => generateVoucherPDF(viewingVoucher)}
                className="btn-primary py-3 sm:py-4 flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <FileDown size={18} /> Descargar PDF Oficial
              </button>
              <button 
                onClick={() => downloadQR(viewingVoucher.codigo)}
                className="py-2.5 sm:py-3 text-[10px] sm:text-xs font-black text-primary uppercase tracking-widest hover:bg-primary/5 rounded-2xl transition-all text-center"
              >
                Descargar Solo Código QR (PNG)
              </button>
              <button 
                onClick={() => setViewingVoucher(null)}
                className="py-2 sm:py-3 text-xs sm:text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors text-center"
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
                  <label className="text-xs font-black text-gray-400 uppercase">Agencia</label>
                  <input 
                    className="input text-sm" 
                    value={editingVoucher.agencia || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, agencia: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Destino</label>
                  <input 
                    className="input text-sm" 
                    value={editingVoucher.destino || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, destino: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase">Nombres de Pasajeros (uno por línea)</label>
                <textarea 
                  className="input text-sm min-h-[90px] font-mono" 
                  placeholder="Juan Pérez&#10;María García&#10;Carlos López..."
                  value={Array.isArray(editingVoucher.pasajeros) ? editingVoucher.pasajeros.join('\n') : (editingVoucher.pasajeros || '')}
                  onChange={e => setEditingVoucher({...editingVoucher, pasajeros: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Válido Desde</label>
                  <input 
                    type="date"
                    className="input text-sm" 
                    value={editingVoucher.fecha_viaje_desde || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, fecha_viaje_desde: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Válido Hasta</label>
                  <input 
                    type="date"
                    className="input text-sm" 
                    value={editingVoucher.fecha_viaje_hasta || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, fecha_viaje_hasta: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase">Fecha Caducidad QR</label>
                <input 
                  type="date"
                  className="input text-sm" 
                  value={editingVoucher.fecha_caducidad || ''}
                  onChange={e => setEditingVoucher({...editingVoucher, fecha_caducidad: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase">Notas Adicionales</label>
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
