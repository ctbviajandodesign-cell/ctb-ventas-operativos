'use client'

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* SalesModal Global - IMPORTANTE para que funcionen los botones de Aprobar/Venta */}
      <SalesModal />

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary tracking-tight">CTB VIAJANDO</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Ventas Operativas</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-all font-bold group">
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link href="/dashboard/cotizaciones" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-all font-bold group">
            <FileText size={20} />
            Cotizaciones
          </Link>
          <Link href="/dashboard/ventas" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-all font-bold group">
            <DollarSign size={20} />
            Ventas Cerradas
          </Link>
          <Link href="/dashboard/vouchers" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-all font-bold group">
            <QrCode size={20} />
            Archivo Vouchers
          </Link>
          <Link href="/dashboard/usuarios" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-all font-bold group">
            <Users size={20} />
            Equipo
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-50">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-danger hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
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
