'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  UserPlus, 
  Mail, 
  Shield, 
  Target,
  ArrowLeft,
  Trash2,
  Edit
} from 'lucide-react'

export default function UsuariosPage() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'operativo',
    meta_mensual: 1000
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Crear en Auth (Requiere Service Role o invitar por correo)
      // Nota: En una app real de producción, usaríamos supabase.auth.admin
      // Aquí simulamos el flujo de creación de perfil para el Admin.
      
      alert('Para crear un usuario real, primero regístralo en la sección "Authentication > Users" de Supabase y luego asígnale su perfil aquí.')
      
      // El Admin puede insertar directamente en profiles si tiene el ID del usuario creado en Auth
      // const { error } = await supabase.from('profiles').insert([formData])
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestión de Operativos</h1>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={20} />
          Nuevo Operativo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(user => (
          <div key={user.id} className="card group hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-primary/10 p-3 rounded-xl text-primary">
                <Shield size={24} />
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.rol === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                {user.rol}
              </div>
            </div>
            
            <h3 className="font-bold text-lg text-gray-800">{user.nombre}</h3>
            <p className="text-xs text-gray-500 mb-6">{user.email}</p>

            <div className="space-y-4 border-t border-gray-50 pt-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-medium flex items-center gap-1">
                  <Target size={14} /> Meta Mensual:
                </span>
                <span className="font-bold text-gray-800">${user.meta_mensual?.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="flex-1 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100">Editar</button>
              <button className="p-2 bg-red-50 text-danger rounded-lg hover:bg-red-100">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-xl font-bold mb-6">Crear Nuevo Perfil</h2>
            <p className="text-sm text-gray-500 mb-6 bg-amber-50 p-4 rounded-xl border border-amber-100 italic">
              <strong>Nota:</strong> Como administrador, primero crea el correo en la sección de "Authentication" de tu panel de Supabase y luego asígnalo aquí con su meta.
            </p>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <input 
                placeholder="Nombre Completo" className="input" required
                onChange={e => setFormData({...formData, nombre: e.target.value})}
              />
              <input 
                placeholder="Correo Electrónico" className="input" type="email" required
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
              <input 
                placeholder="Meta Mensual ($)" className="input" type="number" required
                onChange={e => setFormData({...formData, meta_mensual: e.target.value})}
              />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 font-bold text-gray-400">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
