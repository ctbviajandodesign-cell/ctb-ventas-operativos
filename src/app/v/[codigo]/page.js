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
  Clock
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
      <div className="space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Verificando en CTB Cloud...</p>
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
        <p className="text-gray-500 text-sm">Este código no coincide con ningún registro oficial. Por favor contacte con soporte técnico.</p>
      </div>
    </div>
  )

  const isExpired = voucher.fecha_caducidad && new Date(voucher.fecha_caducidad) < new Date()
  const isValid = voucher.estado === 'activo' && !isExpired

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-500">
        
        {/* Banner de Estado */}
        <div className={`p-10 text-center ${isValid ? 'bg-success' : 'bg-danger'} text-white relative`}>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white,_transparent)]"></div>
          <div className="relative z-10 space-y-3">
            <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto backdrop-blur-md border border-white/30">
              {isValid ? <CheckCircle2 size={44} /> : <AlertCircle size={44} />}
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">
                {isValid ? 'Voucher Válido' : 'Voucher Vencido'}
              </h1>
              <p className="text-[10px] font-black opacity-80 uppercase tracking-[0.3em] mt-2">CTB Viajando Real-Time</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Building2 size={10} /> Agencia
              </p>
              <p className="text-sm font-black text-gray-800 leading-tight truncate">
                {voucher.agencia || 'CTB Directo'}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <DollarSign size={10} /> Valor Total
              </p>
              <p className="text-lg font-black text-primary leading-none">
                ${Number(voucher.valor_total || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="text-center py-2 border-y border-dashed border-gray-200">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Código</p>
            <p className="text-xl font-mono font-black text-gray-900 leading-none">{voucher.codigo}</p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary h-fit"><Users size={18} /></div>
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pasajeros</p>
                <div className="mt-1 space-y-0.5">
                  {Array.isArray(voucher.pasajeros) ? voucher.pasajeros.map((n, i) => (
                    <p key={i} className="text-sm font-bold text-gray-800 leading-tight">{n}</p>
                  )) : (
                    <p className="text-sm font-bold text-gray-400 italic">No especificados</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary h-fit"><MapPin size={18} /></div>
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Destino</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5 leading-tight">{voucher.destino || 'Sin destino'}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary h-fit"><Clock size={18} /></div>
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Desde</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5">
                    {formatSimpleDate(voucher.fecha_viaje_desde)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Hasta</p>
                  <p className={`text-xs font-bold mt-0.5 ${isExpired ? 'text-danger' : 'text-gray-800'}`}>
                    {formatSimpleDate(voucher.fecha_caducidad)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-gray-100 flex items-center justify-between opacity-50 grayscale">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-success" size={14} />
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Verificación Cifrada</span>
            </div>
            <img src="https://ctbviajando.com/wp-content/uploads/2023/06/cropped-ctb-logo-1.png" alt="CTB Logo" className="h-4" />
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-[9px] font-black text-gray-300 uppercase tracking-[0.4em] text-center">
        CTB Viajando · Certificado Seguro
      </p>
    </div>
  )
}
