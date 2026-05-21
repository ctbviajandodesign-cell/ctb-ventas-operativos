import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { generateVoucherPDF } from './src/lib/pdf-generator.js'

generateVoucherPDF({
  codigo: 'TEST-123',
  agencia: 'Test Agency',
  pasajeros: ['John Doe'],
  destino: 'Miami',
  fecha_viaje_desde: '2024-01-01',
  fecha_viaje_hasta: '2024-01-10',
  inclusiones: { hotel: true },
  notas: 'Test notes'
})
console.log("PDF generation finished successfully")
