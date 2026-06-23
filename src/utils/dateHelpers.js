import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const isExpired = (q) => {
  if (q.fecha_caducidad) {
    const timeStr = q.hora_caducidad ? q.hora_caducidad : '23:59:59'
    const expiryDate = new Date(`${q.fecha_caducidad}T${timeStr}`)
    return expiryDate < new Date()
  }
  if (q.created_at) {
    const hours = (new Date() - new Date(q.created_at)) / (1000 * 60 * 60)
    return hours > 24
  }
  return false
}

export const getEcuadorTime = (date = new Date()) => {
  return new Date(date.toLocaleString("en-US", { timeZone: "America/Guayaquil" }))
}

export const getPeriodRange = (period, date) => {
  const d = new Date(date)
  let start, end

  if (period === 'dia') {
    start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 5, 0, 0, 0))
    end = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 1, 4, 59, 59, 999))
  } else if (period === 'semana') {
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    start = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate(), 5, 0, 0, 0))
    end = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7, 4, 59, 59, 999))
  } else if (period === 'mes') {
    start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 5, 0, 0, 0))
    end = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1, 4, 59, 59, 999))
  } else { // 'año'
    start = new Date(Date.UTC(d.getFullYear(), 0, 1, 5, 0, 0, 0))
    end = new Date(Date.UTC(d.getFullYear() + 1, 0, 1, 4, 59, 59, 999))
  }

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  }
}

export const getPeriodLabel = (period, date) => {
  const d = new Date(date)
  if (period === 'dia') {
    return format(d, "d 'de' MMMM, yyyy", { locale: es })
  } else if (period === 'semana') {
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(new Date(d).setDate(diff))
    const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6))
    const startStr = format(monday, "d MMM", { locale: es })
    const endStr = format(sunday, "d MMM, yyyy", { locale: es })
    return `${startStr} - ${endStr}`
  } else if (period === 'mes') {
    return format(d, "MMMM yyyy", { locale: es })
  } else {
    return `Año ${d.getFullYear()}`
  }
}
