import React, { useState, useEffect, useRef, useMemo } from 'react'
import { MapPin, X } from 'lucide-react'
import airportsData from '@/data/airports.json'
import { cityIataMap } from '@/utils/destinos'

export default function IataSelector({ value = '', onChange, placeholder = 'Buscar ciudad o IATA...' }) {
  const [query, setQuery] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)
  
  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredAirports = useMemo(() => {
    if (!query || query.length < 2) return []
    const lowerQuery = query.toLowerCase()
    
    // Exact match for IATA gets priority
    if (query.length === 3) {
      const exactMatch = airportsData.find(a => a.iata.toLowerCase() === lowerQuery)
      if (exactMatch) {
        return [exactMatch, ...airportsData.filter(a => 
          a.iata.toLowerCase() !== lowerQuery && (
            a.city.toLowerCase().includes(lowerQuery) ||
            a.country.toLowerCase().includes(lowerQuery)
          )
        )].slice(0, 50)
      }
    }
    
    return airportsData.filter(a => 
      a.iata.toLowerCase().includes(lowerQuery) || 
      a.city.toLowerCase().includes(lowerQuery) ||
      a.country.toLowerCase().includes(lowerQuery)
    ).slice(0, 50)
  }, [query])

  const handleSelect = (airport) => {
    // Show city IATA code if one exists, otherwise the airport IATA
    const newVal = cityIataMap[airport.iata.toUpperCase()] || airport.iata.toUpperCase()
    setQuery(newVal)
    onChange(newVal)
    setIsOpen(false)
  }

  const handleInputChange = (e) => {
    const val = e.target.value.toUpperCase()
    setQuery(val)
    onChange(val)
    setIsOpen(true)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
        <input
          type="text"
          className="input pl-9 uppercase font-black tracking-wider w-full bg-white border border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          maxLength={30}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              onChange('')
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 transition-colors bg-white p-1 rounded-full"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && query && filteredAirports.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-64 overflow-y-auto overflow-x-hidden">
          {filteredAirports.map((airport, idx) => (
            <button
              key={`${airport.iata}-${idx}`}
              type="button"
              onClick={() => handleSelect(airport)}
              className="w-full text-left px-4 py-3 hover:bg-primary/5 border-b border-gray-50 last:border-0 flex items-start gap-3 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="font-black text-primary text-sm">{airport.iata}</span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-bold text-gray-900 text-sm leading-tight truncate">{airport.city}</p>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1 truncate">{airport.country}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {isOpen && query && query.length >= 2 && filteredAirports.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 text-center">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-relaxed">
            Sin resultados.<br/>Se guardará como texto libre.
          </p>
        </div>
      )}
    </div>
  )
}
