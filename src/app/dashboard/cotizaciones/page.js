'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import QuotesTable from '@/components/QuotesTable'
import SalesModal from '@/components/SalesModal'
import { 
  FilePlus, 
  Search, 
  Filter,
  Download
} from 'lucide-react'

export default function ListadoCotizacionesPage() {
  const [quotes, setQuotes] = useState([])
  const [filteredQuotes, setFilteredQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profileData)

      const isAdmin = profileData.rol === 'admin'
      
      let query = supabase
        .from('cotizaciones')
        .select('*, profiles(nombre)')
        .order('created_at', { ascending: false })
      
      if (!isAdmin) {
        query = query.eq('operativo_id', user.id)
      }

      const { data } = await query
      setQuotes(data || [])
      setFilteredQuotes(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const filtered = quotes.filter(q => 
      q.agencia?.toLowerCase().includes(search.toLowerCase()) ||
      q.destino?.toLowerCase().includes(search.toLowerCase()) ||
      q.codigo?.toLowerCase().includes(search.toLowerCase())
    )
    setFilteredQuotes(filtered)
  }, [search, quotes])

  if (loading) return <div className="p-8 text-center text-gray-400 animate-pulse font-medium">Cargando todas las cotizaciones...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Listado de Cotizaciones</h1>
          <p className="text-gray-500 text-sm font-medium italic">Gestiona todas las proformas emitidas y su seguimiento.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/dashboard/cotizaciones/nueva" className="btn-primary flex items-center gap-2">
            <FilePlus size={18} />
            Nueva Proforma
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              className="input pl-10" 
              placeholder="Buscar por código, agencia o destino..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-100 transition-colors">
            <Filter size={18} /> Filtros
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-100 transition-colors">
            <Download size={18} /> Exportar
          </button>
        </div>

        <QuotesTable 
          quotes={filteredQuotes} 
          isAdmin={profile?.rol === 'admin'} 
          onUpdate={fetchData} 
        />
      </div>

      <SalesModal />
    </div>
  )
}
