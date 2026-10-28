import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { parseEmergencyContacts } from '@/utils/emergencyContacts'

export const generateVoucherPDF = async (voucher, qrBase64) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  })

  const primaryColor = [0, 102, 204] // #0066CC
  const darkColor = [15, 23, 42] // #0F172A
  const greyColor = [156, 163, 175]

  // Helper para limpiar caracteres no soportados por jsPDF (emojis, etc)
  const cleanText = (str) => {
    if (!str) return ''
    return str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2022]/g, '*')
      .replace(/[^\x00-\xFF]/g, ' ')
      .trim()
  }

  // Intentar cargar el logo
  let logoBase64 = null
  try {
    const res = await fetch('/logo_vouchers.png')
    const blob = await res.blob()
    logoBase64 = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('No se pudo cargar el logo', e)
  }

  // Rectángulo Superior (Header)
  doc.setFillColor(...darkColor)
  doc.rect(0, 0, 210, 40, 'F')

  const agencyName = (voucher.agencia && voucher.agencia !== 'CTB Directo' ? voucher.agencia : 'VOUCHER DE VIAJE').toUpperCase()
  let headerFontSize = 24
  if (agencyName.length > 25) {
    headerFontSize = 14
  } else if (agencyName.length > 18) {
    headerFontSize = 18
  }

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 15, 10, 25, 20, undefined, 'FAST')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(headerFontSize)
    doc.text(cleanText(agencyName), 45, 20)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('TRAVEL AGENCY & BUSINESS INTELLIGENCE', 45, 26)
  } else {
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(headerFontSize)
    doc.text(cleanText(agencyName), 15, 20)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('TRAVEL AGENCY & BUSINESS INTELLIGENCE', 15, 26)
  }

  // Etiqueta de Documento
  doc.setFillColor(...primaryColor)
  doc.rect(140, 12, 55, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('VOUCHER OFICIAL', 145, 20)

  // Información General
  doc.setTextColor(...darkColor)
  doc.setFontSize(18)
  doc.text('Certificado de Viaje', 15, 55)
  
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(1)
  doc.line(15, 58, 40, 58)

  // Grid de Datos
  doc.setFontSize(9)
  doc.setTextColor(...greyColor)
  doc.text('AGENCIA EMISORA', 15, 70)
  doc.text('CÓDIGO DE SEGURIDAD', 110, 70)

  doc.setTextColor(...darkColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(voucher.agencia || 'CTB Directo', 15, 76)
  doc.text(voucher.codigo, 110, 76)

  // Tabla de Pasajeros
  autoTable(doc, {
    startY: 85,
    head: [['LISTADO DE PASAJEROS', 'IDENTIFICACIÓN']],
    body: (voucher.pasajeros || []).map(p => [p.toUpperCase(), 'REGISTRADO']),
    theme: 'grid',
    headStyles: { fillColor: darkColor, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 10, textColor: darkColor },
    margin: { left: 15, right: 15 }
  })

  let currentY = doc.lastAutoTable.finalY + 15

  const ensureSpace = (neededMm = 20) => {
    if (currentY + neededMm > 235) {
      doc.addPage()
      currentY = 25
    }
  }

  // Destino y Fechas
  ensureSpace(25)
  doc.setFontSize(8.5)
  doc.setTextColor(...greyColor)
  doc.setFont('helvetica', 'bold')
  doc.text('DESTINO FINAL', 15, currentY)
  doc.text('PERIODO DE VIAJE', 110, currentY)

  doc.setTextColor(...darkColor)
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')

  let destinoDisplay = voucher.destino || 'EXPLORE'
  if (destinoDisplay.includes('|')) {
    const [iatas, name] = destinoDisplay.split('|')
    destinoDisplay = name ? `${name.trim()} (${iatas.trim()})` : iatas.trim()
  }

  const destinoLines = doc.splitTextToSize(cleanText(destinoDisplay).toUpperCase(), 85)
  doc.text(destinoLines, 15, currentY + 5)

  const periodoText = `${voucher.fecha_viaje_desde || '---'} AL ${voucher.fecha_viaje_hasta || '---'}`
  const periodoLines = doc.splitTextToSize(cleanText(periodoText), 85)
  doc.text(periodoLines, 110, currentY + 5)

  const destHeight = destinoLines.length * 4.5
  const perHeight = periodoLines.length * 4.5
  currentY += Math.max(destHeight, perHeight) + 9

  // Contacto de Emergencia
  if (voucher.numero_emergencia) {
    const parsedContacts = parseEmergencyContacts(voucher.numero_emergencia)
      .map(c => {
        const n = (c.nombre || '').trim()
        const t = (c.telefono || '').trim()
        if (n && t) return `${n}: ${t}`
        return n || t
      })
      .filter(Boolean)

    if (parsedContacts.length > 0) {
      ensureSpace(18)
      doc.setFontSize(8.5)
      doc.setTextColor(...greyColor)
      doc.setFont('helvetica', 'bold')
      doc.text(parsedContacts.length > 1 ? 'NÚMEROS DE EMERGENCIA' : 'NÚMERO DE EMERGENCIA', 15, currentY)

      currentY += 5
      doc.setTextColor(200, 30, 30)
      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'bold')

      parsedContacts.forEach((contactLine) => {
        const wrapped = doc.splitTextToSize(cleanText(contactLine), 180)
        const contactHeight = wrapped.length * 4.5 + 2

        if (currentY + contactHeight > 230) {
          doc.addPage()
          currentY = 25
          doc.setFontSize(8.5)
          doc.setTextColor(...greyColor)
          doc.setFont('helvetica', 'bold')
          doc.text('NÚMEROS DE EMERGENCIA (CONT.)', 15, currentY)
          currentY += 5
          doc.setTextColor(200, 30, 30)
          doc.setFontSize(9.5)
          doc.setFont('helvetica', 'bold')
        }

        doc.text(wrapped, 15, currentY)
        currentY += contactHeight
      })

      currentY += 3
    }
  }

  // Inclusiones
  if (voucher.inclusiones) {
    const items = Object.entries(voucher.inclusiones)
      .filter(([_, val]) => val)
      .map(([key]) => key.toUpperCase())

    if (items.length > 0) {
      const incText = items.join('  •  ')
      const incWrapped = doc.splitTextToSize(incText, 180)
      const incHeight = incWrapped.length * 4.5 + 10

      if (currentY + incHeight > 230) {
        doc.addPage()
        currentY = 25
      }

      doc.setFontSize(8.5)
      doc.setTextColor(...greyColor)
      doc.setFont('helvetica', 'bold')
      doc.text('SERVICIOS INCLUIDOS', 15, currentY)

      doc.setTextColor(...primaryColor)
      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'bold')
      doc.text(incWrapped, 15, currentY + 5)

      currentY += incWrapped.length * 4.5 + 7
    }
  }

  // Notas
  if (voucher.notas) {
    const cleanedNotas = cleanText(voucher.notas)
    autoTable(doc, {
      startY: currentY,
      head: [['OBSERVACIONES']],
      body: [[cleanedNotas]],
      theme: 'plain',
      headStyles: { 
        fillColor: [245, 247, 250], 
        textColor: greyColor, 
        fontSize: 8, 
        fontStyle: 'bold',
        cellPadding: { top: 5, right: 5, bottom: 2, left: 5 }
      },
      bodyStyles: { 
        fillColor: [245, 247, 250], 
        textColor: darkColor, 
        fontSize: 9, 
        fontStyle: 'italic',
        cellPadding: { top: 2, right: 5, bottom: 5, left: 5 }
      },
      margin: { left: 15, right: 15, bottom: 45 }
    })
  }

  // Footer / Firma en todas las páginas
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const footerY = 270
    doc.setDrawColor(230, 230, 230)
    doc.line(15, footerY, 195, footerY)
    
    doc.setFontSize(7)
    doc.setTextColor(...greyColor)
    doc.setFont('helvetica', 'normal')
    doc.text('Este documento es una representación digital del voucher oficial de CTB Viajando.', 15, footerY + 5)
    doc.text('La validez puede verificarse escaneando el código QR oficial en ctbviajando.com/verify', 15, footerY + 9)
    
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...primaryColor)
    doc.text('CTB CLOUD VERIFIED', 165, footerY + 7)

    // QR Code
    if (qrBase64) {
      doc.addImage(qrBase64, 'PNG', 160, footerY - 35, 30, 30)
    }
  }

  doc.save(`Voucher_${voucher.codigo}.pdf`)
}

