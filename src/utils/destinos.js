import airportsData from '@/data/airports.json'

export const cityIataMap = {
  "JUL": "PUN",
  "ICA": "PIO",
  "VVI": "SRZ",
  "GRU": "SAO",
  "GIG": "RIO",
  "CNF": "BHZ",
  "EZE": "BUE",
    "JFK": "NYC",
  "ORD": "CHI",
  "MCO": "ORL",
  "IAD": "WAS",
  "IAH": "HOU",
  "YYZ": "YTO",
  "YUL": "YMQ",
  "YEG": "YEA",
  "TFN": "TCI",
  "CDG": "PAR",
  "FCO": "ROM",
  "MXP": "MIL",
  "LHR": "LON",
  "OST": "BRG",
  "ARN": "STO",
  "KEF": "REK",
  "SVO": "MOW",
  "ESB": "ANK",
  "NRT": "TYO",
  "KIX": "OSA",
  "CTS": "SPK",
  "PEK": "BJS",
  "PVG": "SHA",
  "XIY": "SIA",
  "ICN": "SEL",
  "DAD": "HOI",
  "VDO": "HHP",
  "CGK": "JKT",
  "IKA": "THR",
  "GYD": "BAK",
  "CMN": "CAS",
  "JRO": "ARK",
  "EBB": "KLA",
  "MQP": "NLP"
};

