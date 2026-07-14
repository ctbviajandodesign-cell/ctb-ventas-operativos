'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  UserPlus, 
  ArrowLeft,
  Trash2,
  Edit,
  AlertCircle,
  Phone,
  BarChart2,
  Search,
  Filter,
  Target
} from 'lucide-react'
import { showToast } from '@/utils/toast'
import { useUserSession } from '@/hooks/useUserSession'

export default function UsuariosPage() {
  const router = useRouter()
  const { profile } = useUserSession()
  const isSuperAdmin = profile?.rol === 'superadmin'
  const isAuditor = profile?.rol === 'auditor'

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formError, setFormError] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'operativo',
    meta_mensual: 1000,
    ciudad: 'Quito',
    celular: ''
  })

  // Nuevos estados para los filtros UI
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCiudad, setFilterCiudad] = useState('todas')
  const [filterRol, setFilterRol] = useState('todos')

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (profile && profile.rol !== 'admin' && profile.rol !== 'superadmin' && profile.rol !== 'auditor') {
      showToast('Acceso restringido a administradores y auditores.', 'error')
      router.push('/dashboard')
    }
  }, [profile])

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
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const endpoint = editingUser ? '/api/usuarios/editar' : '/api/usuarios/crear'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingUser ? { ...formData, id: editingUser.id } : formData)
      })

      const result = await response.json()

      if (result.error) throw new Error(result.error)

      setShowModal(false)
      setFormData({
        nombre: '',
        email: '',
        password: '',
        rol: 'operativo',
        meta_mensual: 1000,
        ciudad: 'Quito',
        celular: ''
      })
      setEditingUser(null)
      showToast(editingUser ? '¡Operativo actualizado con éxito!' : '¡Operativo creado con éxito!')
      fetchUsers()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (user) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${user.nombre}? Esta acción no se puede deshacer.`)) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch('/api/usuarios/eliminar', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: user.id })
      })

      const result = await response.json()
      if (result.error) throw new Error(result.error)

      showToast('¡Usuario eliminado con éxito!')
      fetchUsers()
    } catch (error) {
      showToast('Error al eliminar: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Filtrado reactivo de usuarios
  const filteredUsers = users.filter(user => {
    if (isAuditor) {
      // Si el auditor no tiene esas ciudades en su campo ciudad, no ver.
      const auditorCities = (profile?.ciudad || '').split(',').map(c => c.trim())
      if (!auditorCities.includes(user.ciudad) && profile?.ciudad !== 'Nacional') {
        return false
      }
    }
    const matchesSearch = (user.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCiudad = filterCiudad === 'todas' || user.ciudad === filterCiudad
    const matchesRol = filterRol === 'todos' || user.rol === filterRol
    return matchesSearch && matchesCiudad && matchesRol
  })

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 bg-white shadow-sm border border-gray-100 hover:bg-gray-50 rounded-full transition-colors shrink-0">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none">Equipo</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Gestión y Rendimiento del Personal</p>
          </div>
        </div>
        {isSuperAdmin && (
          <button 
            onClick={() => { 
              setEditingUser(null);
              setFormData({
                nombre: '',
                email: '',
                password: '',
                rol: 'operativo',
                meta_mensual: 1000,
                ciudad: 'Quito',
                celular: ''
              });
              setShowModal(true); 
              setFormError(null); 
            }}
            className="bg-gray-900 hover:bg-success text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={16} />
            Nuevo Usuario
          </button>
        )}
      </div>

      {/* Barra Inteligente de Filtros */}
      <div className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        {/* Buscador */}
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..." 
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-black text-gray-800 placeholder:text-gray-400 placeholder:font-normal focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Filtro Ciudad */}
        <div className="w-full md:w-48 relative flex items-center gap-2 bg-gray-50 rounded-2xl px-4 hover:bg-gray-100/50 transition-colors shrink-0">
          <Filter size={16} className="text-primary shrink-0" />
          <select
            className="w-full py-3 appearance-none bg-transparent border-none text-[11px] font-black text-gray-600 outline-none focus:ring-0 cursor-pointer uppercase tracking-widest"
            value={filterCiudad}
            onChange={(e) => setFilterCiudad(e.target.value)}
          >
            <option value="todas">Todas las Sedes</option>
            <option value="Quito">Quito</option>
            <option value="Guayaquil">Guayaquil</option>
            <option value="Cuenca">Cuenca</option>
            <option value="Manta">Manta</option>
            <option value="Loja">Loja</option>
            <option value="Nacional">Nacional</option>
          </select>
        </div>

        {/* Filtro Rol */}
        <div className="w-full md:w-48 relative flex items-center gap-2 bg-gray-50 rounded-2xl px-4 hover:bg-gray-100/50 transition-colors shrink-0">
          <Filter size={16} className="text-primary shrink-0" />
          <select
            className="w-full py-3 appearance-none bg-transparent border-none text-[11px] font-black text-gray-600 outline-none focus:ring-0 cursor-pointer uppercase tracking-widest"
            value={filterRol}
            onChange={(e) => setFilterRol(e.target.value)}
          >
            <option value="todos">Todos los Roles</option>
            <option value="operativo">Operativos</option>
            <option value="comercial">Comerciales</option>
            <option value="admin">Admins</option>
            <option value="superadmin">Super Admins</option>
          </select>
        </div>
      </div>

      {/* Lista Horizontal de Usuarios */}
      <div className="space-y-4">
        {loading && users.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-xs font-black uppercase tracking-widest flex flex-col items-center gap-4">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            Cargando Equipo...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[3rem] border border-gray-100 shadow-sm">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No se encontraron usuarios con esos filtros.</p>
          </div>
        ) : filteredUsers.map(user => (
          <div key={user.id} className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-gray-100 hover:border-primary/40 hover:shadow-lg transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 group">
            
            {/* Col 1: Avatar & Info */}
            <div className="flex items-center gap-4 md:w-1/4 shrink-0">
              <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md shrink-0 transition-transform group-hover:scale-110">
                {user.nombre?.charAt(0) || '?'}
              </div>
              <div className="truncate">
                <h3 className="font-black text-base md:text-lg text-gray-900 tracking-tight leading-none mb-1 truncate" title={user.nombre}>{user.nombre}</h3>
                <p className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-widest truncate" title={user.email}>{user.email}</p>
              </div>
            </div>

            {/* Col 2: Labels (Rol / Ciudad) */}
            <div className="flex items-center gap-2 flex-wrap md:w-1/5 shrink-0">
              <div className={`px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border ${
                user.rol === 'superadmin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                user.rol === 'admin' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                user.rol === 'auditor' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                user.rol === 'comercial' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                'bg-blue-50 text-blue-600 border-blue-200'
              }`}>
                {user.rol}
              </div>
              {user.ciudad && (
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-gray-50 text-gray-500 px-3 py-1 rounded-full border border-gray-200">
                  {user.ciudad}
                </span>
              )}
            </div>

            {/* Col 3: Contact & Meta */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 md:w-1/4 shrink-0">
              {user.celular && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <Phone size={12} className="text-primary" />
                  <span>{user.celular}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs font-black text-gray-900 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
                <Target size={14} className="text-primary" />
                <span>${(Number(user.meta_mensual) || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Col 4: Actions */}
            <div className="flex items-center gap-2 w-full md:w-auto pt-4 md:pt-0 border-t md:border-none border-gray-100 mt-2 md:mt-0 justify-end flex-1">
              <button 
                onClick={() => router.push(`/dashboard/usuarios/${user.id}`)}
                className="flex-1 md:flex-none px-5 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <BarChart2 size={14} /> Perfil
              </button>
              
              {isSuperAdmin && (
                <>
                  <button 
                    onClick={() => {
                      setEditingUser(user);
                      setFormData({
                        nombre: user.nombre || '',
                        email: user.email || '',
                        password: '',
                        rol: user.rol || 'operativo',
                        meta_mensual: user.meta_mensual || 1000,
                        ciudad: user.ciudad || 'Quito',
                        celular: user.celular || ''
                      });
                      setShowModal(true);
                      setFormError(null);
                    }}
                    className="w-10 h-10 bg-gray-50 text-gray-600 border border-gray-200 rounded-xl flex items-center justify-center hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all shrink-0"
                    title="Editar"
                  >
                    <Edit size={14} />
                  </button>

                  <button 
                    onClick={() => handleDeleteUser(user)}
                    className="w-10 h-10 bg-red-50 text-red-500 border border-red-100 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shrink-0"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* Modal Alta / Edición (Mantenemos diseño de modal anterior intacto) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl scale-in-center">
            <div className="bg-gray-900 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
              <h2 className="text-2xl font-black uppercase tracking-tighter leading-none relative z-10">{editingUser ? 'Editar Usuario' : 'Alta de Usuario'}</h2>
              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-2 relative z-10">{editingUser ? 'Actualizar datos corporativos' : 'Provisionamiento de cuenta'}</p>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-8 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[11px] font-bold border border-red-100 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                <input 
                  required className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                  value={formData.nombre || ''}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Profesional</label>
                <input 
                  type="email" required className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                  value={formData.email || ''}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Celular / WhatsApp</label>
                <input 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:font-normal placeholder:text-gray-300" 
                  placeholder="Ej: 0999999999"
                  value={formData.celular || ''}
                  onChange={e => setFormData({...formData, celular: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{editingUser ? 'Password (Opcional)' : 'Password'}</label>
                  <input 
                    type="password" 
                    required={!editingUser} 
                    placeholder={editingUser ? '••••••' : ''}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-gray-300" 
                    value={formData.password || ''}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Meta ($)</label>
                  <input 
                    type="number" required className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                    value={formData.meta_mensual || ''}
                    onChange={e => setFormData({...formData, meta_mensual: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rol</label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={formData.rol}
                    onChange={e => setFormData({...formData, rol: e.target.value})}
                  >
                    <option value="operativo">Operativo</option>
                    <option value="comercial">Comercial</option>
                    <option value="auditor">Auditor (Sedes Múltiples)</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    {formData.rol === 'auditor' ? 'Sedes a auditar' : 'Ciudad Base'}
                  </label>
                  
                  {formData.rol === 'auditor' ? (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-wrap gap-2">
                      {['Quito', 'Guayaquil', 'Cuenca', 'Manta', 'Loja'].map(c => {
                        const isSelected = formData.ciudad.includes(c)
                        return (
                          <label key={c} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer border transition-colors ${isSelected ? 'bg-primary text-white border-primary' : 'bg-white text-gray-400 border-gray-200 hover:border-primary/50'}`}>
                            <input 
                              type="checkbox" 
                              className="hidden"
                              checked={isSelected}
                              onChange={(e) => {
                                let current = formData.ciudad ? formData.ciudad.split(',').map(s => s.trim()).filter(Boolean) : []
                                if (current.includes('Nacional')) current = [] // reset si venía de un solo valor Nacional
                                if (e.target.checked) {
                                  current.push(c)
                                } else {
                                  current = current.filter(city => city !== c)
                                }
                                setFormData({...formData, ciudad: current.join(',')})
                              }}
                            />
                            {c}
                          </label>
                        )
                      })}
                      <label className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer border transition-colors ${formData.ciudad.includes('Nacional') ? 'bg-primary text-white border-primary' : 'bg-white text-gray-400 border-gray-200 hover:border-primary/50'}`}>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={formData.ciudad.includes('Nacional')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({...formData, ciudad: 'Nacional'})
                            } else {
                              setFormData({...formData, ciudad: ''})
                            }
                          }}
                        />
                        NACIONAL (Todas)
                      </label>
                    </div>
                  ) : (
                    <select 
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={formData.ciudad.includes(',') ? 'Quito' : formData.ciudad}
                      onChange={e => setFormData({...formData, ciudad: e.target.value})}
                    >
                      <option value="Nacional">Nacional</option>
                      <option value="Quito">Quito</option>
                      <option value="Guayaquil">Guayaquil</option>
                      <option value="Cuenca">Cuenca</option>
                      <option value="Manta">Manta</option>
                      <option value="Loja">Loja</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-50">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 font-black text-gray-400 bg-gray-50 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-gray-100 hover:text-gray-600 transition-all">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 bg-gray-900 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-gray-900/20 hover:scale-[1.02] transition-all">
                  {loading ? 'Procesando...' : (editingUser ? 'Guardar' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
