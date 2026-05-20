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
  Edit,
  AlertCircle
} from 'lucide-react'

export default function UsuariosPage() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formError, setFormError] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'operativo',
    meta_mensual: 1000,
    ciudad: 'Quito'
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
    setFormError(null)

    try {
      const response = await fetch('/api/usuarios/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.error) throw new Error(result.error)

      // Cerrar modal y limpiar formulario automáticamente en caso de éxito
      setShowModal(false)
      setFormData({
        nombre: '',
        email: '',
        password: '',
        rol: 'operativo',
        meta_mensual: 1000,
        ciudad: 'Quito'
      })
      fetchUsers()
    } catch (error) {
      setFormError(error.message)
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
          onClick={() => { setShowModal(true); setFormError(null); }}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={20} />
          Nuevo Operativo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-gray-100">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No hay operativos registrados</p>
          </div>
        ) : users.map(user => (
          <div key={user.id} className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 group hover:border-primary transition-all duration-500">
            <div className="flex items-center justify-between mb-8">
              <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl shadow-gray-200">
                {user.nombre?.charAt(0) || '?'}
              </div>
              <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${user.rol === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                {user.rol}
              </div>
            </div>
            
            <h3 className="font-black text-xl text-gray-900 tracking-tight leading-none mb-2">{user.nombre}</h3>
            <div className="flex items-center gap-2 mb-8 flex-wrap">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{user.email}</p>
              {user.ciudad && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
                  {user.ciudad}
                </span>
              )}
            </div>

            <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 group-hover:bg-white transition-colors">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Target size={16} className="text-primary" /> Meta Mensual
                </span>
                <span className="font-black text-gray-900 text-lg">${(Number(user.meta_mensual) || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-8 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
              <button className="flex-1 py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-transform">Editar</button>

              <button className="w-12 h-12 bg-red-50 text-danger rounded-2xl flex items-center justify-center hover:bg-danger hover:text-white transition-all">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[4rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-primary p-10 text-white">
              <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Alta de Operativo</h2>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest mt-2">Provisionamiento de nuevo perfil BI</p>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-10 space-y-5">
              {formError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100 flex items-start gap-2 animate-in fade-in duration-200">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                <input 
                  required className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Email Profesional</label>
                <input 
                  type="email" required className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="password" required className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Meta ($)</label>
                  <input 
                    type="number" required className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                    onChange={e => setFormData({...formData, meta_mensual: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Ciudad</label>
                <select 
                  className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={formData.ciudad}
                  onChange={e => setFormData({...formData, ciudad: e.target.value})}
                >
                  <option value="Quito">Quito</option>
                  <option value="Guayaquil">Guayaquil</option>
                  <option value="Cuenca">Cuenca</option>
                  <option value="Manta">Manta</option>
                  <option value="Loja">Loja</option>
                </select>
              </div>
              <div className="flex gap-4 pt-8">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 font-black text-gray-400 text-xs uppercase tracking-widest hover:text-gray-600 transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-white py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-[1.02] transition-all">
                  {loading ? 'Creando...' : 'Crear Operativo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
