/**
 * Parser inteligente de hojas de cálculo (Excel / CSV / Portapapeles)
 * para creación y carga masiva o individual de Pasajeros en Bloqueos (CTB Viajando Mayorista).
 */

const CITIES = ['GYE', 'UIO', 'CUE', 'BOG', 'MEC', 'ESM', 'GUA', 'UIO/GYE', 'GYE/UIO']
const ROOM_TYPES = ['twin', 'twins', 'doble', 'dbl', 'simple', 'sgl', 'triple', 'tpl', 'matrimonial', 'mat', 'cuadruple', 'cpl']

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
  const cleaned = String(name)
    .replace(/^[-–—\|,\s/]+|[-–—\|,\s/]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.toUpperCase()
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

export function isCity(val) {
  if (!val) return false
  const s = String(val).toUpperCase().trim()
  return CITIES.includes(s) || /^(GUAYAQUIL|QUITO|CUENCA|MANTA|BOGOTA)$/i.test(s)
}

export function isRoom(val) {
  if (!val) return false
  const s = String(val).toLowerCase().trim()
  return ROOM_TYPES.includes(s) || /^(twin|simple|triple|doble|matrimonial)/i.test(s)
}

export function isDoc(val) {
  if (!val) return false
  const s = String(val).trim()
  if (/^\d{10}$/.test(s)) return true
  if (/^[A-Za-z]\d{6,10}$/.test(s)) return true
  return false
}

/**
 * Busca coincidencia de nombre en un listado de usuarios (operativos o comerciales)
 */
export function matchTeamMember(rawName, list = []) {
  if (!rawName || !Array.isArray(list) || list.length === 0) return null
  const clean = String(rawName).trim().toLowerCase()
  if (!clean || clean === '-' || clean === '/') return null

  // Coincidencia exacta de nombre
  const exact = list.find(u => (u.nombre || '').toLowerCase() === clean)
  if (exact) return exact

  // Coincidencia parcial (el nombre incluye el término o viceversa)
  const partial = list.find(u => {
    const uNom = (u.nombre || '').toLowerCase()
    return uNom.includes(clean) || clean.includes(uNom)
  })
  if (partial) return partial

  // Por primer nombre
  const firstName = clean.split(' ')[0]
  if (firstName && firstName.length >= 3) {
    const fnMatch = list.find(u => (u.nombre || '').toLowerCase().startsWith(firstName))
    if (fnMatch) return fnMatch
  }

  return null
}

/**
 * Infiere índices de columnas si no existe fila explícita de cabecera
 */
function inferColumnIndices(rows) {
  if (!rows || rows.length === 0) return {}

  const colCount = Math.max(...rows.map(r => r.length))
  const colScores = Array.from({ length: colCount }, () => ({
    pax: 0,
    name: 0,
    agency: 0,
    city: 0,
    room: 0,
    hotel: 0,
    money: 0
  }))

  rows.forEach((row) => {
    row.forEach((cell, cIdx) => {
      const val = String(cell || '').trim()
      if (!val) return

      if (/^\d{1,3}$/.test(val) && parseInt(val, 10) <= 150) colScores[cIdx].pax += 3
      if (isCity(val)) colScores[cIdx].city += 4
      if (isRoom(val)) colScores[cIdx].room += 4
      if (/^\$?\d+([.,]\d+)?$/.test(val) && !val.startsWith('09')) colScores[cIdx].money += 2
      if (/hotel|resort|para[ií]so|gimani|decameron|baru|hilton/i.test(val)) colScores[cIdx].hotel += 4
      if (/tours?|travel|viajes|solcaribe|polimundo|inova/i.test(val)) colScores[cIdx].agency += 4
      if (/^[a-záéíóúñ\s]{3,35}$/i.test(val) && !isRoom(val) && !isCity(val)) {
        colScores[cIdx].name += 1
      }
    })
  })

  const pickBest = (prop, exclude = []) => {
    let bestIdx = -1
    let bestScore = 0
    colScores.forEach((s, idx) => {
      if (exclude.includes(idx)) return
      if (s[prop] > bestScore) {
        bestScore = s[prop]
        bestIdx = idx
      }
    })
    return bestScore > 0 ? bestIdx : -1
  }

  const assigned = []
  const idxPax = pickBest('pax', assigned)
  if (idxPax !== -1) assigned.push(idxPax)

  const idxCity = pickBest('city', assigned)
  if (idxCity !== -1) assigned.push(idxCity)

  const idxRoom = pickBest('room', assigned)
  if (idxRoom !== -1) assigned.push(idxRoom)

  const idxHotel = pickBest('hotel', assigned)
  if (idxHotel !== -1) assigned.push(idxHotel)

  const idxAgency = pickBest('agency', assigned)
  if (idxAgency !== -1) assigned.push(idxAgency)

  const idxName = pickBest('name', assigned)
  if (idxName !== -1) assigned.push(idxName)

  const moneyIndices = []
  colScores.forEach((s, idx) => {
    if (!assigned.includes(idx) && s.money > 0) {
      moneyIndices.push(idx)
    }
  })

  return {
    idxPax,
    idxName,
    idxAgency,
    idxCity,
    idxRoom,
    idxHotel,
    moneyIndices
  }
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

  let idxPax = -1
  let idxNom = -1
  let idxAge = -1
  let idxCiu = -1
  let idxHab = -1
  let idxOpe = -1
  let idxCom = -1
  let idxHot = -1
  let idxAb1 = -1
  let idxAb2 = -1
  let idxAb3 = -1
  let idxObs = -1
  let moneyIndices = []

  let dataStartRow = 0

  if (headerIndex !== -1) {
    dataStartRow = headerIndex + 1
    idxPax = headers.findIndex(c => c.includes('pax') || c.includes('cupo') || c.includes('#'))
    idxNom = headers.findIndex(c => c.includes('nombre') || c.includes('pasajero') || c.includes('cliente'))
    idxAge = headers.findIndex(c => c.includes('agencia'))
    idxCiu = headers.findIndex(c => c.includes('ciudad') || c.includes('origen'))
    idxHab = headers.findIndex(c => c.includes('land') || c.includes('hab') || c.includes('acomodacion') || c.includes('tour'))
    idxOpe = headers.findIndex(c => c.includes('operativo') || c.includes('operador'))
    idxCom = headers.findIndex(c => c.includes('comercial') || c.includes('asesor') || c.includes('vendedor'))
    idxHot = headers.findIndex(c => c.includes('hotel'))
    idxAb1 = headers.findIndex(c => c.includes('abono 1') || c.includes('abono1') || c.includes('pago 1'))
    idxAb2 = headers.findIndex(c => c.includes('abono 2') || c.includes('abono2') || c.includes('pago 2'))
    idxAb3 = headers.findIndex(c => c.includes('abono 3') || c.includes('abono3') || c.includes('pago 3'))
    idxObs = headers.findIndex(c => c.includes('obs') || c.includes('nota') || c.includes('comentario'))
  } else {
    // Si no tiene cabecera, inferir columnas por tipo de dato en las filas
    const inferred = inferColumnIndices(rows)
    dataStartRow = 0
    idxPax = inferred.idxPax ?? -1
    idxNom = inferred.idxName ?? -1
    idxAge = inferred.idxAgency ?? -1
    idxCiu = inferred.idxCity ?? -1
    idxHab = inferred.idxRoom ?? -1
    idxHot = inferred.idxHotel ?? -1
    moneyIndices = inferred.moneyIndices || []
  }

  const passengers = []
  const hotelsSet = new Set()
  let maxCupo = 0
  let totalAbonado = 0

  for (let i = dataStartRow; i < rows.length; i++) {
    const cols = (rows[i] || []).map(c => String(c || '').trim().replace(/^\|+/, '').trim())
    if (cols.length === 0 || cols.every(c => c === '')) continue

    const rawPax = idxPax !== -1 ? cols[idxPax] : ''
    let paxNum = parseInt(rawPax, 10)
    if (!isNaN(paxNum) && paxNum > maxCupo) maxCupo = paxNum

    const rawName = idxNom !== -1 ? cols[idxNom] : ''
    let nombres = cleanPassengerName(rawName)

    const rawAgency = (idxAge !== -1 ? cols[idxAge] : '') || ''
    const agencia = rawAgency.trim() || 'Directo'

    // Si el nombre viene como guión o vacío pero hay agencia, se trata de una reserva para esa agencia
    if (!nombres) {
      if (rawAgency && rawAgency.toLowerCase() !== 'directo' && rawAgency !== '-') {
        nombres = `${rawAgency.toUpperCase()} (POR ASIGNAR)`
      } else {
        // Fila completamente vacía o sin pasajero ni agencia
        continue
      }
    }

    if (isNaN(paxNum) || paxNum <= 0) {
      paxNum = passengers.length + 1
    }
    if (paxNum > maxCupo) maxCupo = paxNum

    const ciudad = (idxCiu !== -1 ? cols[idxCiu] : '') || 'GYE'
    const habRaw = idxHab !== -1 ? cols[idxHab] : ''
    const roomType = detectRoomType(habRaw)

    const operativo = (idxOpe !== -1 ? cols[idxOpe] : '') || ''
    const comercial = (idxCom !== -1 ? cols[idxCom] : '') || ''
    const hotel = (idxHot !== -1 ? cols[idxHot] : '') || ''

    if (hotel && !hotel.startsWith('$') && !/^\d+$/.test(hotel)) {
      hotelsSet.add(hotel.trim().toUpperCase())
    }

    let abono1 = 0
    let abono2 = 0
    let abono3 = 0

    if (headerIndex !== -1) {
      abono1 = cleanMoney(idxAb1 !== -1 ? cols[idxAb1] : 0)
      abono2 = cleanMoney(idxAb2 !== -1 ? cols[idxAb2] : 0)
      abono3 = cleanMoney(idxAb3 !== -1 ? cols[idxAb3] : 0)
    } else if (moneyIndices.length > 0) {
      abono1 = cleanMoney(cols[moneyIndices[0]] || 0)
      if (moneyIndices[1]) abono2 = cleanMoney(cols[moneyIndices[1]] || 0)
      if (moneyIndices[2]) abono3 = cleanMoney(cols[moneyIndices[2]] || 0)
    }

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

  if (passengers.length === 0) return null

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
 * Parsea una sola línea o celda copiada para el formulario individual de pasajero
 */
export function parseSinglePassengerInput(text, { operativosList = [], comercialesList = [], configuredHoteles = [] } = {}) {
  if (!text || typeof text !== 'string') return null
  const cleanLine = text.trim().replace(/^[-–—\|,\s]+|[-–—\|,\s]+$/g, '')
  if (!cleanLine) return null

  let parts = []
  if (cleanLine.includes('\t')) {
    parts = cleanLine.split('\t').map(p => p.trim())
  } else if (cleanLine.includes('|')) {
    parts = cleanLine.split('|').map(p => p.trim())
  } else if (cleanLine.includes(';') || cleanLine.includes(',')) {
    parts = cleanLine.split(/[;,]/).map(p => p.trim())
  } else {
    // Formato de lista: "1. Carlos Mendoza 0923847581 Doble GYE..."
    parts = cleanLine.replace(/^\d+[\.\-\)]\s*/, '').split(/\s+/)
  }

  parts = parts.filter(p => p && p !== '-' && p !== '|' && p !== '/')

  const detected = {
    nombres: '',
    apellidos: '',
    tipo_documento: 'Cédula',
    numero_documento: '',
    agencia: '',
    ciudad: '',
    tipo_habitacion: 'Doble',
    hoteles: '',
    operativo_id: '',
    operativo_nombre: '',
    comercial_id: '',
    comercial_nombre: '',
    abonos: [],
    observaciones: '',
    detectedFields: []
  }

  const unassignedParts = []

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    // Ignorar número de cupo inicial (ej. "1", "16")
    if (i === 0 && /^\d{1,3}$/.test(p) && parts.length > 2) {
      continue
    }

    if (!detected.numero_documento && isDoc(p)) {
      detected.numero_documento = p
      detected.tipo_documento = /^\d{10}$/.test(p) ? 'Cédula' : 'Pasaporte'
      detected.detectedFields.push('documento')
    } else if (!detected.ciudad && isCity(p)) {
      detected.ciudad = p.toUpperCase()
      detected.detectedFields.push('ciudad')
    } else if (isRoom(p)) {
      detected.tipo_habitacion = detectRoomType(p)
      detected.detectedFields.push('tipo_habitacion')
    } else if (/^\$?\d+([.,]\d+)?$/.test(p) && !p.startsWith('09')) {
      const num = cleanMoney(p)
      if (num > 0) {
        detected.abonos.push(num)
        detected.detectedFields.push('abono')
      }
    } else if (/hotel|resort|para[ií]so|gimani|decameron|hilton|marriott|radisson|bar[uú]/i.test(p)) {
      detected.hoteles = p.toUpperCase()
      detected.detectedFields.push('hoteles')
    } else if (/tours?|travel|viajes|solcaribe|polimundo|inova/i.test(p)) {
      detected.agencia = p.toUpperCase()
      detected.detectedFields.push('agencia')
    } else {
      // Intentar coincidir con operativo o comercial
      const opMatch = matchTeamMember(p, operativosList)
      const comMatch = matchTeamMember(p, comercialesList)
      if (opMatch && !detected.operativo_id) {
        detected.operativo_id = opMatch.id
        detected.operativo_nombre = opMatch.nombre
        detected.detectedFields.push('operativo')
      } else if (comMatch && !detected.comercial_id) {
        detected.comercial_id = comMatch.id
        detected.comercial_nombre = comMatch.nombre
        detected.detectedFields.push('comercial')
      } else {
        unassignedParts.push(p)
      }
    }
  }

  // De las partes no asignadas, extraer Nombres y Apellidos
  if (unassignedParts.length > 0) {
    if (!detected.nombres) {
      const nameCandidate = unassignedParts.shift()
      const words = nameCandidate.split(/\s+/)
      if (words.length >= 2) {
        detected.nombres = words.slice(0, Math.ceil(words.length / 2)).join(' ').toUpperCase()
        detected.apellidos = words.slice(Math.ceil(words.length / 2)).join(' ').toUpperCase()
      } else {
        detected.nombres = nameCandidate.toUpperCase()
        if (unassignedParts.length > 0 && !/^(SI|NO|OK)$/i.test(unassignedParts[0])) {
          detected.apellidos = unassignedParts.shift().toUpperCase()
        }
      }
      detected.detectedFields.push('nombres')
    }

    if (!detected.agencia && unassignedParts.length > 0) {
      const next = unassignedParts.shift()
      if (!/^(SI|NO|OK)$/i.test(next)) {
        detected.agencia = next.toUpperCase()
        detected.detectedFields.push('agencia')
      }
    }

    if (unassignedParts.length > 0) {
      detected.observaciones = unassignedParts.join(' ').trim()
      detected.detectedFields.push('observaciones')
    }
  }

  return detected
}

/**
 * Parsea texto directo copiado de Excel, Google Sheets, WhatsApp o archivo .csv
 */
export function parseBloqueoText(text) {
  if (!text || typeof text !== 'string') return null
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

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
