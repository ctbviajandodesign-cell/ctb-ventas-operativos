/**
 * CTB Viajando — Telegram Notification Helper
 * Envía mensajes a los grupos correctos según la ciudad
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

function getChatMap() {
  return {
    quito:     process.env.TELEGRAM_CHAT_UIO,
    uio:       process.env.TELEGRAM_CHAT_UIO,
    guayaquil: process.env.TELEGRAM_CHAT_GYE,
    gye:       process.env.TELEGRAM_CHAT_GYE,
    cuenca:    process.env.TELEGRAM_CHAT_CUE,
    cue:       process.env.TELEGRAM_CHAT_CUE,
  }
}

/**
 * Escapa caracteres especiales de HTML para evitar que la API de Telegram
 * rechace el mensaje con error 400.
 */
export function escapeHtml(text) {
  if (!text) return ''
  return text
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Retorna un objeto Date que representa la fecha/hora actual desplazada -5 horas (Ecuador)
 * para realizar cálculos de fecha basados en componentes UTC de forma segura.
 */
export function getEcuadorTime(date = new Date()) {
  return new Date(date.getTime() - 5 * 60 * 60 * 1000)
}

/**
 * Convierte una fecha construida con componentes locales de Ecuador de vuelta
 * al equivalente real de UTC sumando las 5 horas de offset.
 */
export function ecToUTC(ecDate) {
  return new Date(ecDate.getTime() + 5 * 60 * 60 * 1000)
}

/**
 * Envía un mensaje a un chat_id específico
 */
export async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !chatId) return { ok: false, error: 'Missing config' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    })
    
    const data = await res.json()
    if (!res.ok || !data.ok) {
      console.error('Telegram API error details:', {
        status: res.status,
        statusText: res.statusText,
        data,
        chatId,
        textSnippet: text.slice(0, 200)
      })
    }
    return data
  } catch (err) {
    console.error('Telegram fetch error:', err)
    return { ok: false, error: err.message }
  }
}

/**
 * Resuelve los chat IDs a notificar según la ciudad del operativo.
 * Incluye el grupo de la ciudad y siempre al Admin.
 */
export function getChatIds(ciudad = '') {
  const key = ciudad.trim().toLowerCase()
  const map = getChatMap()
  const cityChat = map[key] || null
  const ids = [process.env.TELEGRAM_CHAT_ADMIN]
  if (cityChat) ids.push(cityChat)
  return [...new Set(ids.filter(Boolean))] // sin duplicados y sin nulos
}

/**
 * Envía al grupo de ciudad y admin
 */
export async function notifyAll(ciudad, text) {
  const ids = getChatIds(ciudad)
  return Promise.all(ids.map(id => sendTelegram(id, text)))
}

/**
 * Envía solo al grupo de ciudad (sin admin)
 */
export async function notifyCity(ciudad, text) {
  const key = ciudad.trim().toLowerCase()
  const map = getChatMap()
  const chatId = map[key] || process.env.TELEGRAM_CHAT_ADMIN
  return sendTelegram(chatId, text)
}

/**
 * Envía solo al Admin
 */
export async function notifyAdmin(text) {
  return sendTelegram(process.env.TELEGRAM_CHAT_ADMIN, text)
}

/**
 * Formatea número como moneda
 */
export function formatMoney(n) {
  return `$${Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 0 })}`
}

export function progressBar(pct) {
  const percent = Number(pct) || 0
  let filled = Math.min(10, Math.max(0, Math.round(percent / 10)))
  if (percent > 0 && filled === 0) {
    filled = 1
  }
  const empty = 10 - filled
  
  let block = '🟥' // < 50% -> Rojo
  if (percent >= 90) {
    block = '🟩'   // >= 90% -> Verde
  } else if (percent >= 50) {
    block = '🟨'   // >= 50% -> Amarillo
  }

  return block.repeat(filled) + '⬜'.repeat(empty)
}
