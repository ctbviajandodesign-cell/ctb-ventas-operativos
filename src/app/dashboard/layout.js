'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  LayoutDashboard, 
  FileText, 
  TrendingUp, 
  Users, 
  LogOut,
  QrCode,
  DollarSign
} from 'lucide-react'
import SalesModal from '@/components/SalesModal'

export default function DashboardLayout({ children }) {
  const router = useRouter()

  const [profile, setProfile] = useState(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      setProfile(data)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-background selection:bg-primary/20">
      {/* SalesModal Global */}
      <SalesModal />

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-black text-gray-900 tracking-tighter leading-none italic">CTB <span className="text-primary italic">V</span></h1>
          <p className="text-[9px] text-gray-400 font-black uppercase tracking-[0.3em] mt-2">Intelligence Systems</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-5 py-4 text-gray-400 hover:bg-gray-50 hover:text-primary rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-widest group">
            <LayoutDashboard size={18} className="group-hover:scale-110 transition-transform" />
            Dashboard
          </Link>
          <Link href="/dashboard/cotizaciones" className="flex items-center gap-3 px-5 py-4 text-gray-400 hover:bg-gray-50 hover:text-primary rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-widest group">
            <FileText size={18} className="group-hover:scale-110 transition-transform" />
            Proformas
          </Link>
          <Link href="/dashboard/ventas" className="flex items-center gap-3 px-5 py-4 text-gray-400 hover:bg-gray-50 hover:text-primary rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-widest group">
            <DollarSign size={18} className="group-hover:scale-110 transition-transform" />
            Ventas
          </Link>
          <Link href="/dashboard/vouchers" className="flex items-center gap-3 px-5 py-4 text-gray-400 hover:bg-gray-50 hover:text-primary rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-widest group">
            <QrCode size={18} className="group-hover:scale-110 transition-transform" />
            Vouchers
          </Link>
          {profile?.rol === 'admin' && (
            <Link href="/dashboard/usuarios" className="flex items-center gap-3 px-5 py-4 text-gray-400 hover:bg-gray-50 hover:text-primary rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-widest group border-t border-gray-50 mt-4 pt-4">
              <Users size={18} className="group-hover:scale-110 transition-transform" />
              Equipo
            </Link>
          )}
        </nav>

        <div className="p-6 border-t border-gray-50">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-5 py-4 w-full text-danger/40 hover:text-danger hover:bg-red-50 rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-widest"
          >
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="font-semibold text-gray-800 uppercase text-sm tracking-wider">Sistema de Gestión</h2>
        </header>
        
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
