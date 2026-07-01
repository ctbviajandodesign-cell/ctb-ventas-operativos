'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import { Download, Calendar, Filter, Users, Database, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { showToast } from '@/utils/toast'

export default function ReportesPage() {
  const { user, profile, isAdmin, loading: sessionLoading } = useUserSession()
  const [loading, setLoading] = useState(false)
  const [operatives, setOperatives] = useState([])
  
  // Filters
  const [dateFilter, setDateFilter] = useState('mes')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedCity, setSelectedCity] = useState('todas')
  const [selectedOperative, setSelectedOperative] = useState('todas')

  useEffect(() => {
    if (isAdmin) {
      supabase.from('profiles').select('id, nombre, ciudad').eq('rol', 'operativo').then(({ data }) => {
        setOperatives(data || [])
      })
    }
  }, [isAdmin])

  const handleGenerateReport = async () => {
    if (!isAdmin) {
      showToast('No tienes permisos para esta acción.', 'error')
      return
    }

    setLoading(true)
    try {
      // 1. Determinar el rango de fechas para el query inicial
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

      let query = supabase
        .from('cotizaciones')
        .select(`
          id, codigo, agencia, comercial, destino, numero_pasajeros, nombres_pasajeros,
          valor_total, valor_comision, valor_utilidad, estado, motivo_perdida, notas_iniciales,
          created_at, operativo_id,
          profiles!left(nombre, ciudad),
          ventas(id, total, comision, utilidad, estado, vouchers(codigo, estado))
        `)
        .order('created_at', { ascending: false })

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString())
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString())
      }

      if (selectedOperative !== 'todas') {
        query = query.eq('operativo_id', selectedOperative)
      }

      const { data, error } = await query
      if (error) throw error

      let filteredData = data || []
      
      // Filtro adicional por ciudad en memoria (si aplica)
      if (selectedCity !== 'todas') {
        filteredData = filteredData.filter(q => q.profiles?.ciudad === selectedCity)
      }

      if (filteredData.length === 0) {
        showToast('No se encontraron registros en el período y filtros seleccionados.', 'error')
        setLoading(false)
        return
      }

      generateCSV(filteredData)
      showToast('Reporte Maestro descargado con éxito.')
    } catch (err) {
      console.error(err)
      showToast('Error al generar el reporte maestro.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const generateCSV = (data) => {
    const escapeCSV = (val) => {
      if (val === undefined || val === null) return '""'
      return `"${val.toString().replace(/"/g, '""')}"`
    }

    const headers = [
      'ID',
      'Código',
      'Fecha Creación',
      'Agencia',
      'Comercial',
      'Ciudad',
      'Operativo Responsable',
      'Destino',
      'Nro Pasajeros',
      'Nombres Pasajeros',
      'Estado Actual',
      'Valor Cotizado ($)',
      'Valor Vendido ($)',
      'Utilidad ($)',
      'Comisión ($)',
      'Ingreso CTB ($)',
      'Tiene Voucher',
      'Código Voucher',
      'Estado Voucher',
      'Motivo Pérdida / Cancelación',
      'Notas Iniciales'
    ].join(',')

    const rows = data.map(q => {
      const codigo = q.codigo || 'N/A'
      const fecha = q.created_at ? new Date(q.created_at).toLocaleString('es-EC') : 'N/A'
      const agencia = q.agencia || 'Directo'
      const comercial = q.comercial || 'N/A'
      const ciudad = q.profiles?.ciudad || 'N/A'
      const operativo = q.profiles?.nombre || 'N/A'
      const destino = q.destino || 'N/A'
      const numPasajeros = q.numero_pasajeros || 0
      
      const passengerNames = Array.isArray(q.nombres_pasajeros) 
        ? q.nombres_pasajeros.join(', ') 
        : (q.nombres_pasajeros || '')

      const venta = q.ventas?.[0]
      const hasActiveVenta = Array.isArray(q.ventas) && q.ventas.some(v => v.estado !== 'anulada')
      
      let estadoActual = (q.estado || '').trim()
      if (estadoActual !== 'anulada' && estadoActual !== 'perdida' && hasActiveVenta) {
        estadoActual = 'ganada'
      }

      const valorCotizado = q.valor_total || 0
      const valorVendido = venta && venta.estado !== 'anulada' ? (Number(venta.total) || 0) : 0
      
      const utilidad = venta && venta.estado !== 'anulada' ? (Number(venta.utilidad) || 0) : 0
      const comision = venta && venta.estado !== 'anulada' ? (Number(venta.comision) || 0) : 0
      const ingresoCTB = utilidad + comision

      const voucher = venta?.vouchers?.[0]
      const tieneVoucher = voucher ? 'Sí' : 'No'
      const voucherCodigo = voucher ? voucher.codigo : 'N/A'
      const voucherEstado = voucher ? voucher.estado : 'N/A'

      const motivoPerdida = q.motivo_perdida || 'N/A'
      const notas = q.notas_iniciales || ''

      return [
        escapeCSV(q.id),
        escapeCSV(codigo),
        escapeCSV(fecha),
        escapeCSV(agencia),
        escapeCSV(comercial),
        escapeCSV(ciudad),
        escapeCSV(operativo),
        escapeCSV(destino),
        numPasajeros,
        escapeCSV(passengerNames),
        escapeCSV(estadoActual),
        valorCotizado,
        valorVendido,
        utilidad,
        comision,
        ingresoCTB,
        escapeCSV(tieneVoucher),
        escapeCSV(voucherCodigo),
        escapeCSV(voucherEstado),
        escapeCSV(motivoPerdida),
        escapeCSV(notas)
      ].join(',')
    })

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Master_Data_CTB_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (sessionLoading) {
    return <div className="p-20 text-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div></div>
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h3 className="text-xl font-black text-gray-800 mb-2 uppercase">Acceso Restringido</h3>
        <p className="text-gray-500 mb-6">Solo los administradores pueden generar el Reporte Maestro.</p>
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
            Reportes Maestros
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-2xl leading-relaxed">
            Genera una base de datos consolidada en formato Excel/CSV con todas las cotizaciones, ventas, vouchers, ingresos y motivos de pérdida. Usa las <strong>Tablas Dinámicas de Excel</strong> sobre este archivo para responder cualquier pregunta analítica.
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
          Configurar Exportación
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
                <option value="Quito">Quito</option>
                <option value="Guayaquil">Guayaquil</option>
                <option value="Cuenca">Cuenca</option>
                <option value="Manta">Manta</option>
                <option value="Loja">Loja</option>
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
                  .filter(op => selectedCity === 'todas' || op.ciudad === selectedCity)
                  .map(op => (
                    <option key={op.id} value={op.id}>{op.nombre}</option>
                  ))}
              </select>
            </div>
          </div>

        </div>

        <div className="mt-10 border-t border-gray-50 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-relaxed text-center md:text-left max-w-lg">
            El archivo generado contendrá más de 20 columnas de datos cruzados entre cotizaciones, ventas, pagos y anulaciones.
          </p>

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-full md:w-auto bg-gray-900 hover:bg-success text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Procesando Data...
              </>
            ) : (
              <>
                <Download size={18} />
                Exportar Data Maestra
              </>
            )}
          </button>
        </div>
      </div>
      
    </div>
  )
}
