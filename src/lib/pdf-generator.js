import jsPDF from 'jspdf'
import 'jspdf-autotable'

export const generateVoucherPDF = (voucher) => {
  const doc = jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  })

  // Paleta de Colores CTB
  const primaryColor = [0, 102, 204] // #0066CC
  const darkColor = [15, 23, 42] // #0F172A
  const greyColor = [156, 163, 175]

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
  doc.autoTable({
    startY: 85,
    head: [['LISTADO DE PASAJEROS', 'IDENTIFICACIÓN']],
    body: (voucher.pasajeros || []).map(p => [p.toUpperCase(), 'REGISTRADO']),
    theme: 'grid',
    headStyles: { fillColor: darkColor, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 10, textColor: darkColor },
    margin: { left: 15, right: 15 }
  })

  const nextY = doc.lastAutoTable.finalY + 15

  // Destino y Fechas
  doc.setFontSize(9)
  doc.setTextColor(...greyColor)
  doc.text('DESTINO FINAL', 15, nextY)
  doc.text('PERIODO DE VIAJE', 110, nextY)

  doc.setTextColor(...darkColor)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(voucher.destino || 'EXPLORE', 15, nextY + 6)
  doc.text(`${voucher.fecha_viaje_desde || '---'} AL ${voucher.fecha_viaje_hasta || '---'}`, 110, nextY + 6)

  // Inclusiones
  if (voucher.inclusiones) {
    const inclY = nextY + 20
    doc.setFontSize(9)
    doc.setTextColor(...greyColor)
    doc.text('SERVICIOS INCLUIDOS', 15, inclY)

    const items = Object.entries(voucher.inclusiones)
      .filter(([_, val]) => val)
      .map(([key]) => key.toUpperCase())
    
    doc.setTextColor(...primaryColor)
    doc.setFontSize(10)
    doc.text(items.join('  •  '), 15, inclY + 6)
  }

  // Notas
  if (voucher.notas) {
    const notasY = nextY + 40
    doc.setFillColor(245, 247, 250)
    doc.rect(15, notasY, 180, 20, 'F')
    doc.setFontSize(8)
    doc.setTextColor(...greyColor)
    doc.text('OBSERVACIONES', 20, notasY + 6)
    doc.setTextColor(...darkColor)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.text(voucher.notas, 20, notasY + 12, { maxWidth: 170 })
  }

  // Footer / Firma
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

  doc.save(`Voucher_${voucher.codigo}.pdf`)
}
