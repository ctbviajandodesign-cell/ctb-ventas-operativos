'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  LogOut,
  QrCode,
  DollarSign,
  ChevronRight,
  Star,
  Sparkles,
  Menu,
  X,
  Database
} from 'lucide-react'
import SalesModal from '@/components/SalesModal'
import AIFloatingChat from '@/components/AIFloatingChat'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  const [profile, setProfile] = useState(null)
  const [toast, setToast] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    let timer
    const handleToast = (e) => {
      const { message, type } = e.detail
      setToast({ message, type })
      
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setToast(null)
      }, 3000)
    }

    window.addEventListener('toast-notification', handleToast)
    return () => {
      window.removeEventListener('toast-notification', handleToast)
      if (timer) clearTimeout(timer)
    }
  }, [])

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('rol, nombre').eq('id', user.id).single()
      setProfile(data)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/cotizaciones', label: 'Cotizaciones', icon: FileText },
    { href: '/dashboard/ventas', label: 'Vendidas', icon: DollarSign },
    { href: '/dashboard/vouchers', label: 'Vouchers', icon: QrCode },
    { href: '/dashboard/logros', label: 'Mis Logros', icon: Star },
    { href: '/dashboard/analisis', label: 'IA Comercial', icon: Sparkles },
  ]

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen bg-[#F5F7FA] selection:bg-primary/20">
      <SalesModal />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 flex flex-col shadow-2xl transition-transform duration-300 md:relative md:w-64 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo and Close Button */}
        <div className="px-6 py-6 border-b border-gray-50 relative">
          <div className="flex items-center justify-center py-2">
            <Link href="/dashboard">
              <Image
                src="/logo.png"
                alt="CTB Viajando"
                width={140}
                height={50}
                className="object-contain hover:scale-105 transition-transform"
              />
            </Link>
          </div>
          
          <button 
            className="md:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-800 bg-gray-50 rounded-full"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={18} />
          </button>

          {profile?.nombre && (
            <div className="mt-4 bg-gray-50 rounded-2xl px-3 py-2 flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white text-xs font-black">
                {profile.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-black text-gray-800 leading-none">{profile.nombre.split(' ')[0]}</p>
                <p className="text-xs text-gray-400 uppercase tracking-widest mt-0.5">{profile.rol}</p>
              </div>
            </div>
          )}

        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-xs uppercase tracking-widest group relative ${
                  active
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Icon size={17} className={active ? 'text-white' : 'text-gray-300 group-hover:text-gray-500 transition-colors'} />
                {label}
                {active && <ChevronRight size={12} className="ml-auto text-white/60" />}
              </Link>
            )
          })}

          {(profile?.rol === 'admin' || profile?.rol === 'superadmin') && (
            <>
              <div className="pt-3 pb-1">
                <p className="text-xs font-black text-gray-300 uppercase tracking-[0.2em] px-4">Administración</p>
              </div>

              <Link
                href="/dashboard/reportes"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-xs uppercase tracking-widest group relative ${
                  isActive('/dashboard/reportes')
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Database size={17} className={isActive('/dashboard/reportes') ? 'text-white' : 'text-gray-300 group-hover:text-gray-500 transition-colors'} />
                Data & Reportes
                {isActive('/dashboard/reportes') && <ChevronRight size={12} className="ml-auto text-white/60" />}
              </Link>

              <Link
                href="/dashboard/usuarios"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-xs uppercase tracking-widest group relative ${
                  isActive('/dashboard/usuarios')
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Users size={17} className={isActive('/dashboard/usuarios') ? 'text-white' : 'text-gray-300 group-hover:text-gray-500 transition-colors'} />
                Equipo
                {isActive('/dashboard/usuarios') && <ChevronRight size={12} className="ml-auto text-white/60" />}
              </Link>

              <Link
                href="/dashboard/comerciales"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-xs uppercase tracking-widest group relative ${
                  isActive('/dashboard/comerciales')
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Users size={17} className={isActive('/dashboard/comerciales') ? 'text-white' : 'text-gray-300 group-hover:text-gray-500 transition-colors'} />
                Comerciales
                {isActive('/dashboard/comerciales') && <ChevronRight size={12} className="ml-auto text-white/60" />}
              </Link>

              {profile?.rol === 'superadmin' && (
                <Link
                  href="/dashboard/auditoria"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-xs uppercase tracking-widest group relative ${
                    isActive('/dashboard/auditoria')
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <FileText size={17} className={isActive('/dashboard/auditoria') ? 'text-white' : 'text-gray-300 group-hover:text-gray-500 transition-colors'} />
                  Auditoría
                  {isActive('/dashboard/auditoria') && <ChevronRight size={12} className="ml-auto text-white/60" />}
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-50">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-gray-300 hover:text-danger hover:bg-red-50 rounded-2xl transition-all font-black text-xs uppercase tracking-widest group"
          >
            <LogOut size={17} className="group-hover:scale-110 transition-transform" />
            <span>Salir</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto w-full">
        {/* Top bar */}
        <header className="h-14 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              className="md:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse hidden sm:block"></div>
            <h2 className="font-black text-gray-400 uppercase text-[10px] sm:text-xs tracking-[0.2em] truncate max-w-[140px] sm:max-w-none">
              CTB Intelligence · {profile?.nombre || 'Cargando...'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-success/10 px-3 py-1 rounded-full">
              <p className="text-xs font-black text-success uppercase tracking-widest">Sistema activo</p>
            </div>
          </div>
        </header>

        
        <div className="p-4 sm:p-8">
          {children}
        </div>
      </main>

      {toast && (
        <div 
          onClick={() => setToast(null)}
          className="fixed bottom-8 right-8 z-[9999] cursor-pointer animate-in fade-in slide-in-from-bottom-6 zoom-in-95 duration-300 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <div className={`flex items-center gap-3 px-6 py-4 rounded-[1.5rem] shadow-2xl border font-black text-xs uppercase tracking-widest text-white backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-gray-900/95 border-gray-800 text-green-400' 
              : 'bg-red-950/95 border-red-800 text-red-400'
           }`}>
            <span className="text-sm">{toast.type === 'success' ? '✓' : '⚠️'}</span>
            <span className="text-white">{toast.message}</span>
          </div>
        </div>
      )}
      <AIFloatingChat />
    </div>
  )
}
