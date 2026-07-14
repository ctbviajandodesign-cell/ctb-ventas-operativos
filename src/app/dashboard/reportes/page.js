'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import { Download, Calendar, Filter, Users, Database, FileSpreadsheet, AlertCircle, Plane } from 'lucide-react'
import { showToast } from '@/utils/toast'
import { saveAs } from 'file-saver'

export default function ReportesPage() {
  const { user, profile, isAdmin, loading: sessionLoading } = useUserSession()
  const [loading, setLoading] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [operatives, setOperatives] = useState([])
  
  // Filters
  const [dateFilter, setDateFilter] = useState('mes')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedCity, setSelectedCity] = useState('todas')
  const [selectedOperative, setSelectedOperative] = useState('todas')
  const [selectedDestino, setSelectedDestino] = useState('')

  const isAuditor = profile?.rol === 'auditor'
  const isPrivileged = isAdmin || isAuditor
  
  useEffect(() => {
    if (isPrivileged) {
      supabase.from('profiles').select('id, nombre, ciudad').in('rol', ['operativo', 'comercial', 'auditor']).then(({ data }) => {
        setOperatives(data || [])
      })
    }
  }, [isPrivileged])

  const handleGenerateReport = async () => {
    if (!isPrivileged) {
      showToast('No tienes permisos para esta acción.', 'error')
      return
    }

    setLoading(true)
    setProgressText('Enviando petición al servidor en la nube...')
    
    try {
      // 1. Rango de Fechas
      const now = new Date()
      const ecTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Guayaquil" }))
      let startDate = null
      let endDate = null

      if (dateFilter === 'hoy') {
        startDate = new Date(ecTime)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(ecTime)
        endDate.setHours(23, 59, 59, 999)
      } else if (dateFilter === 'semana') {
        startDate = new Date(ecTime)
        startDate.setDate(startDate.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
      } else if (dateFilter === 'mes') {
        startDate = new Date(ecTime.getFullYear(), ecTime.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
      } else if (dateFilter === 'año') {
        startDate = new Date(ecTime.getFullYear(), 0, 1)
        startDate.setHours(0, 0, 0, 0)
      } else if (dateFilter === 'especifica' && customStartDate) {
        startDate = new Date(customStartDate + 'T00:00:00')
        endDate = new Date(customStartDate + 'T23:59:59')
      } else if (dateFilter === 'rango' && (customStartDate || customEndDate)) {
        if (customStartDate) startDate = new Date(customStartDate + 'T00:00:00')
        if (customEndDate) endDate = new Date(customEndDate + 'T23:59:59')
      }

      let dateFilterText = dateFilter.toUpperCase()
      if (dateFilter === 'rango') {
        dateFilterText = `RANGO: ${customStartDate || 'Inicio'} al ${customEndDate || 'Fin'}`
      } else if (dateFilter === 'especifica') {
        dateFilterText = `FECHA: ${customStartDate}`
      }

      let operativeName = 'Todos'
      if (selectedOperative !== 'todas') {
        const op = operatives.find(o => o.id === selectedOperative)
        if (op) operativeName = op.nombre.replace(/\s+/g, '_')
      }

      setProgressText('Generando el Excel en los servidores de Vercel (puede tomar unos segundos)...')

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch('/api/export-master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate ? endDate.toISOString() : null,
          selectedOperative,
          selectedCity,
          selectedDestino,
          dateFilterText,
          operativeName
        })
      })

      if (!response.ok) {
        if (response.status === 404) {
          showToast('No se encontraron registros en el período y filtros seleccionados.', 'error')
        } else {
          showToast(`Error del servidor: ${response.status}`, 'error')
        }
        return
      }

      setProgressText('¡Archivo listo! Descargando...')

      const blob = await response.blob()
      saveAs(blob, `DataLake_CTB_${operativeName}_${new Date().toISOString().split('T')[0]}.xlsx`)
      
      showToast('Reporte Inteligente generado y descargado con éxito.')
    } catch (err) {
      console.error(err)
      showToast('Error de conexión al generar el reporte.', 'error')
    } finally {
      setLoading(false)
      setProgressText('')
    }
  }

  if (sessionLoading) {
    return <div className="p-20 text-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div></div>
  }

  if (!isPrivileged) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h3 className="text-xl font-black text-gray-800 mb-2 uppercase">Acceso Restringido</h3>
        <p className="text-gray-500 mb-6">Solo los administradores o auditores pueden generar el Reporte Maestro.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-success/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-success uppercase tracking-[0.2em] bg-success/10 px-3 py-1 rounded-full flex items-center gap-1">
              <Database size={12} /> Data Lake B2B
            </span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            Reportes Inteligentes (Excel)
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-2xl leading-relaxed">
            Genera un archivo <strong>Microsoft Excel (.xlsx)</strong> de alta calidad. Incluye una pestaña de <strong>Dashboard</strong> con rankings contables, y una pestaña de <strong>Data Maestra</strong> con filtros (flechitas) para cruzar agencias, estados, destinos y sacar subtotales automáticos.
          </p>
        </div>
        <div className="hidden md:block">
          <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-success/40 border border-gray-100 shadow-inner">
            <FileSpreadsheet size={40} />
          </div>
        </div>
      </div>

      {/* Configuración del Reporte */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2 mb-8">
          <Filter className="text-primary" size={20} />
          Configurar Exportación Inteligente
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Rango de Fechas */}
          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Período de Creación</label>
            <div className="relative flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 hover:bg-gray-100/50 transition-colors">
              <Calendar size={18} className="text-primary shrink-0" />
              <select
                className="w-full appearance-none bg-transparent border-none text-sm font-black text-gray-800 outline-none focus:ring-0 cursor-pointer uppercase tracking-wider"
                value={dateFilter}
                onChange={e => {
                  setDateFilter(e.target.value)
                  setCustomStartDate('')
                  setCustomEndDate('')
                }}
              >
                <option value="todas">Histórico Completo</option>
                <option value="hoy">Hoy</option>
                <option value="semana">Esta Semana</option>
                <option value="mes">Este Mes</option>
                <option value="año">Este Año</option>
                <option value="especifica">Día Específico...</option>
                <option value="rango">Rango de Fechas...</option>
              </select>
            </div>
            
            {dateFilter === 'especifica' && (
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black text-gray-800 outline-none"
              />
            )}

            {dateFilter === 'rango' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-1/2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black text-gray-800 outline-none"
                  title="Desde"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-1/2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-black text-gray-800 outline-none"
                  title="Hasta"
                />
              </div>
            )}
          </div>

          {/* Filtro por ciudad */}
          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Sede / Ciudad</label>
            <div className="relative flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 hover:bg-gray-100/50 transition-colors">
              <Filter size={18} className="text-primary shrink-0" />
              <select
                className="w-full appearance-none bg-transparent border-none text-sm font-black text-gray-800 outline-none focus:ring-0 cursor-pointer uppercase tracking-wider"
                value={selectedCity}
                onChange={e => {
                  setSelectedCity(e.target.value)
                  setSelectedOperative('todas')
                }}
              >
                <option value="todas">Todas las Sedes</option>
                {['Quito', 'Guayaquil', 'Cuenca', 'Manta', 'Loja'].map(c => {
                  if (isAuditor && !profile?.ciudad.includes('Nacional') && !profile?.ciudad.includes(c)) return null
                  return <option key={c} value={c}>{c}</option>
                })}
              </select>
            </div>
          </div>

          {/* Filtro por operativo */}
          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Operativo / Asesor</label>
            <div className="relative flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 hover:bg-gray-100/50 transition-colors">
              <Users size={18} className="text-primary shrink-0" />
              <select
                className="w-full appearance-none bg-transparent border-none text-sm font-black text-gray-800 outline-none focus:ring-0 cursor-pointer uppercase tracking-wider"
                value={selectedOperative}
                onChange={e => setSelectedOperative(e.target.value)}
              >
                <option value="todas">Todo el Equipo</option>
                {operatives
                  .filter(op => {
                    if (selectedCity !== 'todas') return op.ciudad === selectedCity;
                    if (isAuditor && profile?.ciudad && !profile.ciudad.includes('Nacional')) {
                      if (!op.ciudad) return false;
                      const auditorCities = profile.ciudad.split(',').map(c => c.trim().toLowerCase());
                      const opCities = op.ciudad.split(',').map(c => c.trim().toLowerCase());
                      return opCities.some(c => auditorCities.includes(c));
                    }
                    return true;
                  })
                  .map(op => (
                    <option key={op.id} value={op.id}>{op.nombre}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Filtro por destino */}
          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">País o Ciudad Destino</label>
            <div className="relative flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 hover:bg-gray-100/50 transition-colors">
              <Plane size={18} className="text-primary shrink-0" />
              <input
                type="text"
                placeholder="Ej: Colombia, GYE, Europa..."
                className="w-full bg-transparent border-none text-sm font-black text-gray-800 outline-none focus:ring-0 placeholder:text-gray-400 placeholder:font-normal uppercase"
                value={selectedDestino}
                onChange={e => setSelectedDestino(e.target.value)}
              />
            </div>
          </div>

        </div>

        <div className="mt-10 border-t border-gray-50 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-relaxed text-center md:text-left max-w-lg">
            Se descargarán dos pestañas: Resumen (Dashboard) y Tabla Completa de Datos B2B con auto-filtros y fórmulas de sumatoria inteligente aplicadas.
          </p>

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-full md:w-auto bg-gray-900 hover:bg-success text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0"></div>
                <div className="flex flex-col text-left">
                  <span>Procesando...</span>
                  {progressText && <span className="text-[10px] text-white/70 font-normal normal-case tracking-normal">{progressText}</span>}
                </div>
              </>
            ) : (
              <>
                <Download size={18} />
                Exportar XLSX Inteligente
              </>
            )}
          </button>
        </div>
      </div>
      
    </div>
  )
}