export const generateProformaPDF = async (venta, qrBase64 = null) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  })

  // Paleta de Colores CTB
  const primaryColor = [0, 102, 204] // #0066CC
  const darkColor = [15, 23, 42] // #0F172A
  const greyColor = [156, 163, 175]
  const isVenta = venta.estado === 'ganada'

  // Helper para limpiar caracteres no soportados por jsPDF (emojis, etc)
  const cleanText = (str) => {
    if (!str) return ''
    return str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2022]/g, '*')
      .replace(/[^\x00-\xFF]/g, ' ')
      .trim()
  }

  // Intentar cargar el logo
  let logoBase64 = null
  try {
    const res = await fetch('/logo_vouchers.png')
    const blob = await res.blob()
    logoBase64 = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('No se pudo cargar el logo', e)
  }

  // Rectángulo Superior (Header)
  doc.setFillColor(...darkColor)
  doc.rect(0, 0, 210, 40, 'F')

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 15, 10, 25, 20, undefined, 'FAST')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.text('CTB VIAJANDO', 45, 20)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('TRAVEL AGENCY & BUSINESS INTELLIGENCE', 45, 26)
  } else {
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.text('CTB VIAJANDO', 15, 20)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('TRAVEL AGENCY & BUSINESS INTELLIGENCE', 15, 26)
  }

  // Etiqueta de Documento
  doc.setFillColor(...primaryColor)
  doc.rect(130, 12, 65, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(isVenta ? 'PROFORMA / VENDIDA' : 'COTIZACIÓN OFICIAL', 135, 20)

  // Información General
  doc.setTextColor(...darkColor)
  doc.setFontSize(18)
  doc.text(isVenta ? 'Detalle de Proforma' : 'Detalle de Cotización', 15, 55)
  
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(1)
  doc.line(15, 58, 40, 58)

  doc.setFontSize(9)
  doc.setTextColor(...greyColor)
  doc.text('CÓDIGO', 15, 70)
  doc.text('AGENCIA', 65, 70)
  doc.text('COMERCIAL', 130, 70)

  doc.setTextColor(...darkColor)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  
  // Format code safely (assuming string id, e.g. uuid)
  let codeStr = 'S/D'
  if (venta.id) {
    const year = venta.created_at ? new Date(venta.created_at).getFullYear() : new Date().getFullYear()
    codeStr = `#CTB-${year}-${venta.id.toString().slice(0, 4).toUpperCase()}`
  }
  
  doc.text(codeStr, 15, 76)
  doc.text(venta.agencia || 'S/D', 65, 76)
  doc.text(venta.comercial || 'S/D', 130, 76)

  doc.setFontSize(9)
  doc.setTextColor(...greyColor)
  doc.setFont('helvetica', 'normal')
  doc.text('DESTINO', 15, 88)
  doc.text('Nº PASAJEROS', 130, 88)

  doc.setTextColor(...darkColor)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  const destinoText = venta.destino_formateado || venta.destino || 'S/D'
  doc.text(destinoText, 15, 94)
  doc.text(`${venta.numero_pasajeros || 1} Pax`, 130, 94)

  let currentY = 105;

  if (venta.notas_iniciales) {
    const cleanedNotas = cleanText(venta.notas_iniciales)
    autoTable(doc, {
      startY: currentY,
      head: [['OBSERVACIONES / REQUERIMIENTO']],
      body: [[cleanedNotas]],
      theme: 'plain',
      headStyles: { 
        fillColor: [245, 247, 250], 
        textColor: greyColor, 
        fontSize: 9, 
        fontStyle: 'bold',
        cellPadding: { top: 5, right: 5, bottom: 2, left: 5 }
      },
      bodyStyles: { 
        fillColor: [245, 247, 250], 
        textColor: darkColor, 
        fontSize: 10, 
        fontStyle: 'normal',
        cellPadding: { top: 2, right: 5, bottom: 5, left: 5 }
      },
      margin: { left: 15, right: 15, bottom: 45 }
    })
    currentY = doc.lastAutoTable.finalY + 15
  }

  // Pasajeros
  if (venta.nombres_pasajeros && venta.nombres_pasajeros.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [['LISTADO DE PASAJEROS (Opcional)']],
      body: venta.nombres_pasajeros.map(p => [p.toUpperCase()]),
      theme: 'grid',
      headStyles: { fillColor: darkColor, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 10, textColor: darkColor },
      margin: { left: 15, right: 15, bottom: 45 }
    })
    currentY = doc.lastAutoTable.finalY + 15
  }

  // Financieros
  if (venta.valor_total || venta.valor_comision || isVenta) {
    autoTable(doc, {
      startY: currentY,
      head: [['RESUMEN FINANCIERO', 'VALOR (USD)']],
      body: [
        ['VALOR TOTAL', `$${venta.valor_total || 0}`],
        ['COMISIÓN', `$${venta.valor_comision || 0}`],
        [isVenta ? 'ESTADO' : 'ESTADO', isVenta ? 'VENDIDA / APROBADA' : 'PENDIENTE / COTIZADA']
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 10, textColor: darkColor },
      margin: { left: 15, right: 15, bottom: 45 }
    })
    currentY = doc.lastAutoTable.finalY + 15
  }

  // Footer / Firma en todas las páginas
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const footerY = 270
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.5)
    doc.line(15, footerY, 195, footerY)
    
    doc.setFontSize(7)
    doc.setTextColor(...greyColor)
    doc.setFont('helvetica', 'normal')
    doc.text('Documento generado a través de CTB Business Intelligence.', 15, footerY + 5)
    if (qrBase64) {
      doc.text('Cotización vinculada a un Voucher. Escanee el código para verificar.', 15, footerY + 9)
    }
    
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...primaryColor)
    doc.text('CTB CLOUD VERIFIED', 165, footerY + 7)

    // QR Code
    if (qrBase64) {
      doc.addImage(qrBase64, 'PNG', 160, footerY - 35, 30, 30)
    }
  }

  const prefix = isVenta ? 'Proforma_Vendida' : 'Cotizacion'
  const shortId = venta.id ? venta.id.toString().slice(0,4).toUpperCase() : 'SD'
  doc.save(`${prefix}_${shortId}.pdf`)
}

