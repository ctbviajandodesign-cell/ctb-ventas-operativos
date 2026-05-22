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

    const getVoucherCodigo = (quote) => {
      const ventas = Array.isArray(quote.ventas) ? quote.ventas : (quote.ventas ? [quote.ventas] : [])
      for (const v of ventas) {
        const voucherArr = Array.isArray(v.vouchers) ? v.vouchers : (v.vouchers ? [v.vouchers] : [])
        if (voucherArr.length > 0) return voucherArr[0].codigo || voucherArr[0]
      }
      return null
    }

    // Format the dataset to keep it minimal and save tokens
    const cleanDataset = dataset?.map(q => {
      const isSold = q.estado === 'ganada' || !!getVoucherCodigo(q)
      
      return {
        ref: q.codigo,
        agencia: q.agencia || 'Directo',
        destino: q.destino || 'Desconocido',
        estado: isSold ? 'ganada' : q.estado, // ganada (vendida), perdida (cancelada), anulada (cancelada), abierta (activa/caducada)
        es_venta: isSold, // true si es una venta confirmada/efectiva, false en caso contrario
        valor_venta: isSold ? Number(q.valor_total || 0) : 0, // Solo tiene valor de venta si es una venta confirmada/efectiva
        valor_cotizacion: Number(q.valor_total || 0),
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
      const numVentas = matchingQuotes.filter(q => q.es_venta).length

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

    console.log('AI Chat Question:', question)
    console.log('cleanDataset count:', cleanDataset.length)
    const ganadasDataset = cleanDataset.filter(q => q.estado === 'ganada')
    console.log('cleanDataset ganadas count:', ganadasDataset.length)
    console.log('cleanDataset ganadas:', JSON.stringify(ganadasDataset, null, 2))
    console.log('cleanLeaderboard:', JSON.stringify(cleanLeaderboard, null, 2))

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
   - Una venta confirmada/efectiva tiene "es_venta": true (su estado es "ganada" y tiene un "valor_venta" mayor a 0).
   - Una cotización es cualquier objeto del dataset (independientemente de si es_venta es true o false).
   - Si te preguntan "¿Quién ha vendido más?" o "¿Qué agencia ha vendido más?" o consultas sobre facturación/montos de venta, debes filtrar y basarte ÚNICAMENTE en los registros donde "es_venta" sea true. Suma el campo "valor_venta" para obtener el total vendido por entidad.
   - Si no hay ningún registro en el dataset donde "es_venta" sea true, debes responder exactamente: "No hay ventas registradas en este período."

3. CONTEO Y CÁLCULOS:
   - Cada objeto en el Conjunto de Datos 1 representa exactamente una (1) cotización individual.
   - Para saber cuántas cotizaciones tiene una agencia o destino, cuenta el número de objetos que tienen ese valor en el dataset.
   - En caso de empate en el primer lugar (ej: múltiples agencias con la misma cantidad de ventas o cotizaciones), indícalo claramente mencionando a todas las partes empatadas.

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