export const countryCodeMap = {
  "ECUADOR": "ECU",
  "COLOMBIA": "COL",
  "PERÚ": "PER",
  "BOLIVIA": "BOL",
  "VENEZUELA": "VEN",
  "BRASIL": "BRA",
  "CHILE": "CHL",
  "ARGENTINA": "ARG",
  "URUGUAY": "URY",
  "PARAGUAY": "PRY",
  "GUYANA": "GUY",
  "SURINAM": "SUR",
  "GUYANA FRANCESA": "GUF",
  "REP. DOMINICANA": "DOM",
  "CUBA": "CUB",
  "JAMAICA": "JAM",
  "PUERTO RICO": "PRI",
  "HAITI": "HTI",
  "ARUBA": "ABW",
  "CURAZAO": "CUW",
  "BONAIRE": "BES",
  "BARBADOS": "BRB",
  "TRINIDAD Y TOBAGO": "TTO",
  "SAN MARTÍN": "SXM",
  "BAHAMAS": "BHS",
  "ISLAS CAIMÁN": "CYM",
  "ANTIGUA Y BARBUDA": "ATG",
  "GRANADA": "GRD",
  "GUADALUPE": "GLP",
  "MARTINICA": "MTQ",
  "ISLAS VÍRGENES EEUU": "VIR",
  "ISLAS TURCAS Y CAICOS": "TCA",
  "MÉXICO": "MEX",
  "GUATEMALA": "GTM",
  "BELICE": "BLZ",
  "HONDURAS": "HND",
  "EL SALVADOR": "SLV",
  "NICARAGUA": "NIC",
  "COSTA RICA": "CRI",
  "PANAMÁ": "PAN",
  "ESTADOS UNIDOS": "USA",
  "CANADÁ": "CAN",
  "ESPAÑA": "ESP",
  "PORTUGAL": "PRT",
  "FRANCIA": "FRA",
  "ITALIA": "ITA",
  "REINO UNIDO": "GBR",
  "IRLANDA": "IRL",
  "ALEMANIA": "DEU",
  "AUSTRIA": "AUT",
  "SUIZA": "CHE",
  "PAÍSES BAJOS": "NLD",
  "BÉLGICA": "BEL",
  "LUXEMBURGO": "LUX",
  "NORUEGA": "NOR",
  "SUECIA": "SWE",
  "DINAMARCA": "DNK",
  "FINLANDIA": "FIN",
  "ISLANDIA": "ISL",
  "REP. CHECA": "CZE",
  "HUNGRÍA": "HUN",
  "ESLOVAQUIA": "SVK",
  "POLONIA": "POL",
  "RUMANIA": "ROU",
  "BULGARIA": "BGR",
  "SERBIA": "SRB",
  "RUSIA": "RUS",
  "UCRANIA": "UKR",
  "GRECIA": "GRC",
  "TURQUÍA": "TUR",
  "CROACIA": "HRV",
  "ESLOVENIA": "SVN",
  "MONTENEGRO": "MNE",
  "ALBANIA": "ALB",
  "BOSNIA Y HERZEGOVINA": "BIH",
  "MALTA": "MLT",
  "CHIPRE": "CYP",
  "JAPÓN": "JPN",
  "CHINA": "CHN",
  "COREA DEL SUR": "KOR",
  "HONG KONG": "HKG",
  "MACAO": "MAC",
  "TAIWÁN": "TWN",
  "MONGOLIA": "MNG",
  "TAILANDIA": "THA",
  "VIETNAM": "VNM",
  "INDONESIA": "IDN",
  "MALASIA": "MYS",
  "SINGAPUR": "SGP",
  "FILIPINAS": "PHL",
  "CAMBOYA": "KHM",
  "MYANMAR": "MMR",
  "LAOS": "LAO",
  "INDIA": "IND",
  "SRI LANKA": "LKA",
  "NEPAL": "NPL",
  "MALDIVAS": "MDV",
  "BUTÁN": "BTN",
  "PAKISTÁN": "PAK",
  "EMIRATOS ÁRABES UNIDOS": "ARE",
  "QATAR": "QAT",
  "ARABIA SAUDITA": "SAU",
  "ISRAEL": "ISR",
  "JORDANIA": "JOR",
  "OMÁN": "OMN",
  "KUWAIT": "KWT",
  "BARÉIN": "BHR",
  "LÍBANO": "LBN",
  "IRÁN": "IRN",
  "UZBEKISTÁN": "UZB",
  "KAZAJISTÁN": "KAZ",
  "AZERBAIYÁN": "AZE",
  "GEORGIA": "GEO",
  "ARMENIA": "ARM",
  "AUSTRALIA": "AUS",
  "NUEVA ZELANDA": "NZL",
  "POLINESIA FRANCESA": "PYF",
  "FIYI": "FJI",
  "VANUATU": "VUT",
  "SAMOA": "WSM",
  "ISLAS COOK": "COK",
  "HAWÁI (USA)": "USA",
  "MARRUECOS": "MAR",
  "EGIPTO": "EGY",
  "TÚNEZ": "TUN",
  "ARGELIA": "DZA",
  "KENIA": "KEN",
  "TANZANIA": "TZA",
  "UGANDA": "UGA",
  "RUANDA": "RWA",
  "ETIOPÍA": "ETH",
  "MADAGASCAR": "MDG",
  "SEYCHELLES": "SYC",
  "MAURICIO": "MUS",
  "REUNIÓN": "REU",
  "SUDÁFRICA": "ZAF",
  "ZIMBABUE": "ZWE",
  "ZAMBIA": "ZMB",
  "BOTSUANA": "BWA",
  "NAMIBIA": "NAM",
  "MOZAMBIQUE": "MOZ",
  "GHANA": "GHA",
  "NIGERIA": "NGA",
  "SENEGAL": "SEN",
  "COSTA DE MARFIL": "CIV",
  "CABO VERDE": "CPV",
  "CAMERÚN": "CMR",
  "CONGO RD": "COD",
  "ANGOLA": "AGO"
};

export const reverseCityIataMap = Object.entries(cityIataMap).reduce((acc, [apt, city]) => {
  // Only map the first airport encountered back to the city to avoid overriding
  if (!acc[city]) {
    acc[city] = apt;
  }
  return acc;
}, {});

export const formatIataWithCountry = (iataStr) => {
  if (!iataStr) return ''
  const iatas = iataStr.split(',')
  return iatas.map(code => {
    let cleanCode = code.trim().toUpperCase()
    
    // Normalize airport code to city code if necessary (e.g. PTY -> PAC, EZE -> BUE)
    if (cityIataMap[cleanCode]) {
      cleanCode = cityIataMap[cleanCode]
    }
    
    // Look up via airport if it's a known city code to find the country
    const lookupCode = reverseCityIataMap[cleanCode] || cleanCode
    
    let apt = airportsData.find(a => a.iata.toUpperCase() === lookupCode)
    if (!apt) {
      apt = airportsData.find(a => a.city.toUpperCase() === cleanCode)
    }

    if (apt) {
      const cCode = apt.iso || countryCodeMap[apt.country.toUpperCase()] || apt.country.substring(0, 3).toUpperCase()
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
