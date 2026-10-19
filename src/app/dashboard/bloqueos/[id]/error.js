'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function BloqueoDetalleErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error('Error al cargar la lista de pasajeros del bloqueo:', error)
  }, [error])

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
        <AlertTriangle size={28} />
      </div>
      <h2 className="text-lg font-black text-gray-900 mb-1">
        Ocurrió un problema al cargar los pasajeros
      </h2>
      <p className="text-xs text-gray-500 max-w-md mb-6 leading-relaxed">
        {error?.message || 'Error de procesamiento en la vista de pasajeros.'}
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/bloqueos"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase tracking-wider transition-all"
        >
          <ArrowLeft size={15} />
          Volver a Bloqueos
        </Link>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gray-900 hover:bg-primary text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all"
        >
          <RefreshCw size={15} />
          Reintentar
        </button>
      </div>
    </div>
  )
}
