export const dynamic = 'force-dynamic'
import { notifyAdmin } from '@/lib/telegram'

export async function GET() {
  try {
    await notifyAdmin('⚡ <b>TEST DE CONEXIÓN AL GRUPO ADMIN</b>\n¡Conexión establecida exitosamente con el supergrupo de administradores!')
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
