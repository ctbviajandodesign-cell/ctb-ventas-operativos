import airportsData from '@/data/airports.json'

export const cityIataMap = {
  'EZE': 'BUE', // Ezeiza -> Buenos Aires
  'AEP': 'BUE', // Aeroparque -> Buenos Aires
  'JFK': 'NYC', // JFK -> New York
  'LGA': 'NYC',
  'EWR': 'NYC',
  'LHR': 'LON', // Heathrow -> London
  'LGW': 'LON',
  'CDG': 'PAR', // Charles de Gaulle -> Paris
  'ORY': 'PAR',
  'GRU': 'SAO', // Guarulhos -> Sao Paulo
  'CGH': 'SAO',
  'VCP': 'SAO',
  'GIG': 'RIO', // Galeao -> Rio de Janeiro
  'SDU': 'RIO'
}

export const reverseCityIataMap = {
  'BUE': 'EZE',
  'NYC': 'JFK',
  'LON': 'LHR',
  'PAR': 'CDG',
  'SAO': 'GRU',
  'RIO': 'GIG'
}

export const formatIataWithCountry = (iataStr) => {
  if (!iataStr) return ''
  const iatas = iataStr.split(',')
  return iatas.map(code => {
    const cleanCode = code.trim().toUpperCase()
    
    // Look up via airport if it's a known city code
    const lookupCode = reverseCityIataMap[cleanCode] || cleanCode
    
    let apt = airportsData.find(a => a.iata.toUpperCase() === lookupCode)
    if (!apt) {
      apt = airportsData.find(a => a.city.toUpperCase() === cleanCode)
    }

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
