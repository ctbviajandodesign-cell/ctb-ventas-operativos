/**
 * Parser inteligente de hojas de cálculo (Excel / CSV / Portapapeles)
 * para creación y carga masiva de Bloqueos en CTB Viajando Mayorista.
 */

export function cleanMoney(val) {
  if (!val) return 0
  let str = String(val).replace(/[^0-9.,]/g, '').trim()
  if (!str) return 0

  // Caso: formato de miles con punto sin decimales (ej. 3.954 -> 3954)
  if (/^\d{1,3}\.\d{3}$/.test(str)) {
    str = str.replace('.', '')
  } else if (/^\d{1,3},\d{3}$/.test(str)) {
    str = str.replace(',', '')
  } else {
    // Si contiene comas y puntos (ej. 1,250.50)
    str = str.replace(/,/g, '')
  }
  return parseFloat(str) || 0
}

export function cleanPassengerName(name) {
  if (!name) return ''
  return String(name)
    .replace(/^[-–—\|,\s]+|[-–—\|,\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function detectRoomType(raw) {
  if (!raw) return 'Doble'
  const str = String(raw).toLowerCase().trim()
  if (/twin/i.test(str)) return 'Twin'
  if (/simple|sgl/i.test(str)) return 'Simple'
  if (/triple|tpl/i.test(str)) return 'Triple'
  if (/matrimonial|mat/i.test(str)) return 'Matrimonial'
  if (/cuadruple|cpl/i.test(str)) return 'Cuádruple'
  return 'Doble'
}

/**
 * Parsea un arreglo bidimensional de celdas (filas y columnas)
 */
export function parseBloqueoRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null

  let headerIndex = -1
  let headers = []

  // Buscar la fila de cabecera que contenga palabras clave
  for (let i = 0; i < rows.length; i++) {
    const raw = (rows[i] || []).map(c => String(c || '').trim().toLowerCase())
    if (raw.some(c => c.includes('pax') || c.includes('nombres') || c.includes('agencia') || c.includes('pasajero'))) {
      headerIndex = i
      headers = raw
      break
    }
  }

  // Si no se detectó cabecera explícita, asumimos que no es un formato válido
  if (headerIndex === -1) return null

  const idxPax = headers.findIndex(c => c.includes('pax') || c.includes('cupo') || c.includes('#'))
  const idxNom = headers.findIndex(c => c.includes('nombre') || c.includes('pasajero') || c.includes('cliente'))
  const idxAge = headers.findIndex(c => c.includes('agencia'))
  const idxCiu = headers.findIndex(c => c.includes('ciudad') || c.includes('origen'))
  const idxHab = headers.findIndex(c => c.includes('land') || c.includes('hab') || c.includes('acomodacion') || c.includes('tour'))
  const idxOpe = headers.findIndex(c => c.includes('operativo') || c.includes('operador'))
  const idxCom = headers.findIndex(c => c.includes('comercial') || c.includes('asesor') || c.includes('vendedor'))
  const idxHot = headers.findIndex(c => c.includes('hotel'))
  const idxAb1 = headers.findIndex(c => c.includes('abono 1') || c.includes('abono1') || c.includes('pago 1'))
  const idxAb2 = headers.findIndex(c => c.includes('abono 2') || c.includes('abono2') || c.includes('pago 2'))
  const idxAb3 = headers.findIndex(c => c.includes('abono 3') || c.includes('abono3') || c.includes('pago 3'))
  const idxObs = headers.findIndex(c => c.includes('obs') || c.includes('nota') || c.includes('comentario'))

  const passengers = []
  const hotelsSet = new Set()
  let maxCupo = 0
  let totalAbonado = 0

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const cols = (rows[i] || []).map(c => String(c || '').trim().replace(/^\|+/, '').trim())
    if (cols.length === 0 || cols.every(c => c === '')) continue

    const rawPax = idxPax !== -1 ? cols[idxPax] : ''
    let paxNum = parseInt(rawPax, 10)
    if (!isNaN(paxNum) && paxNum > maxCupo) maxCupo = paxNum

    const rawName = idxNom !== -1 ? cols[idxNom] : ''
    const nombres = cleanPassengerName(rawName)

    // Si la fila no tiene nombre, la contamos para el cupo máximo pero no como pasajero ocupado
    if (!nombres) {
      continue
    }

    if (isNaN(paxNum) || paxNum <= 0) {
      paxNum = passengers.length + 1
    }
    if (paxNum > maxCupo) maxCupo = paxNum

    const agencia = (idxAge !== -1 ? cols[idxAge] : '') || 'Directo'
    const ciudad = (idxCiu !== -1 ? cols[idxCiu] : '') || 'GYE'
    const habRaw = idxHab !== -1 ? cols[idxHab] : ''
    const roomType = detectRoomType(habRaw)

    const operativo = (idxOpe !== -1 ? cols[idxOpe] : '') || ''
    const comercial = (idxCom !== -1 ? cols[idxCom] : '') || ''
    const hotel = (idxHot !== -1 ? cols[idxHot] : '') || ''

    if (hotel && !hotel.startsWith('$') && !/^\d+$/.test(hotel)) {
      hotelsSet.add(hotel.trim().toUpperCase())
    }

    const abono1 = cleanMoney(idxAb1 !== -1 ? cols[idxAb1] : 0)
    const abono2 = cleanMoney(idxAb2 !== -1 ? cols[idxAb2] : 0)
    const abono3 = cleanMoney(idxAb3 !== -1 ? cols[idxAb3] : 0)
    const rowAbonoTotal = abono1 + abono2 + abono3
    totalAbonado += rowAbonoTotal

    const observaciones = (idxObs !== -1 ? cols[idxObs] : '') || ''

    passengers.push({
      numero_cupo: paxNum,
      nombres,
      agencia: agencia.trim(),
      ciudad: ciudad.trim().toUpperCase(),
      tipo_habitacion: roomType,
      operativo_nombre: operativo.trim(),
      comercial_nombre: comercial.trim(),
      hoteles: hotel.trim().toUpperCase(),
      abono_1: abono1,
      abono_2: abono2,
      abono_3: abono3,
      total_abonos: rowAbonoTotal,
      observaciones: observaciones.trim()
    })
  }

  // Si no se especificó un número de cupo explícito mayor a 30, fijar mínimo en 30
  const finalCupos = Math.max(maxCupo, passengers.length, 30)

  return {
    totalCupos: finalCupos,
    occupiedCount: passengers.length,
    freeSlotsCount: Math.max(0, finalCupos - passengers.length),
    hotels: Array.from(hotelsSet),
    totalAbonado,
    passengers
  }
}

/**
 * Parsea texto directo copiado de Excel, Google Sheets, WhatsApp o archivo .csv
 */
export function parseBloqueoText(text) {
  if (!text || typeof text !== 'string') return null
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  // Detectar si usa tabulaciones (copiado directo de Excel) o comas (CSV)
  const isTab = lines.some(l => l.includes('\t'))
  const delimiter = isTab ? '\t' : ','

  const rows = lines.map(line => {
    return line.split(delimiter).map(c => c.trim())
  })

  return parseBloqueoRows(rows)
}

/**
 * Parsea un archivo binario de Excel (.xlsx / .xls) usando ExcelJS
 */
export async function parseBloqueoExcelBuffer(buffer) {
  const ExcelJSModule = await import('exceljs')
  const ExcelJS = ExcelJSModule.default || ExcelJSModule

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return null

  const rows = []
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const rowVals = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Manejar fórmulas o formatos enriquecidos
      let val = cell.value
      if (val && typeof val === 'object') {
        if (val.result !== undefined) val = val.result
        else if (val.text !== undefined) val = val.text
        else if (val.richText) val = val.richText.map(t => t.text).join('')
      }
      rowVals[colNumber - 1] = val != null ? String(val).trim() : ''
    })
    rows.push(rowVals)
  })

  return parseBloqueoRows(rows)
}