/**
 * Exporta el Rooming List / Manifiesto Oficial de Pasajeros de un Bloqueo en PDF horizontal de alta calidad.
 */
export const exportBloqueoRoomingPDF = async (bloqueo, pasajeros = []) => {
  if (!bloqueo) return

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  const primaryColor = [0, 102, 204] // #0066CC
  const darkColor = [15, 23, 42]     // #0F172A
  const greyColor = [100, 116, 139]

  const clean = (str) => {
    if (!str) return ''
    return String(str)
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2022]/g, '*')
      .replace(/[^\x00-\xFF]/g, ' ')
      .trim()
  }

  // Header Dark Banner
  doc.setFillColor(...darkColor)
  doc.rect(0, 0, 297, 28, 'F')

  // Brand Name
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('CTB VIAJANDO — MAYORISTA DE TURISMO', 14, 11)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('MANIFIESTO OFICIAL DE PASAJEROS & DISTRIBUCIÓN DE HABITACIONES (ROOMING LIST)', 14, 17)

  // Badge derecho: Código de Bloqueo
  doc.setFillColor(...primaryColor)
  doc.roundedRect(230, 7, 53, 14, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`CÓDIGO: ${clean(bloqueo.codigo || 'BLQ')}`, 234, 15)

  // Meta strip informativa
  doc.setFillColor(241, 245, 249) // #F1F5F9
  doc.rect(0, 28, 297, 12, 'F')
  doc.setTextColor(51, 65, 85)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')

  const metaText = `PROGRAMA: ${clean(bloqueo.titulo)}   |   DESTINO: ${clean(bloqueo.destino)}   |   AEROLÍNEA: ${clean(bloqueo.aerolinea || 'Confirmada')}   |   SALIDA: ${clean(bloqueo.fecha_salida)}   |   RETORNO: ${clean(bloqueo.fecha_retorno || 'N/A')}`
  doc.text(metaText, 14, 35)

  // Preparar filas de tabla
  const rows = (pasajeros || []).map(p => {
    const isOccupied = Boolean(p.nombres && String(p.nombres).trim() !== '')
    const fullName = isOccupied ? `${clean(p.nombres)} ${clean(p.apellidos || '')}`.trim() : '[CUPOS DISPONIBLE]'
    const docInfo = isOccupied ? `${clean(p.tipo_documento || 'Doc')}: ${clean(p.numero_documento || 'S/N')}` : '—'
    const habitacion = isOccupied ? `Hab. ${clean(p.tipo_habitacion || 'Doble')}` : '—'
    const categoria = isOccupied ? clean(p.categoria_habitacion || 'Clase 2 (4★)').replace(/\(.*?\)/, '').trim() : '—'
    const hotel = isOccupied ? clean(p.hoteles || 'Estándar') : '—'
    const agencia = isOccupied ? `${clean(p.agencia || 'Directo')}${p.ciudad ? ` (${clean(p.ciudad)})` : ''}` : '—'
    const equipo = isOccupied ? `Op: ${clean(p.operativo_nombre || 'S/A')}` : '—'
    
    let estadoPago = '—'
    if (isOccupied) {
      const precio = Number(p.precio_acordado) || 0
      let totalPagado = 0
      if (Array.isArray(p.plan_pagos) && p.plan_pagos.length > 0) {
        totalPagado = p.plan_pagos.filter(item => item && item.estado === 'pagado').reduce((acc, item) => acc + (Number(item?.monto) || 0), 0)
      } else {
        totalPagado = (Number(p.abono_1) || 0) + (Number(p.abono_2) || 0) + (Number(p.abono_3) || 0)
      }
      const faltante = Math.max(0, precio - totalPagado)
      estadoPago = faltante === 0 && precio > 0 ? 'PAGADO 100%' : `$${totalPagado} / Faltan $${faltante}`
    }

    return [
      p.numero_cupo || '—',
      fullName,
      docInfo,
      habitacion,
      categoria,
      hotel,
      agencia,
      equipo,
      estadoPago
    ]
  })

  // Generar AutoTable
  autoTable(doc, {
    startY: 43,
    head: [[
      '# Cupo',
      'Pasajero Registrado',
      'Documento',
      'Habitación',
      'Categoría',
      'Hotel Asignado',
      'Agencia Solicitante',
      'Operativo',
      'Estado Cobro'
    ]],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      valign: 'middle'
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      1: { cellWidth: 48, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 26 },
      5: { cellWidth: 40 },
      6: { cellWidth: 38 },
      7: { cellWidth: 26 },
      8: { cellWidth: 30, halign: 'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didParseCell: (data) => {
      // Resaltar cupos libres
      if (data.row.raw && data.row.raw[1] === '[CUPOS DISPONIBLE]') {
        data.cell.styles.textColor = [156, 163, 175]
        data.cell.styles.fontStyle = 'italic'
      }
    },
    didDrawPage: (data) => {
      // Footer en cada página
      const pageCount = doc.internal.getNumberOfPages()
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber
      doc.setFontSize(7)
      doc.setTextColor(...greyColor)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `CTB Viajando Mayorista de Turismo · Manifiesto emitido el ${new Date().toLocaleDateString('es-EC')}`,
        14,
        205
      )
      doc.text(
        `Página ${currentPage} de ${pageCount}`,
        270,
        205,
        { align: 'right' }
      )
    }
  })

  doc.save(`Rooming_List_${bloqueo.codigo || 'BLQ'}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

