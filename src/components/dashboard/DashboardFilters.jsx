'use client'

import Link from 'next/link'
import { 
  BarChart3, 
  Filter, 
  Users, 
  ChevronLeft, 
  Calendar, 
  ChevronRight, 
  Plus 
} from 'lucide-react'
import { format } from 'date-fns'

export default function DashboardFilters({
  isAdmin,
  selectedCity,
  setSelectedCity,
  selectedOperative,
  setSelectedOperative,
  operatives,
  selectedPeriod,
  setSelectedPeriod,
  handleNavigatePeriod,
  focusDate,
  setFocusDate,
  getPeriodLabel,
  profile,
  handleOpenOperativePanel
}) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary p-2 rounded-xl text-white">
            <BarChart3 size={20} />
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
            Control Center
          </h1>
        </div>
        <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.2em] ml-1">
          {isAdmin ? 'Panel de Control de Operaciones Globales' : 'Tu Resumen de Inteligencia Comercial'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
        {/* Card de Filtros de Negocio (solo para Admin/Superadmin) */}
        {isAdmin && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100/85 w-full sm:w-auto">
            {/* Ciudad Capsule */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/60 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-all flex-1 sm:flex-initial">
              <Filter size={14} className="text-primary shrink-0" />
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Ciudad:</span>
              <select 
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value)
                  setSelectedOperative('global')
                }}
                className="appearance-none bg-transparent border-none font-black text-xs text-gray-800 outline-none py-1 pr-8 pl-1 cursor-pointer focus:ring-0 w-full sm:w-auto bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
              >
                <option value="global">Todas las Ciudades</option>
                {['Quito', 'Guayaquil', 'Cuenca', 'Manta', 'Loja'].map(c => {
                  if (profile?.rol === 'auditor' && !profile?.ciudad.includes('Nacional') && !profile?.ciudad.includes(c)) return null
                  return <option key={c} value={c}>{c}</option>
                })}
              </select>
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" />

            {/* Operativo Capsule */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/60 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-all flex-1 sm:flex-initial">
              <Users size={14} className="text-primary shrink-0" />
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Operativo:</span>
              <select 
                value={selectedOperative}
                onChange={(e) => setSelectedOperative(e.target.value)}
                className="appearance-none bg-transparent border-none font-black text-xs text-gray-800 outline-none py-1 pr-8 pl-1 cursor-pointer focus:ring-0 w-full sm:w-auto max-w-full sm:max-w-[150px] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%230066CC%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_2px_center] bg-[size:16px_16px]"
              >
                <option value="global">Todos</option>
                {operatives
                  .filter(op => selectedCity === 'global' || op.ciudad === selectedCity)
                  .map(op => (
                    <option key={op.id} value={op.id}>{op.nombre}</option>
                  ))}
              </select>
            </div>
          </div>
        )}

        {/* Card de Calendario Inteligente */}
        <div className="flex items-center bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100/85 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-3 bg-gray-50/60 rounded-2xl border border-gray-100 p-1 flex-1 sm:flex-initial">
            {/* Selector de Modo */}
            <div className="flex bg-white/80 p-0.5 rounded-xl border border-gray-200/50 shadow-sm">
              {[
                { key: 'dia', label: 'Día' },
                { key: 'semana', label: 'Sem' },
                { key: 'mes', label: 'Mes' },
                { key: 'año', label: 'Año' }
              ].map(mode => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setSelectedPeriod(mode.key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    selectedPeriod === mode.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Navegador Temporal */}
            <div className="flex items-center gap-1.5 px-1 py-0.5 w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={() => handleNavigatePeriod(-1)}
                className="p-1 hover:bg-white active:scale-95 rounded-lg border border-gray-200/40 text-gray-400 hover:text-gray-700 transition-all shadow-sm shrink-0"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="relative flex items-center justify-center min-w-[125px] hover:text-primary transition-colors cursor-pointer group">
                <input
                  type="date"
                  value={format(focusDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    if (e.target.value) {
                      setFocusDate(new Date(e.target.value + 'T12:00:00'))
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest select-none flex items-center gap-1.5 group-hover:text-primary transition-colors">
                  <Calendar size={12} className="text-primary" />
                  {getPeriodLabel(selectedPeriod, focusDate)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleNavigatePeriod(1)}
                className="p-1 hover:bg-white active:scale-95 rounded-lg border border-gray-200/40 text-gray-400 hover:text-gray-700 transition-all shadow-sm shrink-0"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* QUICK ACTION — Mi Perfil (solo para operatives/no-admins) */}
        {!isAdmin && profile && (
          <button
            onClick={() => handleOpenOperativePanel(profile)}
            className="flex items-center justify-center gap-2 bg-white text-gray-800 border border-gray-200 px-6 py-3.5 rounded-[1.8rem] font-black text-sm uppercase tracking-tighter shadow-sm hover:bg-gray-50 active:scale-95 transition-all whitespace-nowrap"
          >
            <Users size={18} className="text-primary" /> Mi Perfil
          </button>
        )}

        {/* QUICK ACTION — Nueva Cotización */}
        <Link
          href="/dashboard/cotizaciones/nueva"
          className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3.5 rounded-[1.8rem] font-black text-sm uppercase tracking-tighter shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
        >
          <Plus size={18} /> Nueva Cotización
        </Link>
      </div>
    </div>
  )
}
