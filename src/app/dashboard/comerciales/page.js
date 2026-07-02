'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  UserPlus, 
  ArrowLeft,
  Trash2,
  AlertCircle
} from 'lucide-react'
import { showToast } from '@/utils/toast'
import { useUserSession } from '@/hooks/useUserSession'

export default function ComercialesPage() {
  const router = useRouter()
  const { profile } = useUserSession()
  const isSuperAdmin = profile?.rol === 'superadmin'

  const [comerciales, setComerciales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formError, setFormError] = useState(null)
  const [editingComercial, setEditingComercial] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    ciudad: 'Nacional'
  })

  useEffect(() => {
    fetchComerciales()
  }, [])

  useEffect(() => {
    if (profile && profile.rol !== 'admin' && profile.rol !== 'superadmin') {
      showToast('Acceso restringido a administradores.', 'error')
      router.push('/dashboard')
    }
  }, [profile])

  async function fetchComerciales() {
    const { data } = await supabase.from('comerciales').select('*').order('created_at', { ascending: false })
    setComerciales(data || [])
    setLoading(false)
  }

  const handleSaveComercial = async (e) => {
    e.preventDefault()
    setLoading(true)
    setFormError(null)

    try {
      if (editingComercial) {
        const { error } = await supabase
          .from('comerciales')
          .update(formData)
          .eq('id', editingComercial.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('comerciales')
          .insert([formData])
        if (error) throw error
      }

      setShowModal(false)
      setFormData({
        nombre: '',
        ciudad: 'Nacional'
      })
      setEditingComercial(null)
      showToast(editingComercial ? '¡Comercial actualizado con éxito!' : '¡Comercial creado con éxito!')
      fetchComerciales()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteComercial = async (c) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${c.nombre}? Esta acción no se puede deshacer.`)) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('comerciales')
        .delete()
        .eq('id', c.id)

      if (error) throw error

      showToast('¡Comercial eliminado con éxito!')
      fetchComerciales()
    } catch (error) {
      showToast('Error al eliminar: ' + error.message, 'error')
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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestión de Comerciales</h1>
        </div>
        {(profile?.rol === 'admin' || profile?.rol === 'superadmin') && (
          <button 
            onClick={() => { 
              setEditingComercial(null);
              setFormData({
                nombre: '',
                ciudad: 'Nacional'
              });
              setShowModal(true); 
              setFormError(null); 
            }}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus size={20} />
            Nuevo Comercial
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {comerciales.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-gray-100">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No hay comerciales registrados</p>
          </div>
        ) : comerciales.map(c => (
          <div key={c.id} className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-50 group hover:border-primary transition-all duration-500">
            <div className="flex items-center justify-between mb-8">
              <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl shadow-gray-200">
                {c.nombre?.charAt(0) || '?'}
              </div>
              <div className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">
                COMERCIAL
              </div>
            </div>
            
            <h3 className="font-black text-xl text-gray-900 tracking-tight leading-none mb-2">{c.nombre}</h3>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {c.ciudad && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
                  {c.ciudad}
                </span>
              )}
            </div>

            {(profile?.rol === 'admin' || profile?.rol === 'superadmin') && (
              <div className="flex gap-3 mt-8 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                <button 
                  onClick={() => {
                    setEditingComercial(c);
                    setFormData({
                      nombre: c.nombre || '',
                      ciudad: c.ciudad || 'Nacional'
                    });
                    setShowModal(true);
                    setFormError(null);
                  }}
                  className="flex-1 py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-transform"
                >
                  Editar
                </button>

                <button 
                  onClick={() => handleDeleteComercial(c)}
                  className="w-12 h-12 bg-red-50 text-danger rounded-2xl flex items-center justify-center hover:bg-danger hover:text-white transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[4rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-primary p-10 text-white">
              <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{editingComercial ? 'Editar Comercial' : 'Alta de Comercial'}</h2>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest mt-2">{editingComercial ? 'Actualizar datos de comercial externo' : 'Registro de nuevo comercial externo'}</p>
            </div>
            
            <form onSubmit={handleSaveComercial} className="p-10 space-y-5">
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
                  value={formData.nombre || ''}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Ciudad</label>
                <select 
                  className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 font-black text-gray-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={formData.ciudad}
                  onChange={e => setFormData({...formData, ciudad: e.target.value})}
                >
                  <option value="Nacional">Nacional (Todo el país)</option>
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
                  {loading ? 'Procesando...' : (editingComercial ? 'Guardar' : 'Crear Comercial')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
