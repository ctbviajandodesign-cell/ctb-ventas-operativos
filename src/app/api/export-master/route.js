import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

export const maxDuration = 60; 

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

export async function POST(req) {
  try {
    const body = await req.json()
    const { 
      startDate, 
      endDate, 
      selectedOperative, 
      selectedCity,
      dateFilterText,
      operativeName
    } = body

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    let filteredData = []
    let step = 2000 
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

      if (startDate) query = query.gte('created_at', startDate)
      if (endDate) query = query.lte('created_at', endDate)
      if (selectedOperative !== 'todas') query = query.eq('operativo_id', selectedOperative)

      const { data, error } = await query
      if (error) throw error

      if (data && data.length > 0) {
        for (let i = 0; i < data.length; i++) {
          filteredData.push(data[i])
        }
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
      return Response.json({ error: 'No data found' }, { status: 404 })
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'CTB Intelligence Backend'
    workbook.created = new Date()

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
    const destinosMap = {}
    const motivosPerdidaMap = {}

    const rowsData = filteredData.map(q => {
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
      if (estadoActual !== 'anulada' && estadoActual !== 'perdida' && hasActiveVenta) {
        estadoActual = 'vendida'
      } else if (estadoActual === 'abierta' && isExpired(q)) {
        estadoActual = 'caducada'
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
      if (!agenciasMap[agencia]) agenciasMap[agencia] = { total: 0, cotizado: 0, vendido: 0, ganadas: 0, canceladas: 0 }
      agenciasMap[agencia].total++
      agenciasMap[agencia].cotizado += valorCotizado
      agenciasMap[agencia].vendido += valorVendido
      if (estadoActual === 'vendida') agenciasMap[agencia].ganadas++
      if (estadoActual === 'anulada' || estadoActual === 'perdida') agenciasMap[agencia].canceladas++

      // ACUMULADORES COMERCIALES
      if (!comercialesMap[comercial]) comercialesMap[comercial] = { total: 0, cotizado: 0, vendido: 0, ganadas: 0, canceladas: 0 }
      comercialesMap[comercial].total++
      comercialesMap[comercial].cotizado += valorCotizado
      comercialesMap[comercial].vendido += valorVendido
      if (estadoActual === 'vendida') comercialesMap[comercial].ganadas++
      if (estadoActual === 'anulada' || estadoActual === 'perdida') comercialesMap[comercial].canceladas++

      // ACUMULADORES DESTINOS
      const dest = destino || 'N/A'
      if (!destinosMap[dest]) destinosMap[dest] = { total: 0, cotizado: 0, vendido: 0 }
      destinosMap[dest].total++
      destinosMap[dest].cotizado += valorCotizado
      destinosMap[dest].vendido += valorVendido

      // ACUMULADORES MOTIVOS PÉRDIDA
      if (estadoActual === 'anulada' || estadoActual === 'perdida') {
        const m = motivoPerdida.trim() || 'Sin Especificar'
        if (!motivosPerdidaMap[m]) motivosPerdidaMap[m] = { cantidad: 0, valorPerdido: 0 }
        motivosPerdidaMap[m].cantidad++
        motivosPerdidaMap[m].valorPerdido += valorCotizado
      }

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

    const agenciasSinCompras = Object.entries(agenciasMap)
      .filter(([_, d]) => d.vendido === 0 && d.cotizado > 0)
      .sort((a, b) => b[1].cotizado - a[1].cotizado)
      .slice(0, 10)

    const topDestinos = Object.entries(destinosMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)

    const topMotivos = Object.entries(motivosPerdidaMap)
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .slice(0, 10)

    // Calculos de Tasas
    const winRate = stats.totalCotizaciones > 0 ? (stats.vendidas / stats.totalCotizaciones) * 100 : 0
    const ticketPromedio = stats.vendidas > 0 ? (stats.totalVendidoReal / stats.vendidas) : 0

    // ==========================================
    // PESTAÑA 1: DASHBOARD RESUMEN
    // ==========================================
    const sheetDash = workbook.addWorksheet('Dashboard Gerencial', { views: [{ showGridLines: false }] })
    
    // Titulo principal
    sheetDash.mergeCells('B2:H3')
    const titleCell = sheetDash.getCell('B2')
    titleCell.value = 'CTB INTELLIGENCE - DASHBOARD GERENCIAL B2B'
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

    // Capa 1: Contexto Global
    sheetDash.getCell('B4').value = 'Generado el:'
    sheetDash.getCell('C4').value = new Date().toLocaleString('es-EC')
    sheetDash.getCell('B5').value = 'Filtro Período:'
    sheetDash.getCell('C5').value = dateFilterText
    
    sheetDash.getCell('E4').value = 'Sede Analizada:'
    sheetDash.getCell('F4').value = selectedCity === 'todas' ? 'TODAS LAS SEDES' : selectedCity.toUpperCase()
    sheetDash.getCell('E5').value = 'Asesor Analizado:'
    sheetDash.getCell('F5').value = operativeName ? operativeName.toUpperCase() : 'TODOS'

    const kpiBox = (cellRef, label, value, color) => {
      const cell = sheetDash.getCell(cellRef)
      cell.value = `${label}\n${value}`
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    }

    // Capa 2: Volumetría y Esfuerzo
    sheetDash.mergeCells('B7:H7')
    sheetDash.getCell('B7').value = 'CAPA 1: VOLUMETRÍA Y ESFUERZO COMERCIAL'
    sheetDash.getCell('B7').font = { bold: true, size: 10, color: { argb: 'FF666666' } }
    
    sheetDash.getRow(8).height = 45
    kpiBox('B8', 'TOTAL COTIZACIONES CREADAS', stats.totalCotizaciones, 'FF334155')
    kpiBox('C8', 'COTIZACIONES VENDIDAS', stats.vendidas, 'FF0284C7') // Azul
    kpiBox('D8', 'TASA EFECTIVIDAD (WIN RATE)', `${winRate.toFixed(1)}%`, winRate >= 20 ? 'FF16A34A' : 'FFF59E0B') // Verde o Ambar

    // Capa 3: Salud Financiera
    sheetDash.mergeCells('B10:H10')
    sheetDash.getCell('B10').value = 'CAPA 2: SALUD FINANCIERA Y RENTABILIDAD'
    sheetDash.getCell('B10').font = { bold: true, size: 10, color: { argb: 'FF666666' } }

    sheetDash.getRow(11).height = 45
    kpiBox('B11', 'TOTAL COTIZADO BRUTO', `$${stats.totalCotizadoBruto.toLocaleString()}`, 'FF64748B')
    kpiBox('C11', 'TOTAL VENDIDO REAL', `$${stats.totalVendidoReal.toLocaleString()}`, 'FF16A34A')
    kpiBox('D11', 'INGRESO NETO CTB', `$${stats.ingresoCTBTotal.toLocaleString()}`, 'FF059669')
    kpiBox('E11', 'TICKET PROMEDIO POR VENTA', `$${ticketPromedio.toLocaleString(undefined, {maximumFractionDigits:2})}`, 'FF4F46E5')

    // Capa 4: Estados Secundarios
    sheetDash.mergeCells('B13:H13')
    sheetDash.getCell('B13').value = 'CAPA 3: ESTADOS SECUNDARIOS DEL EMBUDO'
    sheetDash.getCell('B13').font = { bold: true, size: 10, color: { argb: 'FF666666' } }

    sheetDash.getRow(14).height = 35
    kpiBox('B14', 'EN ESPERA', stats.enEspera, 'FF94A3B8')
    kpiBox('C14', 'CANCELADAS / PERDIDAS', stats.canceladas, 'FFDC2626')
    kpiBox('D14', 'CADUCADAS', stats.caducadas, 'FFEA580C')
    kpiBox('E14', 'VOUCHERS EMITIDOS', stats.vouchersEmitidos, 'FF8B5CF6')

    // Tablas de Ranking
    sheetDash.getCell('B17').value = 'RANKING TOP 10 AGENCIAS (Por Venta)'
    sheetDash.getCell('B17').font = { bold: true, size: 12 }
    sheetDash.getRow(18).values = [null, 'Agencia', 'Valor Vendido ($)', 'Cotizaciones Ganadas', 'Cotizaciones Canceladas']
    sheetDash.getRow(18).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetDash.getRow(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
    
    let rowIndex = 19
    topAgencias.forEach(([agencia, d]) => {
      sheetDash.getRow(rowIndex).values = [null, agencia, d.vendido, d.ganadas, d.canceladas]
      rowIndex++
    })

    rowIndex += 2
    sheetDash.getCell(`B${rowIndex}`).value = 'DESEMPEÑO COMERCIALES'
    sheetDash.getCell(`B${rowIndex}`).font = { bold: true, size: 12 }
    rowIndex++
    sheetDash.getRow(rowIndex).values = [null, 'Comercial', 'Valor Vendido ($)', 'Cotizaciones Ganadas', 'Cotizaciones Canceladas']
    sheetDash.getRow(rowIndex).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetDash.getRow(rowIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
    
    rowIndex++
    topComerciales.forEach(([comercial, d]) => {
      sheetDash.getRow(rowIndex).values = [null, comercial, d.vendido, d.ganadas, d.canceladas]
      rowIndex++
    })

    rowIndex += 2
    sheetDash.getCell(`B${rowIndex}`).value = 'ALERTA: AGENCIAS "ZERO-BUY" (Cotizan mucho pero compran $0)'
    sheetDash.getCell(`B${rowIndex}`).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } } // Rojo Alerta
    rowIndex++
    sheetDash.getRow(rowIndex).values = [null, 'Agencia', 'Valor Cotizado ($)', 'Cotizaciones Hechas', 'Cotizaciones Canceladas']
    sheetDash.getRow(rowIndex).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetDash.getRow(rowIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
    
    rowIndex++
    agenciasSinCompras.forEach(([agencia, d]) => {
      sheetDash.getRow(rowIndex).values = [null, agencia, d.cotizado, d.total, d.canceladas]
      rowIndex++
    })

    rowIndex += 2
    sheetDash.getCell(`B${rowIndex}`).value = 'RANKING TOP 10 DESTINOS (Por Volumen de Cotizaciones)'
    sheetDash.getCell(`B${rowIndex}`).font = { bold: true, size: 12 }
    rowIndex++
    sheetDash.getRow(rowIndex).values = [null, 'Destino', 'Total Cotizaciones', 'Valor Cotizado Bruto ($)', 'Valor Vendido Real ($)']
    sheetDash.getRow(rowIndex).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetDash.getRow(rowIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
    
    rowIndex++
    topDestinos.forEach(([destino, d]) => {
      sheetDash.getRow(rowIndex).values = [null, destino, d.total, d.cotizado, d.vendido]
      rowIndex++
    })

    rowIndex += 2
    sheetDash.getCell(`B${rowIndex}`).value = 'RAZONES DE PÉRDIDA MÁS COMUNES (Cotizaciones Canceladas/Perdidas)'
    sheetDash.getCell(`B${rowIndex}`).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    rowIndex++
    sheetDash.getRow(rowIndex).values = [null, 'Motivo Registrado', 'Cant. Cotizaciones Perdidas', 'Valor Monetario Perdido ($)', '']
    sheetDash.getRow(rowIndex).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetDash.getRow(rowIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
    
    rowIndex++
    topMotivos.forEach(([motivo, d]) => {
      sheetDash.getRow(rowIndex).values = [null, motivo, d.cantidad, d.valorPerdido, null]
      rowIndex++
    })

    sheetDash.getColumn('B').width = 32
    sheetDash.getColumn('C').width = 25
    sheetDash.getColumn('D').width = 25
    sheetDash.getColumn('E').width = 25
    sheetDash.getColumn('F').width = 20
    sheetDash.getColumn('G').width = 20

    // ==========================================
    // PESTAÑA 2: DATA MAESTRA 
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
    
    sheetData.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheetData.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
    sheetData.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    sheetData.addRows(rowsData)

    sheetData.autoFilter = {
      from: 'A1',
      to: { row: 1, column: columns.length }
    }

    sheetData.getColumn('valorCotizado').numFmt = '"$"#,##0.00'
    sheetData.getColumn('valorVendido').numFmt = '"$"#,##0.00'
    sheetData.getColumn('ingresoCTB').numFmt = '"$"#,##0.00'

    const totalRowIndex = rowsData.length + 2
    const totalRow = sheetData.getRow(totalRowIndex)
    totalRow.getCell('A').value = 'TOTALES GENERALES'
    totalRow.getCell('A').font = { bold: true, size: 12 }
    
    const endRow = rowsData.length + 1
    totalRow.getCell('L').value = { formula: `SUBTOTAL(9, L2:L${endRow})` } 
    totalRow.getCell('M').value = { formula: `SUBTOTAL(9, M2:M${endRow})` } 
    totalRow.getCell('N').value = { formula: `SUBTOTAL(9, N2:N${endRow})` } 
    
    totalRow.font = { bold: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } }

    const buffer = await workbook.xlsx.writeBuffer()
    
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="CTB_Reporte.xlsx"'
      }
    })

  } catch (error) {
    console.error('Error generando excel en servidor:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
