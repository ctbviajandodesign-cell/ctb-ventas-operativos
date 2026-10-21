'use client'

import React, { useState, useEffect } from 'react'
import { 
  Hotel, Plus, Trash2, BedDouble, Bed, Star, Utensils, 
  ChevronDown, ChevronUp, Sparkles, DollarSign, Info,
  CheckCircle2, AlertTriangle, AlertCircle, Users, Scale,
  Check
} from 'lucide-react'
import { showToast } from '@/utils/toast'

const CATEGORIAS_HOTEL = [
  'Clase 1 (Económica / 3★)',
  'Clase 2 (Estándar / 4★)',
  'Clase 3 (Superior / 5★)',
  'Clase VIP / Luxury'
]

const REGIMENES_COMIDA = [
  'Todo Incluido (All Inclusive)',
  'Desayunos Buffet Diarios',
  'Media Pensión (Desayuno + Cena)',
  'Solo Alojamiento (Sin comidas)',
  'Pensión Completa'
]

const TIPOS_HABITACION_SUGERIDOS = [
  'Doble',
  'Simple (SGL)',
  'Triple',
  'Matrimonial',
  'Twin',
  'Cuádruple',
  'Familiar',
  'Niño (2 a 11 años)',
  'Infante (0 a 1 año)'
]

