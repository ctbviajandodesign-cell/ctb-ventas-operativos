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
  AlertCircle
} from 'lucide-react'

export default function VoucherVerificationPage() {
  const { codigo } = useParams()
  const [voucher, setVoucher] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVoucher()
  }, [codigo])

  async function fetchVoucher() {
    const { data, error } = await supabase
      .from('vouchers')
      .select(`
        *,
        ventas (
          cotizaciones (
            agencia,
            nombres_pasajeros
          )
        )
      `)
      .eq('codigo', codigo)
      .single()
    
    if (data) setVoucher(data)
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
      <div className="animate-pulse space-y-4">
        <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Verificando Certificado...</p>
      </div>
    </div>
  )

  if (!voucher) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
      <div className="space-y-6 max-w-sm">
        <div className="bg-red-50 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto text-red-500">
          <AlertCircle size={48} />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Voucher No Encontrado</h1>
        <p className="text-gray-500 text-sm">Este código no coincide con ningún certificado oficial emitido por CTB Viajando.</p>
        <div className="pt-4 border-t border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Seguridad CTB Operativos</p>
        </div>
      </div>
    </div>
  )

  const isExpired = voucher.fecha_caducidad && new Date(voucher.fecha_caducidad) < new Date()
  const isValid = voucher.estado === 'activo' && !isExpired

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-500">
        
        {/* Header de Estado */}
        <div className={`p-10 text-center ${isValid ? 'bg-success' : 'bg-gray-400'} text-white relative`}>
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          <div className="relative z-10 space-y-4">
            <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto backdrop-blur-md border border-white/30">
              {isValid ? <CheckCircle2 size={40} /> : <ShieldCheck size={40} />}
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase">
                {isValid ? 'Voucher Válido' : 'Certificado Inactivo'}
              </h1>
              <p className="text-xs font-bold opacity-80 uppercase tracking-[0.2em] mt-1">CTB Viajando Ecuador</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Código y Proforma */}
          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Código Único</p>
              <p className="text-lg font-black text-gray-900">{voucher.codigo}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Proforma</p>
              <p className="text-sm font-bold text-primary">{voucher.numero_proforma || 'N/A'}</p>
            </div>
          </div>

          {/* Información del Pasajero */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary h-fit"><Users size={20} /></div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pasajeros</p>
                <div className="space-y-1 mt-1">
                  {voucher.ventas?.cotizaciones?.nombres_pasajeros?.map((n, i) => (
                    <p key={i} className="text-sm font-bold text-gray-800 leading-tight">{n}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary h-fit"><MapPin size={20} /></div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Destino</p>
                <p className="text-sm font-black text-gray-800 mt-1">{voucher.destino}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary h-fit"><Calendar size={20} /></div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fechas de Viaje</p>
                <p className="text-sm font-black text-gray-800 mt-1">
                  {voucher.fecha_viaje_desde} al {voucher.fecha_viaje_hasta}
                </p>
              </div>
            </div>
          </div>

          {/* Sello de Autenticidad */}
          <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-success" size={16} />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Documento Verificado</span>
            </div>
            <img src="https://ctbviajando.com/wp-content/uploads/2023/06/cropped-ctb-logo-1.png" alt="CTB Logo" className="h-6 opacity-30 grayscale" />
          </div>
        </div>
      </div>
      
      <p className="fixed bottom-8 text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em]">
        ctbviajando.com · operativos
      </p>
    </div>
  )
}
