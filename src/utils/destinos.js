import airportsData from '@/data/airports.json'

export const formatIataWithCountry = (iataStr) => {
  if (!iataStr) return ''
  const iatas = iataStr.split(',')
  return iatas.map(code => {
    const cleanCode = code.trim().toUpperCase()
    const apt = airportsData.find(a => a.iata.toUpperCase() === cleanCode)
    if (apt && apt.country) {
      const cCode = apt.country.substring(0, 3).toUpperCase()
      return `${cleanCode} (${cCode})`
    }
    return cleanCode
  }).filter(Boolean).join(' + ')
}

export const formatDestinoString = (raw) => {
  if (!raw) return 'S/D'
  if (raw.includes('|')) {
    const [iatas, name] = raw.split('|')
    const formattedIatas = formatIataWithCountry(iatas)
    if (name && formattedIatas) return `${formattedIatas} - ${name}`
    if (name) return name
    return formattedIatas
  }
  return formatIataWithCountry(raw)
}

export const matchesDestinoFilter = (destinoRaw, filterText) => {
  if (!filterText) return true
  if (!destinoRaw) return false
  
  const search = filterText.toLowerCase().trim()
  const [iatas, name] = destinoRaw.includes('|') ? destinoRaw.split('|') : [destinoRaw, '']
  
  // match name
  if (name && name.toLowerCase().includes(search)) return true
  
  // match iatas, countries, cities
  if (iatas) {
    const codes = iatas.split(',')
    for (const code of codes) {
      const cleanCode = code.trim().toUpperCase()
      if (cleanCode.toLowerCase().includes(search)) return true
      
      const apt = airportsData.find(a => a.iata.toUpperCase() === cleanCode)
      if (apt) {
        if (apt.country && apt.country.toLowerCase().includes(search)) return true
        if (apt.city && apt.city.toLowerCase().includes(search)) return true
        if (apt.name && apt.name.toLowerCase().includes(search)) return true
      }
    }
  }
  return false
}
