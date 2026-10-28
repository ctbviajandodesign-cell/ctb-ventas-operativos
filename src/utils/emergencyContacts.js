export const parseEmergencyContacts = (raw) => {
  if (!raw || typeof raw !== 'string') return [{ id: 1, nombre: '', telefono: '' }]

  const trimmed = raw.trim()

  // Unambiguous structured JSON format
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((c, i) => ({
          id: Date.now() + i,
          nombre: c.nombre || '',
          telefono: c.telefono || ''
        }))
      }
    } catch {
      // fallback to legacy parser below
    }
  }

  // Legacy parser for existing rows and unstructured strings
  let lines = []
  if (raw.includes('\n')) {
    lines = raw.split('\n')
  } else {
    // Only split by ' / ' if there are multiple parts that look like separate contacts
    const slashParts = raw.split(' / ')
    const countWithPhoneOrColon = slashParts.filter(p => p.includes(':') || /\d{5,}/.test(p)).length
    if (slashParts.length > 1 && countWithPhoneOrColon >= 2) {
      lines = slashParts
    } else {
      lines = [raw]
    }
  }

  const parsed = lines.map((line, idx) => {
    const item = line.trim()
    if (!item) return null

    // Pure phone number (mostly digits or symbols: +, -, (), spaces)
    if (/^[\d\s().+-]{6,}$/.test(item)) {
      return { id: Date.now() + idx, nombre: '', telefono: item }
    }

    if (item.includes(':')) {
      const colons = []
      for (let i = 0; i < item.length; i++) {
        if (item[i] === ':') colons.push(i)
      }
      let delimIdx = colons[0]
      for (let i = colons.length - 1; i >= 0; i--) {
        const rightSide = item.slice(colons[i] + 1).trim()
        if (/^[\d\s().+-]{6,}$/.test(rightSide)) {
          delimIdx = colons[i]
          break
        }
      }
      return {
        id: Date.now() + idx,
        nombre: item.slice(0, delimIdx).trim(),
        telefono: item.slice(delimIdx + 1).trim()
      }
    }

    // Legacy fallback: "Nombre - Telefono" where second part looks like a phone number
    const dashMatch = item.match(/^(.*?)\s*-\s*(\+?[\d\s().-]{6,})$/)
    if (dashMatch) {
      return {
        id: Date.now() + idx,
        nombre: dashMatch[1].trim(),
        telefono: dashMatch[2].trim()
      }
    }

    // Otherwise treat as destination / name
    return {
      id: Date.now() + idx,
      nombre: item,
      telefono: ''
    }
  }).filter(Boolean)

  return parsed.length > 0 ? parsed : [{ id: 1, nombre: '', telefono: '' }]
}

export const formatEmergencyContacts = (list) => {
  if (!Array.isArray(list)) return ''
  const valid = list
    .map(c => ({
      nombre: (c.nombre || '').trim(),
      telefono: (c.telefono || '').trim()
    }))
    .filter(c => c.nombre || c.telefono)

  if (valid.length === 0) return ''
  return JSON.stringify(valid)
}