export default function BloqueoHotelesConfig({ 
  hoteles: rawHoteles = [], 
  onChange, 
  precioBaseSugerido = 0,
  cuposTotalesBloqueo = 30
}) {
  // Normalize and parse hoteles prop safely (handles null, undefined, JSON string, or non-array)
  let hoteles = []
  if (Array.isArray(rawHoteles)) {
    hoteles = rawHoteles.filter(Boolean)
  } else if (typeof rawHoteles === 'string' && rawHoteles.trim() !== '') {
    try {
      const parsed = JSON.parse(rawHoteles)
      if (Array.isArray(parsed)) hoteles = parsed.filter(Boolean)
    } catch {}
  }

  const [isHotelMode, setIsHotelMode] = useState(hoteles.length > 0)
  const [expandedHotelId, setExpandedHotelId] = useState(hoteles[0]?.id || null)

  useEffect(() => {
    const hasHoteles = hoteles.length > 0
    setIsHotelMode(hasHoteles)
    if (hasHoteles) {
      if (!expandedHotelId || !hoteles.some(h => h && h.id === expandedHotelId)) {
        setExpandedHotelId(hoteles[0]?.id || null)
      }
    }
  }, [hoteles.length, expandedHotelId])

  const totalGeneral = Number(cuposTotalesBloqueo) || 30
  const hasOpenHotel = hoteles.some(h => !h.cupos || Number(h.cupos) === 0)
  const allOpen = hoteles.length > 0 && hoteles.every(h => !h.cupos || Number(h.cupos) === 0)
  const totalConCupoFijo = hoteles.reduce((acc, h) => acc + (Number(h?.cupos) || 0), 0)
  const isMatchExacto = !hasOpenHotel && totalConCupoFijo === totalGeneral
  const isOverLimit = totalConCupoFijo > totalGeneral
  const cuposFaltantes = totalGeneral - totalConCupoFijo
  const hasIncompleteHotel = hoteles.some(h => !h || !h.nombre || String(h.nombre).trim() === '')

  const handleAddHotel = () => {
    if (hasIncompleteHotel) {
      showToast('Completa el nombre del hotel actual antes de agregar otro.', 'warning')
      return
    }
    const newId = `hotel_${Date.now()}`
    const basePrice = Number(precioBaseSugerido) || 750
    // Si los hoteles anteriores están en cupo abierto, el nuevo inicia en cupo abierto (0)
    const initialCupos = (hoteles.length > 0 && (allOpen || hasOpenHotel)) ? 0 : (cuposFaltantes > 0 ? cuposFaltantes : 0)

    const newHotel = {
      id: newId,
      nombre: '',
      categoria: 'Clase 2 (Estándar / 4★)',
      regimen: 'Todo Incluido (All Inclusive)',
      cupos: initialCupos,
      notas: '',
      habitaciones: [
        { id: `hab_${Date.now()}_1`, tipo: 'Doble', precio: basePrice, cupos: 0 },
        { id: `hab_${Date.now()}_2`, tipo: 'Simple (SGL)', precio: Math.round(basePrice * 1.25), cupos: 0 },
        { id: `hab_${Date.now()}_3`, tipo: 'Triple', precio: basePrice, cupos: 0 },
        { id: `hab_${Date.now()}_4`, tipo: 'Matrimonial', precio: basePrice, cupos: 0 }
      ]
    }
    const updated = [...hoteles, newHotel]
    onChange(updated)
    setExpandedHotelId(newId)
  }

  const handleRemoveHotel = (id) => {
    const updated = hoteles.filter(h => h.id !== id)
    onChange(updated)
    if (updated.length === 0) {
      setIsHotelMode(false)
    } else if (expandedHotelId === id) {
      setExpandedHotelId(updated[0].id)
    }
  }

  const handleDisableHotelMode = () => {
    if (hoteles.length > 0) {
      if (!confirm('¿Deseas quitar los hoteles configurados y volver al modo básico general?')) {
        return
      }
    }
    setIsHotelMode(false)
    onChange([])
  }

  const handleEnableHotelMode = () => {
    setIsHotelMode(true)
    if (!hoteles || hoteles.length === 0) {
      handleAddHotel()
    }
  }

  const handleUpdateHotel = (id, field, value) => {
    const updated = hoteles.map(h => {
      if (h.id === id) {
        return { 
          ...h, 
          [field]: field === 'cupos' ? Math.max(0, Number(value) || 0) : value 
        }
      }
      return h
    })
    onChange(updated)
  }

  // Auto-distribuir equitativamente los cupos entre todos los hoteles
  const handleAutoDistribute = () => {
    if (hoteles.length === 0) return
    const perHotel = Math.floor(totalGeneral / hoteles.length)
    let remainder = totalGeneral % hoteles.length

    const updated = hoteles.map(h => {
      const extra = remainder > 0 ? 1 : 0
      if (remainder > 0) remainder -= 1
      return { ...h, cupos: perHotel + extra }
    })
    onChange(updated)
  }

  // Asignar cupos faltantes a un hotel específico
  const handleAssignRemainingToHotel = (hotelId) => {
    const otherSum = hoteles.filter(h => h.id !== hotelId).reduce((acc, h) => acc + (Number(h.cupos) || 0), 0)
    const needed = Math.max(0, totalGeneral - otherSum)
    const updated = hoteles.map(h => h.id === hotelId ? { ...h, cupos: needed } : h)
    onChange(updated)
  }

  const handleAddRoom = (hotelId, tipo = 'Doble') => {
    const basePrice = Number(precioBaseSugerido) || 0
    const defaultPrice = tipo.includes('Simple') 
      ? Math.round(basePrice * 1.25) 
      : tipo.includes('Niño') 
        ? Math.round(basePrice * 0.7) 
        : tipo.includes('Infante')
          ? 0
          : basePrice

    const newHab = {
      id: `hab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tipo: tipo,
      precio: defaultPrice,
      cupos: 0
    }

    const updated = hoteles.map(h => {
      if (h.id === hotelId) {
        return { ...h, habitaciones: [...(h.habitaciones || []), newHab] }
      }
      return h
    })
    onChange(updated)
  }

  const handleLoadStandardRooms = (hotelId) => {
    const hotelObj = hoteles.find(h => h.id === hotelId)
    const hotelCupos = Number(hotelObj?.cupos) || 0
    const basePrice = Number(precioBaseSugerido) || 750

    const standardRooms = [
      { id: `hab_${Date.now()}_1`, tipo: 'Doble', precio: basePrice, cupos: Math.round(hotelCupos * 0.7) },
      { id: `hab_${Date.now()}_2`, tipo: 'Simple (SGL)', precio: Math.round(basePrice * 1.25), cupos: Math.max(0, hotelCupos - Math.round(hotelCupos * 0.7)) },
      { id: `hab_${Date.now()}_3`, tipo: 'Triple', precio: basePrice, cupos: 0 },
      { id: `hab_${Date.now()}_4`, tipo: 'Matrimonial', precio: basePrice, cupos: 0 }
    ]

    const updated = hoteles.map(h => {
      if (h.id === hotelId) {
        return { ...h, habitaciones: standardRooms }
      }
      return h
    })
    onChange(updated)
  }

  const handleUpdateRoom = (hotelId, roomId, field, value) => {
    const updated = hoteles.map(h => {
      if (h.id === hotelId) {
        const habs = (h.habitaciones || []).map(r => {
          if (r.id === roomId) {
            return { 
              ...r, 
              [field]: (field === 'precio' || field === 'cupos') ? Number(value) || 0 : value 
            }
          }
          return r
        })
        return { ...h, habitaciones: habs }
      }
      return h
    })
    onChange(updated)
  }

  const handleRemoveRoom = (hotelId, roomId) => {
    const updated = hoteles.map(h => {
      if (h.id === hotelId) {
        return { ...h, habitaciones: (h.habitaciones || []).filter(r => r.id !== roomId) }
      }
      return h
    })
    onChange(updated)
  }

  if (!isHotelMode || !hoteles || hoteles.length === 0) {
    return (
      <div className="bg-white/80 p-4 rounded-2xl border border-dashed border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
            <Hotel size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-gray-900">
                Hoteles & Habitaciones (Opcional)
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Modo Básico Activo
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
              Este bloqueo se gestionará con el precio de venta y cupos generales del viaje (como antes). Si deseas detallar hoteles específicos, tipos de habitación y cupos por hotel, actívalo a continuación.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleEnableHotelMode}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all shrink-0 whitespace-nowrap"
        >
          <Plus size={15} /> + Detallar Hoteles & Habitaciones
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Encabezado de Sección */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Hotel size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                Hoteles, Habitaciones & Espacios Disponibles
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Detallado Activo
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              Asigna los cupos a cada hotel asegurando que la suma coincida con los <strong>{totalGeneral} cupos totales del bloqueo</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hoteles.length > 1 && (
            <button
              type="button"
              onClick={handleAutoDistribute}
              className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1 transition-all"
              title="Distribuye los cupos generales equitativamente entre los hoteles"
            >
              <Scale size={13} className="text-blue-600" /> Equilibrar Cupos
            </button>
          )}

          <button
            type="button"
            disabled={hasIncompleteHotel}
            onClick={() => {
              if (hasIncompleteHotel) {
                showToast('Completa el nombre del hotel actual antes de agregar uno nuevo.', 'warning')
                return
              }
              handleAddHotel()
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all ${
              hasIncompleteHotel
                ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white'
            }`}
            title={hasIncompleteHotel ? 'Completa el nombre del hotel actual para poder agregar otro' : 'Agregar nuevo hotel'}
          >
            <Plus size={14} /> + Agregar Hotel
          </button>

          <button
            type="button"
            onClick={handleDisableHotelMode}
            className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-600 text-xs font-semibold transition-all"
            title="Quitar hoteles y volver a modo básico"
          >
            Volver a Modo Básico
          </button>
        </div>
      </div>

      {/* BANNER DE VALIDACIÓN DE CUPOS GENERALES VS HOTELES */}
      {hoteles.length > 0 && (
        <div className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isOverLimit
            ? 'bg-red-50/90 border-red-300 text-red-950 shadow-2xs'
            : isMatchExacto
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs'
              : (hasOpenHotel || allOpen)
                ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-2xs'
                : 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-2xs'
        }`}>
          <div className="flex items-start sm:items-center gap-2.5">
            {isOverLimit ? (
              <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : isMatchExacto ? (
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : (hasOpenHotel || allOpen) ? (
              <Sparkles size={20} className="text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-xs font-black">
                  {isOverLimit
                    ? `¡Cupos Fijos Excedidos! ${totalConCupoFijo} asignados para ${totalGeneral} cupos del viaje`
                    : isMatchExacto
                      ? `Distribución Fija Exacta: ${totalConCupoFijo} de ${totalGeneral} Cupos Asignados`
                      : (hasOpenHotel || allOpen)
                        ? `Modalidad Cupo Abierto: Disponible hasta ${totalGeneral} Cupos del Bloqueo`
                        : `Distribución Mixta: ${totalConCupoFijo} Cupos Fijos · ${cuposFaltantes} Abiertos`}
                </strong>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isOverLimit
                    ? 'bg-red-200/80 text-red-900'
                    : isMatchExacto
                      ? 'bg-emerald-200/80 text-emerald-900'
                      : (hasOpenHotel || allOpen)
                        ? 'bg-blue-200/80 text-blue-900'
                        : 'bg-amber-200/80 text-amber-900'
                }`}>
                  {isOverLimit
                    ? `Sobran ${totalConCupoFijo - totalGeneral}`
                    : isMatchExacto
                      ? '100% Cuadrado'
                      : (hasOpenHotel || allOpen)
                        ? 'Cupo Abierto'
                        : `${cuposFaltantes} Flexibles`}
                </span>
              </div>
              <p className="text-[11px] opacity-85 font-medium mt-0.5">
                {isOverLimit
                  ? `Reduce ${totalConCupoFijo - totalGeneral} cupos fijos o pon 0 para dejar cupo abierto.`
                  : isMatchExacto
                    ? `La suma de espacios hoteleros fijos coincide exactamente con los cupos totales contratados.`
                    : (hasOpenHotel || allOpen)
                      ? `Los hoteles con cupo 0 están abiertos. Podrás registrar pasajeros en cualquier hotel hasta alcanzar los ${totalGeneral} cupos totales del bloqueo.`
                      : `Los ${cuposFaltantes} cupos sin asignar quedan disponibles para registrarse en cualquiera de los hoteles.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hoteles.length > 0 && (
              <button
                type="button"
                onClick={handleAutoDistribute}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold shadow-xs transition-colors"
                title="Distribuir cupos equitativamente"
              >
                Equilibrar Fijos
              </button>
            )}
            {cuposFaltantes > 0 && (
              <button
                type="button"
                onClick={() => handleAssignRemainingToHotel(hoteles[0].id)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition-colors"
                title="Asignar cupo al Hotel 1"
              >
                Asignar +{cuposFaltantes} al Hotel 1
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista de Hoteles */}
      {(!hoteles || hoteles.length === 0) ? (
        <div className="text-center py-6 px-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl">
          <Hotel size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-xs font-bold text-gray-600">No hay hoteles configurados para este bloqueo.</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Agrega al menos un hotel y asigna los {totalGeneral} espacios disponibles para los operativos.
          </p>
          <button
            type="button"
            onClick={handleAddHotel}
            className="mt-4 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
          >
            <Plus size={16} /> + Configurar Primer Hotel ({totalGeneral} Cupos)
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {hoteles.map((hotel, index) => {
            const isExpanded = expandedHotelId === hotel.id
            const roomCount = hotel.habitaciones?.length || 0
            const hotelCupos = Number(hotel.cupos) || 0
            const percentOfBloqueo = totalGeneral > 0 ? Math.round((hotelCupos / totalGeneral) * 100) : 0
            const minPrice = roomCount > 0 
              ? Math.min(...hotel.habitaciones.map(r => Number(r.precio) || 0)) 
              : 0

            return (
              <div 
                key={hotel.id || index}
                className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden transition-all"
              >
                {/* Header del Card de Hotel */}
                <div 
                  className={`p-3.5 flex items-center justify-between cursor-pointer select-none transition-colors ${
                    isExpanded ? 'bg-blue-50/40 border-b border-gray-100' : 'hover:bg-gray-50/70'
                  }`}
                  onClick={() => setExpandedHotelId(isExpanded ? null : hotel.id)}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-black text-gray-900 truncate">
                          {hotel.nombre?.trim() ? hotel.nombre : <span className="text-gray-400 italic">Hotel sin nombre</span>}
                        </strong>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          {hotel.categoria?.split(' ')[0] || '4★'}
                        </span>
                        {hotelCupos === 0 ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 flex items-center gap-1">
                            🌐 Cupo Abierto (hasta {totalGeneral})
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0 flex items-center gap-1">
                            <Users size={11} /> {hotelCupos} Espacios ({percentOfBloqueo}%)
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                        {hotel.regimen || 'All Inclusive'} · <span className="font-bold text-emerald-700">{roomCount} tipo(s) de habitación</span>
                        {minPrice > 0 && ` · Desde $${minPrice.toLocaleString('es-EC')} USD`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveHotel(hotel.id)
                      }}
                      className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                      title="Eliminar este hotel"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="text-gray-400 p-1">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Contenido Expandible del Hotel */}
                {isExpanded && (
                  <div className="p-4 space-y-4 bg-white animate-in fade-in-50 duration-150">
                    {/* Campos Principales del Hotel */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-gray-800 font-bold mb-1 text-[11px]">
                          Nombre del Hotel *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Hotel Decameron Barú"
                          value={hotel.nombre}
                          onChange={(e) => handleUpdateHotel(hotel.id, 'nombre', e.target.value)}
                          className="input w-full bg-white text-gray-900 border border-gray-200 font-bold text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-blue-900 font-black mb-1 text-[11px] flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Users size={12} className="text-blue-600" /> Espacios / Cupos Hotel
                          </span>
                          <span className={`text-[10px] font-black ${Number(hotel.cupos) === 0 ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {Number(hotel.cupos) === 0 ? '🌐 Abierto' : `Fijo (${hotel.cupos} PAX)`}
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            placeholder="0 (Cupo abierto)"
                            value={hotel.cupos ?? 0}
                            onChange={(e) => handleUpdateHotel(hotel.id, 'cupos', e.target.value)}
                            className="input w-full bg-blue-50/50 text-blue-950 border border-blue-300 font-black text-xs"
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium block mt-1">
                          Pon <strong>0</strong> para Cupo Abierto (hasta agotar los {totalGeneral} del bloqueo).
                        </span>
                      </div>

                      <div>
                        <label className="block text-gray-800 font-bold mb-1 text-[11px] flex items-center gap-1">
                          <Star size={11} className="text-amber-500 fill-amber-500" /> Categoría / Estrellas
                        </label>
                        <select
                          value={hotel.categoria}
                          onChange={(e) => handleUpdateHotel(hotel.id, 'categoria', e.target.value)}
                          className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold text-xs"
                        >
                          {CATEGORIAS_HOTEL.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-gray-800 font-bold mb-1 text-[11px] flex items-center gap-1">
                          <Utensils size={11} className="text-emerald-600" /> Régimen de Comida
                        </label>
                        <select
                          value={hotel.regimen}
                          onChange={(e) => handleUpdateHotel(hotel.id, 'regimen', e.target.value)}
                          className="input w-full bg-white text-gray-900 border border-gray-200 font-semibold text-xs"
                        >
                          {REGIMENES_COMIDA.map(reg => (
                            <option key={reg} value={reg}>{reg}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Notas Opcionales */}
                    <div>
                      <input
                        type="text"
                        placeholder="Notas u observaciones del hotel (ej. Ubicado frente al mar, incluye traslados internos...)"
                        value={hotel.notas || ''}
                        onChange={(e) => handleUpdateHotel(hotel.id, 'notas', e.target.value)}
                        className="input w-full bg-gray-50 text-gray-700 border border-gray-200 text-xs py-1.5"
                      />
                    </div>

                    {/* Sub-sección: Habitaciones, Tarifas y Cupos por Tipo */}
                    <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <BedDouble size={15} className="text-blue-600" />
                          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Habitaciones & Tarifas {hotelCupos > 0 ? `(${hotelCupos} Cupos Fijos)` : '(🌐 Cupo Abierto)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleLoadStandardRooms(hotel.id)}
                            className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-100/70 hover:bg-blue-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                            title="Restaura Doble, Simple, Triple y Matrimonial"
                          >
                            <Sparkles size={12} /> Cargar Base Estándar
                          </button>
                        </div>
                      </div>

                      {/* Lista de Habitaciones */}
                      {(!hotel.habitaciones || hotel.habitaciones.length === 0) ? (
                        <p className="text-xs text-gray-400 italic py-2">
                          No has agregado tipos de habitación a este hotel. Agrega al menos Doble y Simple.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {hotel.habitaciones.map((hab) => (
                            <div 
                              key={hab.id}
                              className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={hab.tipo}
                                  onChange={(e) => handleUpdateRoom(hotel.id, hab.id, 'tipo', e.target.value)}
                                  placeholder="Ej. Doble, Simple..."
                                  className="w-full text-xs font-bold text-gray-800 bg-transparent border-none p-0 focus:outline-none focus:ring-0 placeholder:text-gray-400"
                                />
                                <span className="text-[10px] text-gray-400 block mt-0.5">
                                  {hab.tipo.toLowerCase().includes('simple') ? 'Suplemento Single' : 'Tarifa por pax'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="relative w-24">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={hab.precio}
                                    onChange={(e) => handleUpdateRoom(hotel.id, hab.id, 'precio', e.target.value)}
                                    placeholder="0"
                                    className="w-full py-1 pl-5 pr-1 text-right text-xs font-black text-emerald-800 bg-emerald-50/60 border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500"
                                    title="Precio de venta por persona"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveRoom(hotel.id, hab.id)}
                                  className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                                  title="Quitar habitación"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Botones de Agregar Rápido de Habitaciones */}
                      <div className="pt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">
                          + Agregar:
                        </span>
                        {TIPOS_HABITACION_SUGERIDOS.map(tipo => {
                          const alreadyExists = (hotel.habitaciones || []).some(
                            h => h.tipo?.toLowerCase() === tipo.toLowerCase()
                          )
                          return (
                            <button
                              key={tipo}
                              type="button"
                              onClick={() => handleAddRoom(hotel.id, tipo)}
                              disabled={alreadyExists}
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                                alreadyExists
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                                  : 'bg-white hover:bg-blue-50 text-gray-700 hover:text-blue-700 border-gray-300 active:scale-95 shadow-2xs'
                              }`}
                            >
                              + {tipo}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Botón de Confirmación / Agregar al final de los datos del Hotel */}
                    <div className="pt-3 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/90 -mx-4 -mb-4 p-4 rounded-b-2xl">
                      <div className="text-[11px] text-gray-500 font-medium">
                        {hotel.nombre?.trim() ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            Hotel "{hotel.nombre}" listo con {hotel.habitaciones?.length || 0} tipo(s) de habitación.
                          </span>
                        ) : (
                          <span className="text-amber-800 font-bold flex items-center gap-1.5">
                            <AlertCircle size={14} className="text-amber-600 shrink-0" />
                            Ingresa el nombre del hotel para poder agregarlo.
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!hotel.nombre || !hotel.nombre.trim()) {
                              showToast('Ingresa el nombre del hotel para confirmarlo.', 'error')
                              return
                            }
                            setExpandedHotelId(null)
                            showToast(`¡Hotel "${hotel.nombre}" confirmado!`, 'success')
                          }}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                        >
                          <Check size={14} />
                          <span>✓ Listo / Agregar Hotel</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!hotel.nombre || !hotel.nombre.trim()) {
                              showToast('Ingresa el nombre del hotel actual antes de agregar otro.', 'error')
                              return
                            }
                            setExpandedHotelId(null)
                            handleAddHotel()
                          }}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition-all"
                        >
                          <Plus size={14} />
                          <span>+ Agregar Otro Hotel</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Botón grande al pie de la lista para agregar hotel */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              disabled={hasIncompleteHotel}
              onClick={() => {
                if (hasIncompleteHotel) {
                  showToast('Completa el nombre del hotel actual antes de agregar uno nuevo.', 'warning')
                  return
                }
                handleAddHotel()
              }}
              className={`w-full py-3.5 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider transition-all ${
                hasIncompleteHotel
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                  : 'border-blue-300 bg-blue-50/50 hover:bg-blue-100/60 text-blue-700 hover:border-blue-400 active:scale-98 shadow-xs'
              }`}
            >
              <Plus size={16} /> + Agregar Nuevo Hotel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
