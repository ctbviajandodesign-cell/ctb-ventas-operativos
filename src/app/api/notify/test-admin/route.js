export const dynamic = 'force-dynamic'
import { notifyAdmin, notifyCity } from '@/lib/telegram'

export async function GET() {
  try {
    const text = '⚡ <b>PRUEBA GLOBAL DE SISTEMA</b>\n¡Conexión exitosa desde el servidor!'
    
    const resAdmin = await notifyAdmin(text + ' (Mensaje Admin)')
    const resUio = await notifyCity('Quito', text + ' (Mensaje UIO)')
    const resGye = await notifyCity('Guayaquil', text + ' (Mensaje GYE)')
    const resCue = await notifyCity('Cuenca', text + ' (Mensaje CUE)')
    
    return Response.json({
      ok: true,
      results: {
        admin: resAdmin,
        uio: resUio,
        gye: resGye,
        cue: resCue
      }
    })
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
