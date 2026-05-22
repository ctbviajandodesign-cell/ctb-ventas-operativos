import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ answer: 'El sistema de Inteligencia Artificial no está configurado (falta la clave API de OpenAI).', error: 'No API key' })
    }

    const { question, dataset, leaderboard } = await request.json()

    if (!question) {
      return NextResponse.json({ answer: 'Por favor, escribe una pregunta.' })
    }

    // Format the dataset to keep it minimal and save tokens
    const cleanDataset = dataset?.map(q => ({
      ref: q.codigo,
      agencia: q.agencia || 'Directo',
      destino: q.destino || 'Desconocido',
      estado: q.estado, // ganada (vendida), perdida (cancelada), anulada (cancelada), abierta (activa/caducada)
      valor_venta: Number(q.valor_total || 0),
      comision: Number(q.valor_comision || 0),
      utilidad: Number(q.valor_utilidad || 0),
      aporte_ctb: Number(q.valor_utilidad || 0) + Number(q.valor_comision || 0),
      operativo: q.profiles?.nombre || 'Desconocido',
      ciudad: q.profiles?.ciudad || 'Desconocido',
      comercial: q.comercial || '---',
      pasajeros: q.numero_pasajeros || (Array.isArray(q.nombres_pasajeros) ? q.nombres_pasajeros.length : 0),
      motivo_perdida: q.motivo_perdida || '',
      fecha: q.created_at ? q.created_at.split('T')[0] : ''
    })) || []

    // Format leaderboard to track goals and quotas
    const cleanLeaderboard = leaderboard?.map(op => ({
      nombre: op.nombre || 'Desconocido',
      ciudad: op.ciudad || 'Desconocido',
      meta: Number(op.meta || 0),
      aporte_ganado: Number(op.ganancia || 0),
      porcentaje_meta: Number(op.porcentaje || 0),
      ventas: Number(op.num_ventas || 0),
      cotizaciones: Number(op.num_cotizaciones || 0)
    })) || []

    const prompt = `Eres un asistente de datos comercial analítico y ultra-preciso para "CTB Viajando".
Tienes acceso a dos conjuntos de datos: las cotizaciones y el rendimiento del equipo de asesores/operativos en el periodo filtrado en pantalla.

DATOS DISPONIBLES:
1. Cotizaciones del periodo:
${JSON.stringify(cleanDataset, null, 2)}

2. Rendimiento y metas de asesores (operativos):
${JSON.stringify(cleanLeaderboard, null, 2)}

Pregunta del usuario:
"${question}"

Reglas estrictas de resolución y formato:
1. Responde de forma directa al grano en máximo dos o tres líneas. Sin saludos, preámbulos ni conclusiones.
2. Si el usuario te pregunta por un operativo, ciudad, agencia o destino que no registra actividad ni datos en el listado provisto, di explícitamente: "No se registran cotizaciones ni ventas para [Nombre/Ciudad/Agencia] en este periodo". No alucines ni inventes datos.
3. Mantén "agencia" (nombre de la agencia cliente) y "destino" (el lugar de viaje) estrictamente separados.
4. Si preguntan sobre metas, cumplimiento de objetivos o ventas de asesores, prioriza usar la lista 2 (metas de asesores).
5. Si preguntan por fechas específicas o palabras específicas, busca coincidencias parciales en los campos "fecha", "agencia", "destino" o "motivo_perdida" dentro de la lista 1.
6. Usa negrita únicamente para nombres de personas, agencias, destinos o montos (ej: **Karla Freire**, **$5,000 USD**).`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.2
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI response code: ${response.status}`)
    }

    const resData = await response.json()
    const answer = resData.choices?.[0]?.message?.content?.trim() || 'No se pudo generar una respuesta.'

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json({ answer: 'Hubo un error al procesar tu consulta con la IA.', error: error.message })
  }
}
