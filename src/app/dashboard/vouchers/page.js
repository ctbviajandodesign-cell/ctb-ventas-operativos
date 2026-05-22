'use client'

import { useEffect, useState, useMemo } from 'react'
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
  FileDown,
  Share2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { generateVoucherPDF } from '@/lib/pdf-generator'
import { logActivity } from '@/utils/audit'
import { showToast } from '@/utils/toast'

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingVoucher, setEditingVoucher] = useState(null)
  const [viewingVoucher, setViewingVoucher] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState('todas')
  const [dateFilter, setDateFilter] = useState('todas')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [baseUrl, setBaseUrl] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedCity, dateFilter])

  const copyVoucherLink = (e, codigo) => {
    if (e) e.stopPropagation()
    const url = `${baseUrl}/v/${codigo}`
    navigator.clipboard.writeText(url)
    showToast('Enlace de voucher copiado al portapapeles!')
  }

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

    if (p?.rol !== 'admin' && p?.rol !== 'superadmin') {
      query = query.eq('profiles.ciudad', p.ciudad)
    }

    const { data } = await query
    setVouchers(data || [])
    setLoading(false)
  }

  const handleDeleteVoucher = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar este voucher permanentemente?')) return
    const targetVoucher = vouchers.find(v => v.id === id)
    const { error } = await supabase.from('vouchers').delete().eq('id', id)
    if (!error) {
      logActivity('eliminar_voucher', `Se eliminó el voucher ${targetVoucher?.codigo || id} (Agencia: ${targetVoucher?.agencia || 'CTB'}, Destino: ${targetVoucher?.destino || ''}).`)
      fetchVouchers()
    }
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
        fecha_caducidad: editingVoucher.fecha_viaje_hasta,
        notas: editingVoucher.notas,
        recordatorio_texto: editingVoucher.recordatorio_texto || null,
        recordatorio_dias_antes: editingVoucher.recordatorio_dias_antes || null
      })
      .eq('id', editingVoucher.id)
    if (!error) {
      logActivity('editar_voucher', `Se editó el voucher ${editingVoucher.codigo} (Agencia: ${editingVoucher.agencia}, Destino: ${editingVoucher.destino}).`)
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
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.download = `Voucher-${id}.png`
      downloadLink.href = `${pngFile}`
      downloadLink.click()
    }
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  }

  const getQrBase64 = (id) => {
    return new Promise((resolve) => {
      const svg = document.getElementById(id)
      if (!svg) return resolve(null)
      const svgData = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL("image/png"))
      }
      img.onerror = () => resolve(null)
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
    })
  }

  const filtered = useMemo(() => {
    let result = vouchers
    
    // 1. Búsqueda por texto
    if (search.trim()) {
      const s = search.toLowerCase()
      result = result.filter(v =>
        v.codigo?.toLowerCase().includes(s) ||
        v.agencia?.toLowerCase().includes(s) ||
        v.profiles?.nombre?.toLowerCase().includes(s) ||
        (v.ventas?.cotizaciones?.comercial || '').toLowerCase().includes(s)
      )
    }

    // 2. Filtro por ciudad
    if ((profile?.rol === 'admin' || profile?.rol === 'superadmin') && selectedCity !== 'todas') {
      result = result.filter(v => v.profiles?.ciudad === selectedCity)
    }

    // 3. Filtro por fecha de creación
    if (dateFilter !== 'todas') {
      const now = new Date()
      result = result.filter(v => {
        if (!v.created_at) return false
        const date = new Date(v.created_at)
        const diffTime = Math.abs(now - date)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (dateFilter === 'hoy') {
          return date.toDateString() === now.toDateString()
        }
        if (dateFilter === 'semana') {
          return diffDays <= 7
        }
        if (dateFilter === 'mes') {
          return diffDays <= 30
        }
        if (dateFilter === 'año') {
          return date.getFullYear() === now.getFullYear()
        }
        return true
      })
    }

    return result
  }, [vouchers, search, selectedCity, dateFilter, profile])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filtered.slice(startIndex, startIndex + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  // Calcular Recordatorios Activos
  const getActiveReminders = () => {
    if (!vouchers.length) return []
    const today = new Date()
    today.setHours(0,0,0,0)

    return vouchers.filter(v => {
      if (v.estado !== 'activo' || !v.fecha_viaje_desde || !v.recordatorio_dias_antes) return false
      
      const fechaViaje = new Date(v.fecha_viaje_desde + 'T00:00:00')
      const fechaRecordatorio = new Date(fechaViaje)
      fechaRecordatorio.setDate(fechaViaje.getDate() - v.recordatorio_dias_antes)
      
      // Mostrar si hoy es mayor o igual al día del recordatorio, Y el viaje aún no ha pasado
      return today >= fechaRecordatorio && today <= fechaViaje
    })
  }

  const activeReminders = getActiveReminders()

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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Archivo de Vouchers</h1>
          <p className="text-gray-500 text-sm font-medium italic underline decoration-success/30">Gestión de certificados y validación QR.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
          {/* Filtro por fecha */}
          <div className="relative w-full sm:w-auto sm:min-w-[13.5rem] flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2 hover:bg-gray-100/50 transition-colors">
            <Calendar size={14} className="text-primary shrink-0" />
            <select
              className="w-full appearance-none bg-transparent border-none pr-8 pl-1 py-1 text-xs font-black text-gray-800 outline-none focus:ring-0 cursor-pointer uppercase tracking-wider bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            >
              <option value="todas">Todas las Fechas</option>
              <option value="hoy">Hoy</option>
              <option value="semana">Esta Semana</option>
              <option value="mes">Este Mes</option>
              <option value="año">Este Año</option>
            </select>
          </div>

          {(profile?.rol === 'admin' || profile?.rol === 'superadmin') && (
            <div className="relative w-full sm:w-auto sm:min-w-[13.5rem] flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2 hover:bg-gray-100/50 transition-colors">
              <Filter size={14} className="text-primary shrink-0" />
              <select
                className="w-full appearance-none bg-transparent border-none pr-8 pl-1 py-1 text-xs font-black text-gray-800 outline-none focus:ring-0 cursor-pointer uppercase tracking-wider bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
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
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-3.5 text-gray-400" size={14} />
            <input 
              className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-gray-400 transition-all" 
              placeholder="Buscar..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={handleExportVouchers}
            className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white text-xs font-black uppercase tracking-widest px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:scale-102 transition-all shadow-md shrink-0"
          >
            <Download size={14} /> Exportar XLS
          </button>
        </div>
      </div>

      {activeReminders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-6 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
              <Clock size={20} />
            </div>
            <h2 className="text-lg font-black text-amber-900 tracking-tight">Recordatorios Activos ({activeReminders.length})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeReminders.map(r => (
              <div key={`rem-${r.id}`} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                <div className="flex justify-between items-start">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-700">{r.codigo}</p>
                  <p className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{r.fecha_viaje_desde}</p>
                </div>
                <p className="text-sm font-bold text-gray-800 break-words">{r.recordatorio_texto}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-gray-500 font-medium">{r.agencia || 'Directo'} - {r.destino}</p>
                  <button 
                    onClick={() => setViewingVoucher(r)}
                    className="text-[10px] font-black uppercase bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600 transition-colors"
                  >
                    Ver detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden border-t-4 border-t-success">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs font-black uppercase tracking-widest">
                <th className="py-4 px-6">Creado</th>
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
              {paginatedData.map((voucher) => (
                <tr 
                  key={voucher.id} 
                  className="group hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setViewingVoucher(voucher)}
                >
                  <td className="py-4 px-6 text-xs text-gray-500 font-bold">
                    {voucher.created_at ? format(parseISO(voucher.created_at), 'dd MMM yyyy', { locale: es }) : '---'}
                  </td>
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
                        onClick={(e) => copyVoucherLink(e, voucher.codigo)}
                        className="p-2 text-gray-400 hover:text-success hover:bg-success/5 rounded-lg transition-colors"
                        title="Copiar Enlace del Voucher"
                      >
                        <Share2 size={18} />
                      </button>
                      {profile?.rol === 'superadmin' && (
                        <button 
                          onClick={() => setEditingVoucher(voucher)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Editar Voucher"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation()
                          const qrBase64 = await getQrBase64(voucher.codigo)
                          generateVoucherPDF(voucher, qrBase64)
                        }}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Descargar PDF Profesional"
                      >
                        <FileDown size={18} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadQR(voucher.codigo)
                        }}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="Descargar PNG (Solo QR)"
                      >
                        <Download size={18} />
                      </button>
                      {profile?.rol === 'superadmin' && (
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

      {/* PAGINACIÓN */}
      {filtered.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mt-6">
          <p className="text-xs font-black uppercase text-gray-400 tracking-wider">
            Mostrando {Math.min(filtered.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filtered.length, currentPage * itemsPerPage)} de {filtered.length} Vouchers
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-gray-600"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-black uppercase tracking-widest text-gray-700 px-4">
              Pág. {currentPage} de {Math.ceil(filtered.length / itemsPerPage)}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filtered.length / itemsPerPage), prev + 1))}
              disabled={currentPage === Math.ceil(filtered.length / itemsPerPage)}
              className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-gray-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Visualizador de Voucher COMPLETO */}
      {viewingVoucher && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] max-w-lg w-full overflow-hidden shadow-2xl max-h-[95vh] flex flex-col">
            <div className="bg-gray-900 p-6 sm:p-8 text-center text-white space-y-3 sm:space-y-4 shrink-0">
              <div className="inline-block bg-white p-3 sm:p-4 rounded-2xl shadow-xl">
                <QRCodeSVG 
                  id={`popup-${viewingVoucher.codigo}`}
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
                onClick={async () => {
                  let qrBase64 = await getQrBase64(`popup-${viewingVoucher.codigo}`)
                  if (!qrBase64) qrBase64 = await getQrBase64(viewingVoucher.codigo)
                  generateVoucherPDF(viewingVoucher, qrBase64)
                }}
                className="btn-primary py-3 sm:py-4 flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <FileDown size={18} /> Descargar PDF Oficial
              </button>
              <button 
                onClick={() => copyVoucherLink(null, viewingVoucher.codigo)}
                className="py-3 sm:py-4 bg-success text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-success/20 flex items-center justify-center gap-2 hover:bg-success/90 transition-all hover:scale-102"
              >
                <Share2 size={18} /> Copiar Enlace del Voucher
              </button>
              <button 
                onClick={() => {
                  const el = document.getElementById(`popup-${viewingVoucher.codigo}`)
                  downloadQR(el ? `popup-${viewingVoucher.codigo}` : viewingVoucher.codigo)
                }}
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
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
          <form onSubmit={handleUpdateVoucher} className="bg-white rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Días antes para Recordatorio</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="Ej: 5"
                    className="input text-sm" 
                    value={editingVoucher.recordatorio_dias_antes || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, recordatorio_dias_antes: e.target.value ? Number(e.target.value) : null})}
                  />
                  <p className="text-[10px] text-gray-400 font-bold">Aviso en Telegram antes del inicio del viaje</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase">Nota del Recordatorio</label>
                  <input 
                    className="input text-sm" 
                    placeholder="Ej: Pagar a hotel y traslados"
                    value={editingVoucher.recordatorio_texto || ''}
                    onChange={e => setEditingVoucher({...editingVoucher, recordatorio_texto: e.target.value})}
                  />
                </div>
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
