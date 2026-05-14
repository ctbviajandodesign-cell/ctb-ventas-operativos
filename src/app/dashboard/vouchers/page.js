'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { 
  Download, 
  ExternalLink, 
  Search, 
  CheckCircle,
  FileText
} from 'lucide-react'

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const [search, setSearch] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    fetchVouchers()
    setBaseUrl(window.location.origin)
  }, [])

  async function fetchVouchers() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    
    let query = supabase
      .from('vouchers')
      .select(`
        *,
        ventas (
          total,
          cotizaciones (
            agencia,
            destino,
            numero_pasajeros,
            nombres_pasajeros
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (profile.rol !== 'admin') {
      query = query.eq('operativo_id', user.id)
    }

    const { data } = await query
    setVouchers(data || [])
    setLoading(false)
  }

  const downloadQR = (id) => {
    const svg = document.getElementById(id)
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
    v.codigo.toLowerCase().includes(search.toLowerCase()) ||
    v.ventas?.cotizaciones?.agencia?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="p-8 text-center text-gray-400 font-medium animate-pulse">Cargando archivo de vouchers...</div>

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Archivo de Vouchers</h1>
          <p className="text-gray-500 text-sm font-medium italic">Certificados de ventas cerradas y validadas.</p>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input 
            className="input pl-10" 
            placeholder="Buscar por código o agencia..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((voucher) => (
          <div key={voucher.id} className="card group hover:border-success/50 transition-all border-l-4 border-l-success">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-black text-success uppercase tracking-widest">Código Oficial</p>
                <h3 className="text-xl font-black text-gray-900">{voucher.codigo}</h3>
              </div>
              <div className="bg-success/10 p-2 rounded-lg text-success">
                <CheckCircle size={20} />
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Agencia:</span>
                <span className="font-bold text-gray-700">{voucher.ventas?.cotizaciones?.agencia}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Destino:</span>
                <span className="font-bold text-gray-700">{voucher.ventas?.cotizaciones?.destino}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Pasajeros:</span>
                <span className="font-bold text-gray-700">{voucher.ventas?.cotizaciones?.numero_pasajeros}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedVoucher(voucher)}
                className="flex-1 btn-primary py-2 text-xs flex items-center justify-center gap-2"
              >
                <QrCode size={14} /> Ver QR
              </button>
              <button 
                onClick={() => downloadQR(voucher.codigo)}
                className="p-2 bg-gray-50 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                title="Descargar PNG"
              >
                <Download size={18} />
              </button>
            </div>

            {/* Hidden SVG for download logic */}
            <div className="hidden">
                <QRCodeSVG 
                  id={voucher.codigo}
                  value={`${baseUrl}/v/${voucher.codigo}`}
                  size={512}
                  level="H"
                  includeMargin={true}
                />
            </div>
          </div>
        ))}
      </div>

      {/* Modal Visualizador de Voucher */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-gray-900 p-8 text-center text-white space-y-4">
              <div className="inline-block bg-white p-4 rounded-2xl shadow-xl">
                <QRCodeSVG 
                  value={`${baseUrl}/v/${selectedVoucher.codigo}`}
                  size={200}
                  level="H"
                />
              </div>
              <div>
                <h2 className="text-2xl font-black">{selectedVoucher.codigo}</h2>
                <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Voucher de Seguridad CTB</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-success/10 p-2 rounded-lg text-success"><FileText size={18} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Pasajeros</p>
                    <p className="text-sm font-bold text-gray-700">
                      {selectedVoucher.ventas?.cotizaciones?.nombres_pasajeros?.join(', ') || 'Sin nombres'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => downloadQR(selectedVoucher.codigo)}
                  className="btn-primary py-4 flex items-center justify-center gap-2"
                >
                  <Download size={20} /> Descargar Imagen para Documentos
                </button>
                <button 
                  onClick={() => setSelectedVoucher(null)}
                  className="py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cerrar Visualizador
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QrCode({ size, className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16h.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
    </svg>
  )
}
