'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LogIn } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Credenciales inválidas. Por favor intenta de nuevo.')
      setLoading(false)
    } else {
      // Redirección manejada por middleware o estado de auth
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src="/logo.png" 
            alt="Logo CTB Viajando" 
            className="h-24 w-auto mb-4 object-contain filter drop-shadow-[0_4px_12px_rgba(245,166,35,0.15)]"
          />
          <h1 className="text-gray-900 text-xs font-black uppercase tracking-widest mt-4">
            Sistema Comercial y Logística
          </h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Correo Electrónico</label>
            <input 
              type="email" 
              className="input" 
              placeholder="admin@ctbviajando.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Contraseña</label>
            <input 
              type="password" 
              className="input" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="text-danger text-sm font-medium bg-red-50 p-2 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? 'Entrando...' : (
              <>
                <LogIn size={20} />
                Iniciar Sesión
              </>
            )}
          </button>
        </form>
        
        <p className="mt-8 text-center text-xs text-gray-400">
          © 2026 CTB Viajando · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
