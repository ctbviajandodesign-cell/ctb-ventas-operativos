'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserSession } from '@/hooks/useUserSession'
import { Download, Calendar, Filter, Users, Database, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { showToast } from '@/utils/toast'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

const isExpired = (q) => {
  if (q.fecha_caducidad) {
    const timeStr = q.hora_caducidad ? q.hora_caducidad : '23:59:59'
    const expiryDate = new Date(`${q.fecha_caducidad}T${timeStr}`)
    return expiryDate < new Date()
  }
  if (q.created_at) {
    const hours = (new Date() - new Date(q.created_at)) / (1000 * 60 * 60)
    return hours > 24
  }
  return false
}

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
    setProgressText('Iniciando conexión con la base de datos...')
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

      let filteredData = []
      let step = 1000
      let from = 0
      let to = step - 1
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from('cotizaciones')
          .select(`
            id, codigo, agencia, comercial, destino, numero_pasajeros, nombres_pasajeros,
            valor_total, valor_comision, valor_utilidad, estado, motivo_perdida, notas_iniciales,
            fecha_caducidad, hora_caducidad,
            created_at, operativo_id,
            profiles!left(nombre, ciudad),
            ventas(id, total, comision, utilidad, estado, vouchers(codigo, estado))
          `)
          .order('created_at', { ascending: false })
          .range(from, to)

        if (startDate) query = query.gte('created_at', startDate.toISOString())
        if (endDate) query = query.lte('created_at', endDate.toISOString())
        if (selectedOperative !== 'todas') query = query.eq('operativo_id', selectedOperative)

        const { data, error } = await query
        if (error) throw error

        if (data && data.length > 0) {
          // Usamos push en lugar de spread operator para no saturar la memoria RAM del navegador
          for (let i = 0; i < data.length; i++) {
            filteredData.push(data[i])
          }
          
          setProgressText(`Descargando datos... (${filteredData.length.toLocaleString()} registros)`)
          await new Promise(resolve => setTimeout(resolve, 30)) // Libera el hilo principal

          from += step
          to += step
          if (data.length < step) hasMore = false
        } else {
          hasMore = false
        }
      }
      
      if (selectedCity !== 'todas') {
        filteredData = filteredData.filter(q => q.profiles?.ciudad === selectedCity)
      }

      if (filteredData.length === 0) {
        showToast('No se encontraron registros en el período y filtros seleccionados.', 'error')
        setLoading(false)
        return
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

      setProgressText('Generando archivo Excel (puede tomar unos segundos)...')
      await new Promise(resolve => setTimeout(resolve, 50))
      
      await generateExcel(filteredData, { dateFilterText, operativeName })
      showToast('Reporte Inteligente generado con éxito.')
    } catch (err) {
      console.error(err)
      showToast('Error al generar el reporte.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const generateExcel = async (data, { dateFilterText, operativeName }) => {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'CTB Intelligence'
    workbook.created = new Date()

    // ==========================================
    // CÁLCULOS PARA DASHBOARD Y MASTER
    // ==========================================
    let stats = {
      totalCotizaciones: 0,
      totalCotizadoBruto: 0,
      totalVendidoReal: 0,
      ingresoCTBTotal: 0,
      enEspera: 0,
      vendidas: 0,
      canceladas: 0,
      caducadas: 0,
      vouchersEmitidos: 0
    }
    
    const agenciasMap = {}
    const comercialesMap = {}

    const rowsData = data.map(q => {
      const codigo = q.codigo || 'N/A'
      const fecha = q.created_at ? new Date(q.created_at).toLocaleString('es-EC') : 'N/A'
      const agencia = (q.agencia || 'Directo').trim()
      const comercial = (q.comercial || 'N/A').trim()
      const ciudad = q.profiles?.ciudad || 'N/A'
      const operativo = q.profiles?.nombre || 'N/A'
      const destino = q.destino || 'N/A'
      const numPasajeros = Number(q.numero_pasajeros) || 0
      
      const passengerNames = Array.isArray(q.nombres_pasajeros) 
        ? q.nombres_pasajeros.join(', ') 
        : (q.nombres_pasajeros || '')

      const venta = q.ventas?.[0]
      const hasActiveVenta = Array.isArray(q.ventas) && q.ventas.some(v => v.estado !== 'anulada')
      
      let estadoActual = (q.estado || '').trim()
      let esCaducada = false
      if (estadoActual !== 'anulada' && estadoActual !== 'perdida' && hasActiveVenta) {
        estadoActual = 'vendida'
      } else if (estadoActual === 'abierta' && isExpired(q)) {
        estadoActual = 'caducada'
        esCaducada = true
      }

      const valorCotizado = Number(q.valor_total) || 0
      const valorVendido = (estadoActual === 'vendida' && venta) ? (Number(venta.total) || 0) : 0
      const utilidad = (estadoActual === 'vendida' && venta) ? (Number(venta.utilidad) || 0) : 0
      const comision = (estadoActual === 'vendida' && venta) ? (Number(venta.comision) || 0) : 0
      const ingresoCTB = utilidad + comision

      const voucher = venta?.vouchers?.[0]
      const tieneVoucher = voucher ? 'Sí' : 'No'
      const voucherCodigo = voucher ? voucher.codigo : 'N/A'
      
      const motivoPerdida = q.motivo_perdida || ''
      const notas = q.notas_iniciales || ''

      // ACUMULADORES GLOBALES
      stats.totalCotizaciones++
      stats.totalCotizadoBruto += valorCotizado
      stats.totalVendidoReal += valorVendido
      stats.ingresoCTBTotal += ingresoCTB

      if (estadoActual === 'vendida') stats.vendidas++
      else if (estadoActual === 'anulada' || estadoActual === 'perdida') stats.canceladas++
      else if (estadoActual === 'caducada') stats.caducadas++
      else stats.enEspera++

      if (voucher) stats.vouchersEmitidos++

      // ACUMULADORES AGENCIAS
      if (!agenciasMap[agencia]) agenciasMap[agencia] = { cotizado: 0, vendido: 0, ganadas: 0, canceladas: 0 }
      agenciasMap[agencia].cotizado += valorCotizado
      agenciasMap[agencia].vendido += valorVendido
      if (estadoActual === 'vendida') agenciasMap[agencia].ganadas++
      if (estadoActual === 'anulada' || estadoActual === 'perdida') agenciasMap[agencia].canceladas++

      // ACUMULADORES COMERCIALES
      if (!comercialesMap[comercial]) comercialesMap[comercial] = { cotizado: 0, vendido: 0, ganadas: 0, canceladas: 0 }
      comercialesMap[comercial].cotizado += valorCotizado
      comercialesMap[comercial].vendido += valorVendido
      if (estadoActual === 'vendida') comercialesMap[comercial].ganadas++
      if (estadoActual === 'anulada' || estadoActual === 'perdida') comercialesMap[comercial].canceladas++

      return [
        q.id, codigo, fecha, agencia, comercial, ciudad, operativo, destino,
        numPasajeros, passengerNames, estadoActual.toUpperCase(), 
        valorCotizado, valorVendido, ingresoCTB, tieneVoucher, voucherCodigo, 
        motivoPerdida, notas
      ]
    })

    const topAgencias = Object.entries(agenciasMap)
      .sort((a, b) => b[1].vendido - a[1].vendido)
      .slice(0, 10)

    const topComerciales = Object.entries(comercialesMap)
      .sort((a, b) => b[1].vendido - a[1].vendido)
      .slice(0, 10)

    // ==========================================
    // PESTAÑA 1: DASHBOARD RESUMEN
    // ==========================================
    const sheetDash = workbook.addWorksheet('Resumen Dashboard', { views: [{ showGridLines: false }] })
    
    // Titulo
    sheetDash.mergeCells('B2:H3')
    const titleCell = sheetDash.getCell('B2')
    titleCell.value = 'CTB INTELLIGENCE - REPORTE GERENCIAL B2B'
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

    // Fecha del reporte
    sheetDash.getCell('B4').value = 'Generado el:'
    sheetDash.getCell('C4').value = new Date().toLocaleString('es-EC')
    sheetDash.getCell('B5').value = 'Filtro Período:'
    sheetDash.getCell('C5').value = dateFilterText
    
    // Cajas de KPIs
    const kpiBox = (cellRef, label, value, color) => {
      const cell = sheetDash.getCell(cellRef)
      cell.value = `${label}\n${value}`
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    }

    sheetDash.getRow(7).height = 40
    kpiBox('B7', 'TOTAL COTIZADO', `$${stats.totalCotizadoBruto.toLocaleString()}`, 'FF334155')
    kpiBox('D7', 'TOTAL VENDIDO', `$${stats.totalVendidoReal.toLocaleString()}`, 'FF16A34A')
    kpiBox('F7', 'INGRESO CTB', `$${stats.ingresoCTBTotal.toLocaleString()}`, 'FF059669')
    
    sheetDash.getRow(9).height = 40
    kpiBox('B9', 'COTIZACIONES EN ESPERA', stats.enEspera, 'FF3B82F6')
    kpiBox('C9', 'COTIZACIONES VENDIDAS', stats.vendidas, 'FF16A34A')
    kpiBox('D9', 'COTIZACIONES CANCELADAS', stats.canceladas, 'FFDC2626')
    kpiBox('E9', 'COTIZACIONES CADUCADAS', stats.caducadas, 'FFF59E0B')
    kpiBox('F9', 'VOUCHERS EMITIDOS', stats.vouchersEmitidos, 'FF8B5CF6')

    // Top Agencias (Tabla)
    sheetDash.getCell('B12').value = 'RANKING TOP 10 AGENCIAS (Por Venta)'
    sheetDash.getCell('B12').font = { bold: true, size: 12 }
    sheetDash.getRow(13).values = [null, 'Agencia', 'Valor Vendido ($)', 'Cotizaciones Ganadas', 'Cotizaciones Canceladas']
    sheetDash.getRow(13).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetDash.getRow(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
    
    let rowIndex = 14
    topAgencias.forEach(([agencia, d]) => {
      sheetDash.getRow(rowIndex).values = [null, agencia, d.vendido, d.ganadas, d.canceladas]
      rowIndex++
    })

    // Top Comerciales
    rowIndex += 2
    sheetDash.getCell(`B${rowIndex}`).value = 'DESEMPEÑO COMERCIALES'
    sheetDash.getCell(`B${rowIndex}`).font = { bold: true, size: 12 }
    rowIndex++
    sheetDash.getRow(rowIndex).values = [null, 'Comercial', 'Valor Vendido ($)', 'Cotizaciones Ganadas', 'Cotizaciones Canceladas']
    sheetDash.getRow(rowIndex).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetDash.getRow(rowIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
    
    rowIndex++
    topComerciales.forEach(([comercial, d]) => {
      sheetDash.getRow(rowIndex).values = [null, comercial, d.vendido, d.ganadas, d.canceladas]
      rowIndex++
    })

    // Ajustar anchos
    sheetDash.getColumn('B').width = 30
    sheetDash.getColumn('C').width = 20
    sheetDash.getColumn('D').width = 25
    sheetDash.getColumn('E').width = 25
    sheetDash.getColumn('F').width = 20
    sheetDash.getColumn('G').width = 20


    // ==========================================
    // PESTAÑA 2: DATA MAESTRA (Con Filtros y Totales)
    // ==========================================
    const sheetData = workbook.addWorksheet('Data Maestra')
    
    const columns = [
      { header: 'ID_Interno', key: 'id', width: 10 },
      { header: 'CÓDIGO', key: 'codigo', width: 15 },
      { header: 'FECHA CREACIÓN', key: 'fecha', width: 20 },
      { header: 'AGENCIA', key: 'agencia', width: 25 },
      { header: 'COMERCIAL', key: 'comercial', width: 20 },
      { header: 'CIUDAD', key: 'ciudad', width: 15 },
      { header: 'OPERATIVO', key: 'operativo', width: 20 },
      { header: 'DESTINO', key: 'destino', width: 20 },
      { header: 'PASAJEROS (CANT)', key: 'numPasajeros', width: 18 },
      { header: 'PASAJEROS (NOMBRES)', key: 'pasajeros', width: 35 },
      { header: 'ESTADO', key: 'estado', width: 15 },
      { header: 'VALOR COTIZADO ($)', key: 'valorCotizado', width: 20 },
      { header: 'VALOR VENDIDO ($)', key: 'valorVendido', width: 20 },
      { header: 'INGRESO CTB ($)', key: 'ingresoCTB', width: 18 },
      { header: 'TIENE VOUCHER', key: 'tieneVoucher', width: 15 },
      { header: 'CÓDIGO VOUCHER', key: 'codigoVoucher', width: 18 },
      { header: 'MOTIVO PÉRDIDA', key: 'motivoPerdida', width: 25 },
      { header: 'NOTAS INICIALES', key: 'notas', width: 30 }
    ]

    sheetData.columns = columns
    
    // Estilos Encabezado Data Maestra
    sheetData.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetData.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } }
    sheetData.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    // Llenar Datos
    sheetData.addRows(rowsData)

    // Activar Autofiltros (flechitas en excel)
    sheetData.autoFilter = {
      from: 'A1',
      to: { row: 1, column: columns.length }
    }

    // Estilizar celdas de moneda y números
    const colValorCotizado = sheetData.getColumn('valorCotizado')
    const colValorVendido = sheetData.getColumn('valorVendido')
    const colIngreso = sheetData.getColumn('ingresoCTB')
    colValorCotizado.numFmt = '"$"#,##0.00'
    colValorVendido.numFmt = '"$"#,##0.00'
    colIngreso.numFmt = '"$"#,##0.00'

    // FILA DE TOTALES
    const totalRowIndex = rowsData.length + 2
    const totalRow = sheetData.getRow(totalRowIndex)
    totalRow.getCell('A').value = 'TOTALES GENERALES'
    totalRow.getCell('A').font = { bold: true, size: 12 }
    
    // Usamos fórmulas SUBTOTAL(9, rango) para que al filtrar las sumas se ajusten a la vista! (Filtros Inteligentes)
    const endRow = rowsData.length + 1
    totalRow.getCell('L').value = { formula: `SUBTOTAL(9, L2:L${endRow})` } // valorCotizado
    totalRow.getCell('M').value = { formula: `SUBTOTAL(9, M2:M${endRow})` } // valorVendido
    totalRow.getCell('N').value = { formula: `SUBTOTAL(9, N2:N${endRow})` } // ingresoCTB
    
    totalRow.font = { bold: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } }
    
    // Descargar
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `DataLake_CTB_${operativeName}_${new Date().toISOString().split('T')[0]}.xlsx`)
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
