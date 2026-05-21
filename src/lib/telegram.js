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
    return await res.json()
  } catch (err) {
    console.error('Telegram error:', err)
    return { ok: false, error: err.message }
  }
}

/**
 * Resuelve los chat IDs a notificar según la ciudad del operativo
 * Siempre incluye Admin. También incluye el grupo de la ciudad si aplica.
 */
export function getChatIds(ciudad = '') {
  const key = ciudad.trim().toLowerCase()
  const map = getChatMap()
  const cityChat = map[key] || null
  const CHAT_ADMIN = process.env.TELEGRAM_CHAT_ADMIN
  const ids = [CHAT_ADMIN]
  if (cityChat && cityChat !== CHAT_ADMIN) ids.push(cityChat)
  return [...new Set(ids.filter(Boolean))] // sin duplicados y sin nulos
}

/**
 * Envía a Admin + grupo de ciudad
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

/**
 * Barra de progreso visual para Telegram
 */
export function progressBar(pct) {
  const filled = Math.round(Math.min(pct, 100) / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}
