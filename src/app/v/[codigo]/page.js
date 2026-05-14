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
import { format, isAfter, isBefore, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

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
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Consultando CTB Real-Time...</p>
      </div>
    </div>
  )

  if (!voucher) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
      <div className="space-y-6 max-w-sm">
        <div className="bg-red-50 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto text-red-500">
          <AlertCircle size={48} />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Certificado No Válido</h1>
        <p className="text-gray-500 text-sm">Este código no existe en nuestra base de datos oficial. Podría tratarse de un documento falsificado.</p>
      </div>
    </div>
  )

  const now = new Date()
  const expirationDate = voucher.fecha_caducidad ? parseISO(voucher.fecha_caducidad) : null
  const isExpired = expirationDate && isAfter(now, expirationDate)
  const isValid = voucher.estado === 'activo' && !isExpired

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-500">
        
        {/* Banner de Estado Real-Time */}
        <div className={`p-10 text-center ${isValid ? 'bg-success' : 'bg-danger'} text-white relative`}>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white,_transparent)]"></div>
          <div className="relative z-10 space-y-3">
            <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto backdrop-blur-md border border-white/30 shadow-inner">
              {isValid ? <CheckCircle2 size={44} /> : <AlertCircle size={44} />}
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">
                {isValid ? 'Voucher Válido' : 'Voucher Vencido'}
              </h1>
              <p className="text-[10px] font-black opacity-80 uppercase tracking-[0.3em] mt-2">Sistema de Verificación CTB</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Agencia y Valor (Datos Críticos) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Building2 size={10} /> Agencia Emisora
              </p>
              <p className="text-sm font-black text-gray-800 leading-tight">
                {voucher.agencia || 'CTB Directo'}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <DollarSign size={10} /> Valor Total
              </p>
              <p className="text-lg font-black text-primary">
                ${Number(voucher.valor_total || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Código del Voucher */}
          <div className="text-center py-2 border-y border-dashed border-gray-200">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Código de Seguridad</p>
            <p className="text-xl font-mono font-black text-gray-900">{voucher.codigo}</p>
          </div>

          {/* Información Detallada */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary h-fit"><Users size={18} /></div>
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Titulares del Viaje</p>
                <div className="mt-1">
                  {Array.isArray(voucher.pasajeros) ? voucher.pasajeros.map((n, i) => (
                    <p key={i} className="text-sm font-bold text-gray-800">{n}</p>
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
                <p className="text-sm font-bold text-gray-800 mt-0.5">{voucher.destino}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary h-fit"><Clock size={18} /></div>
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Válido Desde</p>
                  <p className="text-xs font-bold text-gray-800">
                    {voucher.fecha_viaje_desde ? format(parseISO(voucher.fecha_viaje_desde), 'dd MMM yyyy', { locale: es }) : 'No definida'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Válido Hasta</p>
                  <p className={`text-xs font-bold ${isExpired ? 'text-danger' : 'text-gray-800'}`}>
                    {voucher.fecha_caducidad ? format(parseISO(voucher.fecha_caducidad), 'dd MMM yyyy', { locale: es }) : 'No definida'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pie de Página de Seguridad */}
          <div className="pt-6 mt-4 border-t border-gray-100 flex items-center justify-between opacity-50 grayscale hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-success" size={14} />
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Validación Cifrada CTB</span>
            </div>
            <img src="https://ctbviajando.com/wp-content/uploads/2023/06/cropped-ctb-logo-1.png" alt="CTB Logo" className="h-4" />
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-[9px] font-black text-gray-300 uppercase tracking-[0.4em] animate-pulse">
        Consulta Segura Real-Time
      </p>
    </div>
  )
}
