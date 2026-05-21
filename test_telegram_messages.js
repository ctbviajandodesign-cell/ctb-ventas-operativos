import { createClient } from '@supabase/supabase-js'

const botToken = process.env.TELEGRAM_BOT_TOKEN
const adminChatId = process.env.TELEGRAM_CHAT_ADMIN

if (!botToken || !adminChatId) {
  console.error("Faltan variables de entorno de Telegram.")
  process.exit(1)
}

function progressBar(pct) {
  const filled = Math.min(Math.floor((pct / 100) * 10), 10)
  const empty = 10 - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount)
}

async function notifyAdmin(text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text,
        parse_mode: 'HTML'
      })
    })
    const data = await res.json()
    if (!data.ok) console.error("Error Telegram:", data)
  } catch (error) {
    console.error("Error Fetch Telegram:", error)
  }
}

async function run() {
  console.log("Enviando mensajes de prueba a Admin...")

  // 1. Mensaje Motivacional Mañana (Admin)
  await notifyAdmin(`☀️ <b>RESUMEN MATUTINO ADMIN — CTB</b>\n<i>Jueves 21 de mayo · mayo 2026</i>\n\n📊 Ventas acumuladas mes: $34,500\n💰 Aporte total (com+util): $6,200\n\n🏙 QUITO: $14,000 | Líder: Juan Pérez (72%)\n🏙 GUAYAQUIL: $12,500 | Líder: Ana Ramos (68%)\n🏙 CUENCA: $8,000 | Líder: Luis Torres (45%)\n\n💤 Sin ventas en el mes (1):\n   · Pedro Muñoz`)

  // 2. Venta Inmediata (Ejemplo)
  await notifyAdmin(`📈 <b>¡NUEVA VENTA CTB — QUITO!</b>\n\n👤 <b>Asesor:</b> Juan Pérez\n✈️ <b>Destino:</b> París  |  🏢 <b>Agencia:</b> Tur Travel\n💰 <b>Valor:</b> $2,800\n\n📊 <b>Meta del mes:</b> 48.5%\n<code>${progressBar(48.5)}</code>`)

  // 3. Hito de Meta 100%
  await notifyAdmin(`🏆 <b>¡META CUMPLIDA — QUITO!</b>\n\n<b>Juan Pérez</b> cerró su meta de mayo 2026.\n\n<code>${progressBar(100)}</code> <b>100%</b> ✅\n💰 $5,000 alcanzados\n\nCada visita, cada seguimiento,\ncada cierre cuenta. Y hoy se nota.\n\n<b>¡Felicitaciones Juan! 🔥</b>\n\n— Gerencia CTB`)

  // 4. Hito Primero en Meta
  await notifyAdmin(`⚡🏆 <b>¡PRIMERO EN META — CTB!</b>\n\n<b>Juan Pérez</b> (Quito) es el primero\nen cerrar su meta de mayo 2026.\n\n<code>${progressBar(100)}</code> <b>100%</b> ✅\n💰 $5,000 · 🗓 Día 21 del mes\n\nEnfoque y dedicación día a día.\nAsí se construye un gran mes. 👑\n\n<b>¡Felicitaciones Juan, bien merecido!</b>\n\n— Gerencia CTB`)

  // 5. Hito Extraordinario 150%
  await notifyAdmin(`🚀💥 <b>¡RESULTADO EXTRAORDINARIO — QUITO!</b>\n\n<b>Juan Pérez</b> cerró mayo 2026 en un nivel\nque merece reconocimiento especial.\n\n<code>${progressBar(100)}</code> <b>156%</b> 🔥\n💰 $7,800 sobre $5,000 de meta\n\nResultado de un trabajo sostenido,\nconsistente y bien ejecutado.\n\n<b>¡Felicitaciones Juan, mes histórico! 🏅</b>\n\n— Gerencia CTB`)

  // 6. Resumen Diario (Admin)
  await notifyAdmin(`📊 <b>RESUMEN DIARIO GLOBAL CTB</b>\n<i>Jueves 21 de mayo</i>\n\n🏙 <b>QUITO</b>: $4,600 (2 asesores)\n   👑 Líder: Juan Pérez · $3,200\n🏙 <b>GUAYAQUIL</b>: $2,100 (1 asesor)\n   👑 Líder: Ana Ramos · $2,100\n🏙 <b>CUENCA</b>: $0 — sin ventas hoy\n\n💼 Total del día: $6,700\n💰 Comisiones: $420  |  Utilidades: $250\n📈 Aporte total CTB hoy: $670\n📁 Ventas registradas: 3\n\n😶 Sin ventas hoy (2):\n   Quito: Pedro Muñoz\n   Cuenca: Luis Torres, Sofía Castro\n\n🔴 ALERTA — Sin ventas hace +3 días (1):\n   Cuenca: Luis Torres`)

  // 7. Resumen Semanal (Admin)
  await notifyAdmin(`🗓 <b>RESUMEN SEMANAL GLOBAL CTB</b>\n<i>Semana del 19 may – 21 may</i>\n\n🏙 <b>QUITO</b>: $15,700\n   👑 Mejor: Juan Pérez · $8,400\n🏙 <b>GUAYAQUIL</b>: $12,300\n   👑 Mejor: Ana Ramos · $6,100\n🏙 <b>CUENCA</b>: $5,800\n   👑 Mejor: Luis Torres · $3,200\n\n💼 Total global: $33,800  |  Aporte CTB: $3,380\n📁 Ventas totales: 18`)

  // 8. Cierre de Mes (Admin)
  await notifyAdmin(`📊 <b>INFORME DE CIERRE MENSUAL CTB</b>\n<i>mayo 2026</i>\n\n💼 <b>Total Facturado: $89,400</b>\n💰 Comisiones: $5,364  |  Utilidades: $3,576\n📈 Aporte total CTB: $8,940\n🎯 Meta Global: $30,000\n<code>${progressBar(29.8)}</code> 29.8%\n\n🏙 QUITO: $37,900 · Aporte: $11,370\n   MVP: Juan Pérez · 109%\n🏙 GUAYAQUIL: $31,200 · Aporte: $9,360\n   MVP: Ana Ramos · 95%\n🏙 CUENCA: $20,300 · Aporte: $6,090\n   MVP: Luis Torres · 82%\n\n✅ Cierres ganados: 31  |  ❌ Pérdidas/Anuladas: 19\n\n🏆 Cumplieron meta (3):\n   🟢 Juan Pérez (Quito) — 109%\n   🟢 Ana Ramos (Guayaquil) — 95%\n   🟢 Luis Torres (Cuenca) — 82%\n\n⚠️ No cumplieron meta (3):\n   🔴 Carlos Vega (Quito) — 37% · Faltó: $3,140\n   🔴 Sofía Castro (Guayaquil) — 22% · Faltó: $3,900\n   🔴 Pedro Muñoz (Quito) — 8% · Faltó: $4,600\n\n📋 <b>¿Por qué no se vendió? — Top razones del mes:</b>\n   1. Precio alto — 8x\n   2. Cliente decidió no viajar — 5x\n   3. Competencia más económica — 3x`)

  console.log("Mensajes enviados.")
}

run()
