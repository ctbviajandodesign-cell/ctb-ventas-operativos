'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw, Copy, Check } from 'lucide-react'

export default function BloqueosErrorBoundary({ error, reset }) {
  const [copied, setCopied] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    console.error('Error en el módulo de Bloqueos:', error)
  }, [error])

  const handleCopy = () => {
    const errorText = `Error: ${error?.message || 'Error desconocido'}\nStack: ${error?.stack || 'N/A'}`
    navigator.clipboard?.writeText(errorText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 sm:p-10 bg-white rounded-3xl border border-gray-100 shadow-sm text-center max-w-2xl mx-auto my-8">
      <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5 border border-amber-100">
        <AlertTriangle size={32} />
      </div>

      <h2 className="text-xl font-black text-gray-900 mb-2">
        Hubo un inconveniente al cargar esta sección
      </h2>

      <p className="text-xs text-gray-500 max-w-md mb-6 leading-relaxed">
        {error?.message || 'Ocurrió una excepción al procesar los datos del bloqueo.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        <Link
          href="/dashboard/bloqueos"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/dashboard/bloqueos'
            }
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-black text-xs uppercase tracking-wider transition-all"
        >
          <ArrowLeft size={15} />
          Volver a Bloqueos
        </Link>

        <button
          onClick={() => {
            if (typeof reset === 'function') reset()
            else if (typeof window !== 'undefined') window.location.reload()
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gray-900 hover:bg-primary text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all"
        >
          <RefreshCw size={15} />
          Reintentar Carga
        </button>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-xs transition-all"
        >
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          <span>{copied ? 'Copiado' : 'Copiar Diagnóstico'}</span>
        </button>
      </div>

      {/* Collapsible Technical Details */}
      <div className="w-full text-left">
        <button
          type="button"
          onClick={() => setShowDetails(prev => !prev)}
          className="text-[11px] font-bold text-gray-400 hover:text-gray-600 underline mx-auto block"
        >
          {showDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos del error'}
        </button>

        {showDetails && (
          <div className="mt-3 p-4 bg-gray-50 rounded-2xl border border-gray-200 text-[10px] font-mono text-gray-700 overflow-x-auto max-h-48 whitespace-pre-wrap">
            <p className="font-bold text-red-600 mb-1">{error?.name}: {error?.message}</p>
            <p className="text-gray-500">{error?.stack}</p>
          </div>
        )}
      </div>
    </div>
  )
}
