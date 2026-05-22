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
    const cleanDataset = dataset?.map(q => {
      // Treat as ganada (sold) if the record has an active voucher in any of its ventas
      const hasVoucher = q.ventas ? (Array.isArray(q.ventas) ? q.ventas.some(v => v.vouchers && (Array.isArray(v.vouchers) ? v.vouchers.length > 0 : !!v.vouchers.codigo)) : false) : false
      const isSold = q.estado === 'ganada' || hasVoucher
      
      return {
        ref: q.codigo,
        agencia: q.agencia || 'Directo',
        destino: q.destino || 'Desconocido',
        estado: isSold ? 'ganada' : q.estado, // ganada (vendida), perdida (cancelada), anulada (cancelada), abierta (activa/caducada)
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
      }
    }) || []

    // Format leaderboard to track goals and quotas accurately mapped from the real database results
    const cleanLeaderboard = leaderboard?.map(op => {
      const nombreLargo = op.nombreCompleto || op.nombre || 'Desconocido'
      const nombreCorto = op.nombre || ''
      
      // Match and count from the cleanDataset to align metrics perfectly
      const matchingQuotes = cleanDataset.filter(q => 
        q.operativo.toLowerCase().includes(nombreLargo.toLowerCase()) || 
        q.operativo.toLowerCase().includes(nombreCorto.toLowerCase())
      )
      const numCotizaciones = matchingQuotes.length
      const numVentas = matchingQuotes.filter(q => q.estado === 'ganada').length

      return {
        nombre: nombreLargo,
        ciudad: op.ciudad || 'Desconocido',
        meta: Number(op.meta || 0),
        aporte_ganado: Number(op.total || 0),
        porcentaje_meta: Number(op.cumplimiento || 0),
        ventas: numVentas,
        cotizaciones: numCotizaciones
      }
    }) || []

    const prompt = `Eres un asistente de datos comercial y estadístico analítico de nivel experto para "CTB Viajando".
Analiza con precisión matemática absoluta los siguientes dos conjuntos de datos correspondientes al período seleccionado en pantalla:

=== CONJUNTO DE DATOS 1: COTIZACIONES Y EXPEDIENTES ===
${JSON.stringify(cleanDataset, null, 2)}

=== CONJUNTO DE DATOS 2: RENDIMIENTO Y METAS DE OPERATIVOS ===
${JSON.stringify(cleanLeaderboard, null, 2)}

=== REGLAS DE ANÁLISIS E INFERENCIA COMERCIAL ===
1. DIFERENCIACIÓN CLAVE DE CAMPOS:
   - "agencia": Representa la agencia de viajes externa/cliente (ej: "HUALAMBARI", "PAWANA", "DREAMS").
   - "operativo" / "asesor": Representa al personal/operativo interno de CTB Viajando (ej: "Karla Freire", "Eva Freire").
   - "destino": El lugar turístico del viaje (ej: "Galapagos", "Panama").
   - NUNCA confundas ni mezcles estos conceptos. Si te preguntan por una "agencia", tu respuesta debe referirse únicamente al campo "agencia", NUNCA al campo "operativo".

2. ANÁLISIS DE VENTAS vs COTIZACIONES:
   - Una venta cerrada/ganada es aquella donde el campo "estado" es "ganada" (o "vendida").
   - Si te preguntan "¿Quién ha vendido más?" o "¿Qué agencia ha vendido más?", debes contar ÚNICAMENTE los registros con estado "ganada". NUNCA cuentes cotizaciones abiertas o activas como ventas.
   - Si nadie registra ventas ("ganada") en el dataset, responde directamente indicando que no hay ventas registradas en este período.

3. CONTEO Y CÁLCULOS:
   - Cada objeto en el Conjunto de Datos 1 representa exactamente una (1) cotización individual.
   - Para saber cuántas cotizaciones tiene una agencia o destino, cuenta el número de objetos que tienen ese valor. No sumes el número de pasajeros a menos que te pregunten explícitamente por el "número de pasajeros".
   - En caso de empate en el primer lugar (ej: múltiples agencias con 1 cotización), indícalo claramente mencionando el empate en lugar de elegir una sola de forma arbitraria.

4. FORMATO DE RESPUESTA:
   - Sé sumamente directo, conciso y profesional. Responde en 1 o 2 líneas como máximo.
   - No incluyas introducciones como "Analizando los datos...", "De acuerdo con el dataset...", ni conclusiones/saludos.
   - Usa negrita para nombres de personas, agencias, destinos o montos de dinero (ej: **Karla Freire**, **HUALAMBARI**, **$1,035 USD**).
   - Si el usuario te pregunta por un operativo, ciudad, agencia o destino específico que no tiene absolutamente ningún registro en el dataset, di textualmente: "No se registran cotizaciones ni ventas para [Nombre] en este periodo." sin inventar ni estimar datos.

Pregunta del usuario:
"${question}"`

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
