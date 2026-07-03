'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, FileText, Ticket, User, X, ChevronRight, Loader2 } from 'lucide-react'

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ quotes: [], vouchers: [] })
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2) {
        performSearch()
      } else {
        setResults({ quotes: [], vouchers: [] })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  async function performSearch() {
    setLoading(true)
    setShowResults(true)
    try {
      // Búsqueda en Cotizaciones
      // Búsqueda en Cotizaciones
      const { data: qData } = await supabase
        .from('cotizaciones')
        .select('id, codigo, agencia, destino, nombres_pasajeros, comercial')
        .or(`codigo.ilike.%${query}%,agencia.ilike.%${query}%,destino.ilike.%${query}%,comercial.ilike.%${query}%`)
        .limit(5)

      // Búsqueda en Vouchers
      const { data: vData } = await supabase
        .from('vouchers')
        .select('id, codigo, agencia, destino, pasajeros')
        .or(`codigo.ilike.%${query}%,agencia.ilike.%${query}%,destino.ilike.%${query}%`)
        .limit(5)

      setResults({ quotes: qData || [], vouchers: vData || [] })
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative w-full max-w-full">
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </div>
        <input
          type="text"
          className="w-full bg-white border border-gray-100 rounded-[2rem] py-4 pl-14 pr-6 font-black text-sm text-gray-800 placeholder-gray-300 shadow-xl shadow-gray-100/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          placeholder="Busca por Código, Pasajero, Agencia o Destino..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
        />
        {query && (
          <button 
            onClick={() => {setQuery(''); setShowResults(false)}} 
            className="absolute inset-y-0 right-5 flex items-center text-gray-300 hover:text-gray-500"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {showResults && (query.length > 2) && (
        <div className="absolute top-full left-0 right-0 mt-4 bg-white rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.15)] border border-gray-50 overflow-hidden z-[100] animate-in slide-in-from-top-4 duration-300">
          
          <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center px-8">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Resultados de Búsqueda</span>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">{results.quotes.length + results.vouchers.length} hallados</span>
          </div>


          <div className="max-h-[400px] overflow-y-auto">
            {/* SECCIÓN COTIZACIONES */}
            {results.quotes.length > 0 && (
              <div className="p-4 border-b border-gray-50 last:border-0">
                <h4 className="px-4 text-xs font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FileText size={14} /> Cotizaciones / Vendidas
                </h4>
                <div className="space-y-1">
                  {results.quotes.map(q => (
                    <a 
                      key={q.id} 
                      href={`/dashboard/cotizaciones/editar/${q.id}`}
                      className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-2.5 rounded-xl text-primary font-mono text-xs font-black">{q.codigo}</div>
                        <div>
                          <p className="text-sm font-black text-gray-800 leading-none mb-1 uppercase italic">{q.agencia || 'Directo'}</p>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{q.destino} {q.comercial ? `· Comercial: ${q.comercial}` : ''}</p>
                        </div>
                      </div>

                      <ChevronRight size={16} className="text-gray-200 group-hover:text-primary transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* SECCIÓN VOUCHERS */}
            {results.vouchers.length > 0 && (
              <div className="p-4">
                <h4 className="px-4 text-xs font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Ticket size={14} /> Vouchers Activos
                </h4>
                <div className="space-y-1">
                  {results.vouchers.map(v => (
                    <a 
                      key={v.id} 
                      href={`/v/${v.codigo}`}
                      target="_blank"
                      className="flex items-center justify-between p-4 rounded-2xl hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-success/10 p-2.5 rounded-xl text-success font-mono text-xs font-black">{v.codigo}</div>
                        <div>
                          <p className="text-sm font-black text-gray-800 leading-none mb-1 uppercase italic">{v.pasajeros?.[0] || 'Pasajero'}</p>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{v.destino}</p>
                        </div>
                      </div>

                      <ChevronRight size={16} className="text-gray-200 group-hover:text-success transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {results.quotes.length === 0 && results.vouchers.length === 0 && !loading && (
              <div className="p-12 text-center text-gray-400">
                <Search size={32} className="mx-auto mb-4 opacity-10" />
                <p className="text-xs font-bold uppercase tracking-widest">No se encontraron coincidencias</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
