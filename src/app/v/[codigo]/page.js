'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { 
  CheckCircle2, 
  MapPin, 
  Calendar, 
  Users, 
  ShieldCheck,
  AlertCircle,
  Building2,
  DollarSign,
  Clock,
  Plane,
  Hotel,
  Bus,
  Map,
  Zap,
  Info
} from 'lucide-react'

export default function VoucherVerificationPage() {
  const { codigo } = useParams()
  const [voucher, setVoucher] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVoucher()
  }, [codigo])

  async function fetchVoucher() {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('codigo', codigo)
        .single()
      
      if (data) setVoucher(data)
    } catch (err) {
      console.error('Error fetching voucher:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatSimpleDate = (dateStr) => {
    if (!dateStr) return 'No definida'
    try {
      const parts = dateStr.split('-')
      if (parts.length !== 3) return dateStr
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      return `${parts[2]} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`
    } catch (e) {
      return dateStr
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-center">
      <div className="space-y-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_20px_rgba(0,102,204,0.3)]"></div>
        <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-xs animate-pulse">Encriptando Conexión CTB...</p>
      </div>
    </div>
  )


  if (!voucher) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
      <div className="space-y-6 max-w-sm">
        <div className="bg-red-50 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto text-red-500 shadow-xl shadow-red-100">
          <AlertCircle size={48} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Voucher No Encontrado</h1>
        <p className="text-gray-500 text-sm font-medium">Este código no coincide con ningún registro oficial en nuestros servidores centrales. Por favor contacte con su asesor CTB.</p>
        <button onClick={() => window.location.reload()} className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Reintentar Sincronización</button>
      </div>
    </div>
  )

  const isExpired = voucher.fecha_caducidad && new Date(voucher.fecha_caducidad) < new Date()
  const isAnulado = voucher.estado === 'anulado'
  const isValid = voucher.estado === 'activo' && !isExpired

  const renderTextWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold hover:text-blue-800">
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-4 font-sans selection:bg-primary/30">
      
      {/* DECORACIÓN DE FONDO */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative group animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* CABECERA: STATUS BADGE */}
        <div className="flex justify-center mb-[-16px] relative z-20 px-4">
          <div className={`px-6 py-2.5 rounded-full border-2 ${isValid ? 'bg-success border-white/20' : 'bg-danger border-white/20'} text-white shadow-2xl flex items-center gap-2.5 animate-bounce text-center`}>
            {isValid ? <ShieldCheck size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest truncate">
              {isAnulado ? 'Voucher Anulado' : (isValid ? 'Verificado & Válido' : 'Documento Vencido')}
            </span>
          </div>
        </div>



        {/* ESTRUCTURA TICKET */}
        <div className="bg-white rounded-[3rem] shadow-[0_40px_80px_rgba(0,0,0,0.5)] overflow-hidden relative">
          
          {/* PARTE SUPERIOR (AGENCIA Y PRECIO) */}
          <div className="bg-gray-900 p-6 sm:p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 sm:p-10 opacity-5 -mr-10 -mt-10"><Plane size={180} /></div>
            <div className="flex justify-between items-start gap-4 relative z-10">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-[0.3em] mb-1 sm:mb-2">Travel Agency</p>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter leading-tight italic break-words">{voucher.agencia || 'CTB Directo'}</h2>
              </div>
              <img src="/logo.png" alt="CTB" className="h-8 w-8 sm:h-12 sm:w-12 brightness-0 invert shrink-0 object-contain" />
            </div>

            <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 relative z-10 border-t border-white/10 sm:border-t-0 pt-4 sm:pt-0">
              <div>
                <p className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Código de Seguridad</p>
                <p className="text-lg sm:text-2xl font-mono font-black tracking-tight text-white break-all">{voucher.codigo}</p>
              </div>
              <div className="sm:text-right">
                <p className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mb-1 ${isValid ? 'text-success' : 'text-danger'}`}>Estado del Voucher</p>
                <p className={`text-lg sm:text-xl font-black tracking-tight uppercase ${isValid ? 'text-success' : 'text-danger'}`}>
                  {isAnulado ? 'Anulado' : (isValid ? 'Confirmado' : 'Vencido')}
                </p>
              </div>
            </div>
          </div>




          {/* SEPARADOR TICKET (DASHED LINE WITH NOTCHES) */}
          <div className="relative h-4 bg-white">
            <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0F172A] rounded-full shadow-inner"></div>
            <div className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 bg-[#0F172A] rounded-full shadow-inner"></div>
            <div className="mx-6 border-b-2 border-dashed border-gray-100 h-1/2"></div>
          </div>

          {/* CUERPO DEL TICKET */}
          <div className="p-6 sm:p-10 space-y-8 sm:space-y-10">
            
            {/* PASAJEROS */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0"><Users size={16} /></div>
                <h3 className="text-[11px] sm:text-xs font-black text-gray-400 uppercase tracking-widest leading-tight">Pasajeros del Expediente</h3>
              </div>
              <div className="flex flex-wrap gap-2 pl-1 sm:pl-2">
                {Array.isArray(voucher.pasajeros) ? (
                   voucher.pasajeros.map((n, i) => (
                    <div key={i} className="bg-gray-50 px-3.5 py-2 rounded-2xl border border-gray-100 flex items-center gap-2 max-w-full">
                      <div className="w-1.5 h-1.5 bg-success rounded-full shrink-0"></div>
                      <span className="text-xs font-black text-gray-800 uppercase italic truncate">{n}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-bold text-gray-400 pl-1">Sin pasajeros registrados</p>
                )}
              </div>
            </div>

            {/* DESTINO Y FECHAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0"><MapPin size={16} /></div>
                  <h3 className="text-[11px] sm:text-xs font-black text-gray-400 uppercase tracking-widest leading-tight">Destino</h3>
                </div>
                <p className="text-lg sm:text-xl font-black text-gray-900 uppercase leading-tight pl-1 sm:pl-2 break-words">{voucher.destino || 'EXPLORE'}</p>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0"><Calendar size={16} /></div>
                  <h3 className="text-[11px] sm:text-xs font-black text-gray-400 uppercase tracking-widest leading-tight">Fecha Viaje</h3>
                </div>
                <p className="text-xs sm:text-sm font-black text-gray-900 uppercase leading-tight pl-1 sm:pl-2 italic break-words">
                  {formatSimpleDate(voucher.fecha_viaje_desde)}
                </p>
              </div>
            </div>

            {/* INCLUSIONES (JSONB) */}
            {voucher.inclusiones && (
              <div className="space-y-4 bg-gray-50 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100">
                <h3 className="text-[11px] sm:text-xs font-black text-gray-400 uppercase tracking-[0.2em] text-center mb-1 sm:mb-2 flex items-center justify-center gap-2">
                  <Zap size={16} className="text-primary shrink-0" /> Servicios Incluidos
                </h3>
                <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                  {Object.entries(voucher.inclusiones).map(([key, val]) => {
                    if (!val) return null
                    return (
                      <div key={key} className="flex flex-col items-center gap-1.5 sm:gap-2">
                        <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-gray-100 text-primary group-hover:scale-110 transition-transform">
                          {key === 'hotel' && <Hotel size={20} className="sm:w-6 sm:h-6" />}
                          {key === 'traslados' && <Bus size={20} className="sm:w-6 sm:h-6" />}
                          {key === 'boletos' && <Plane size={20} className="sm:w-6 sm:h-6" />}
                          {key === 'tours' && <Map size={20} className="sm:w-6 sm:h-6" />}
                          {key === 'seguro' && <ShieldCheck size={20} className="sm:w-6 sm:h-6" />}
                        </div>
                        <span className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">{key}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* NOTAS */}
            {voucher.notas && (
              <div className="bg-blue-50/50 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-blue-100 flex gap-3.5 sm:gap-4 items-start">
                <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm font-medium text-blue-800 leading-relaxed italic break-words">
                  "{renderTextWithLinks(voucher.notas)}"
                </p>
              </div>
            )}
          </div>

          {/* FOOTER: CERTIFICADO */}
          <div className="bg-gray-50 p-6 sm:p-10 flex flex-col items-center gap-3 sm:gap-4 border-t border-dashed border-gray-200 text-center">
            <div className="flex items-center gap-2.5 justify-center flex-wrap">
              <div className="bg-success/10 p-2 rounded-full shrink-0"><ShieldCheck size={16} className="text-success" /></div>
              <span className="text-[11px] sm:text-xs font-black text-gray-900 uppercase tracking-[0.2em] break-words">CTB Blockchain Certified</span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-[0.2em] max-w-[260px] leading-relaxed">Este documento digital es intransferible y auténtico.</p>
          </div>
        </div>
      </div>
      
      <p className="mt-12 text-xs font-black text-gray-500 uppercase tracking-[0.4em] text-center opacity-50">
        CTB VIAJANDO · REAL-TIME VERIFICATION
      </p>
    </div>

  )
}
