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
  PlusCircle,
  QrCode
} from 'lucide-react'

export default function DashboardLayout({ children }) {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Cotizaciones', icon: FileText, path: '/dashboard/cotizaciones' },
    { name: 'Ventas', icon: TrendingUp, path: '/dashboard/ventas' },
    { name: 'Vouchers', icon: QrCode, path: '/dashboard/vouchers' },
  ]

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary tracking-tight">CTB VIAJANDO</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Ventas Operativas</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => (
            <Link 
              key={item.name} 
              href={item.path}
              className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-all group"
            >
              <item.icon size={20} className="group-hover:scale-110 transition-transform" />
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
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
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard/cotizaciones/nueva"
              className="btn-primary flex items-center gap-2 text-sm py-2"
            >
              <PlusCircle size={18} />
              Nueva Cotización
            </Link>
          </div>
        </header>
        
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
