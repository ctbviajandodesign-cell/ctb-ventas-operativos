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
  Star
} from 'lucide-react'
import SalesModal from '@/components/SalesModal'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  const [profile, setProfile] = useState(null)

  useEffect(() => {
    fetchProfile()
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
    { href: '/dashboard/ventas', label: 'Proformas', icon: DollarSign },
    { href: '/dashboard/vouchers', label: 'Vouchers', icon: QrCode },
    { href: '/dashboard/logros', label: 'Mis Logros', icon: Star },
  ]

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen bg-[#F5F7FA] selection:bg-primary/20">
      <SalesModal />

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col shadow-sm">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/5 border border-primary/10 overflow-hidden flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="CTB Viajando"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900 tracking-tighter leading-none">CTB Viajando</p>
              <p className="text-xs text-primary font-black uppercase tracking-[0.2em] mt-0.5">
                {profile?.rol === 'admin' ? 'Control Center' : 'Mi Panel'}
              </p>
            </div>
          </div>
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

          {profile?.rol === 'admin' && (
            <>
              <div className="pt-3 pb-1">
                <p className="text-xs font-black text-gray-300 uppercase tracking-[0.2em] px-4">Administración</p>
              </div>

              <Link
                href="/dashboard/usuarios"
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
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="h-14 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></div>
            <h2 className="font-black text-gray-400 uppercase text-xs tracking-[0.2em]">
              CTB Intelligence · {profile?.nombre || 'Cargando...'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-success/10 px-3 py-1 rounded-full">
              <p className="text-xs font-black text-success uppercase tracking-widest">Sistema activo</p>
            </div>
          </div>
        </header>

        
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
