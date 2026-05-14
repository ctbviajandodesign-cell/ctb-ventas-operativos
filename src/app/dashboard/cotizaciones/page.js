import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import QuotesTable from '@/components/QuotesTable'
import { Search, Plus, Filter, Download } from 'lucide-react'
import Link from 'next/link'

export default function CotizacionesPage() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    fetchQuotes()
  }, [])

  async function fetchQuotes() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(profileData)

    let query = supabase
      .from('cotizaciones')
      .select('*, profiles(nombre)')
      .order('created_at', { ascending: false })

    if (profileData?.rol !== 'admin') {
      query = query.eq('operativo_id', user.id)
    }

    const { data } = await query
    setQuotes(data || [])
    setLoading(false)
  }

  const filtered = quotes.filter(q => 
    q.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    q.agencia?.toLowerCase().includes(search.toLowerCase()) ||
    q.destino?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="p-8 text-center text-gray-400 font-medium animate-pulse">Cargando proformas...</div>

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Listado de Cotizaciones</h1>
          <p className="text-gray-500 text-sm font-medium italic underline decoration-primary/30">Gestiona todas las proformas emitidas y su seguimiento.</p>
        </div>
        
        <Link href="/dashboard/cotizaciones/nueva" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nueva Proforma
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input 
            className="input pl-10" 
            placeholder="Buscar por código, agencia o destino..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none py-2 px-4 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors">
            <Filter size={14} /> Filtros
          </button>
          <button className="flex-1 md:flex-none py-2 px-4 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors">
            <Download size={14} /> Exportar
          </button>
        </div>
      </div>

      <div className="card overflow-hidden border-t-4 border-t-primary">
        <QuotesTable 
          quotes={filtered} 
          isAdmin={profile?.rol === 'admin'} 
          onUpdate={fetchQuotes} 
        />
      </div>
    </div>
  )
}
// Force refresh v1.1
