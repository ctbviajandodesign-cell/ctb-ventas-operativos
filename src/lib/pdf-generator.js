import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export const generateVoucherPDF = (voucher, qrBase64) => {
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

  // Rectángulo Superior (Header)
  doc.setFillColor(...darkColor)
  doc.rect(0, 0, 210, 40, 'F')

  // Logo Text (Simulado si no hay imagen base64)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('CTB VIAJANDO', 15, 20)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('TRAVEL AGENCY & BUSINESS INTELLIGENCE', 15, 26)

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

  // Destino y Fechas
  doc.setFontSize(9)
  doc.setTextColor(...greyColor)
  doc.text('DESTINO FINAL', 15, currentY)
  doc.text('PERIODO DE VIAJE', 110, currentY)

  doc.setTextColor(...darkColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(voucher.destino || 'EXPLORE', 15, currentY + 6)
  doc.text(`${voucher.fecha_viaje_desde || '---'} AL ${voucher.fecha_viaje_hasta || '---'}`, 110, currentY + 6)

  currentY += 15

  // Inclusiones
  if (voucher.inclusiones) {
    doc.setFontSize(9)
    doc.setTextColor(...greyColor)
    doc.text('SERVICIOS INCLUIDOS', 15, currentY)

    const items = Object.entries(voucher.inclusiones)
      .filter(([_, val]) => val)
      .map(([key]) => key.toUpperCase())
    
    doc.setTextColor(...primaryColor)
    doc.setFontSize(10)
    doc.text(items.join('  •  '), 15, currentY + 6)
    
    currentY += 15
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

export const generateProformaPDF = (venta, qrBase64 = null) => {
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

  // Rectángulo Superior (Header)
  doc.setFillColor(...darkColor)
  doc.rect(0, 0, 210, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('CTB VIAJANDO', 15, 20)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('TRAVEL AGENCY & BUSINESS INTELLIGENCE', 15, 26)

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
