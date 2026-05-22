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

    // ─── Determinar si una cotización tiene voucher activo ────────────────────
    const hasActiveVoucher = (quote) => {
      const ventas = Array.isArray(quote.ventas) ? quote.ventas : (quote.ventas ? [quote.ventas] : [])
      return ventas.some(v => {
        const vArr = Array.isArray(v.vouchers) ? v.vouchers : (v.vouchers ? [v.vouchers] : [])
        return vArr.length > 0
      })
    }

    // ─── Limpiar y normalizar cada cotización ─────────────────────────────────
    const cleanDataset = (dataset || []).map(q => {
      const esVenta = q.estado === 'ganada' || hasActiveVoucher(q)
      return {
        ref:              q.codigo,
        agencia:          q.agencia || 'Directo',
        destino:          q.destino || 'Desconocido',
        operativo:        q.profiles?.nombre || 'Desconocido',
        ciudad:           q.profiles?.ciudad || 'Desconocido',
        comercial:        q.comercial || '',
        es_venta:         esVenta,   // TRUE = venta confirmada. FALSE = cotización sin cerrar
        valor_venta:      esVenta ? Number(q.valor_total || 0) : 0,
        valor_cotizacion: Number(q.valor_total || 0),
        comision:         Number(q.valor_comision || 0),
        utilidad:         Number(q.valor_utilidad || 0),
        aporte_ctb:       Number(q.valor_utilidad || 0) + Number(q.valor_comision || 0),
        pasajeros:        q.numero_pasajeros || (Array.isArray(q.nombres_pasajeros) ? q.nombres_pasajeros.length : 0),
        motivo_perdida:   q.motivo_perdida || '',
        estado_original:  q.estado,
        fecha:            q.created_at ? q.created_at.split('T')[0] : ''
      }
    })

    // ─── Pre-computar resúmenes para el prompt (ahorrar tokens y mejorar precisión) ─
    const ventas      = cleanDataset.filter(q => q.es_venta)
    const cotizaciones = cleanDataset.filter(q => !q.es_venta)

    // Agencias que vendieron
    const agenciasVentas = {}
    ventas.forEach(q => {
      if (!agenciasVentas[q.agencia]) agenciasVentas[q.agencia] = { ventas: 0, monto: 0 }
      agenciasVentas[q.agencia].ventas++
      agenciasVentas[q.agencia].monto += q.valor_venta
    })

    // Agencias que solo cotizaron (sin vender)
    const agenciasQueCotizaron = {}
    cotizaciones.forEach(q => {
      if (!agenciasQueCotizaron[q.agencia]) agenciasQueCotizaron[q.agencia] = 0
      agenciasQueCotizaron[q.agencia]++
    })
    const agenciasSoloCotizan = Object.keys(agenciasQueCotizaron).filter(a => !agenciasVentas[a])

    // Destinos vendidos
    const destinosVentas = {}
    ventas.forEach(q => {
      if (!destinosVentas[q.destino]) destinosVentas[q.destino] = { ventas: 0, monto: 0 }
      destinosVentas[q.destino].ventas++
      destinosVentas[q.destino].monto += q.valor_venta
    })

    // Operativos resumen
    const operativosMap = {}
    cleanDataset.forEach(q => {
      if (!operativosMap[q.operativo]) operativosMap[q.operativo] = { cotizaciones: 0, ventas: 0, monto: 0 }
      operativosMap[q.operativo].cotizaciones++
      if (q.es_venta) {
        operativosMap[q.operativo].ventas++
        operativosMap[q.operativo].monto += q.valor_venta
      }
    })

    // Comerciales resumen
    const comercialesMap = {}
    cleanDataset.filter(q => q.comercial).forEach(q => {
      if (!comercialesMap[q.comercial]) comercialesMap[q.comercial] = { cotizaciones: 0, ventas: 0, monto: 0 }
      comercialesMap[q.comercial].cotizaciones++
      if (q.es_venta) {
        comercialesMap[q.comercial].ventas++
        comercialesMap[q.comercial].monto += q.valor_venta
      }
    })

    // Leaderboard limpio con métricas verificadas
    const cleanLeaderboard = (leaderboard || []).map(op => {
      const nombre = op.nombreCompleto || op.nombre || 'Desconocido'
      const opData = operativosMap[nombre] || { cotizaciones: 0, ventas: 0, monto: 0 }
      return {
        nombre,
        ciudad: op.ciudad || 'Desconocido',
        meta: Number(op.meta || 0),
        aporte_ganado: Number(op.total || 0),
        porcentaje_meta: Number(op.cumplimiento || 0),
        ventas_confirmadas: opData.ventas,
        cotizaciones_total: opData.cotizaciones
      }
    })

    const prompt = `Eres un analista de datos comerciales experto para la empresa "CTB Viajando". Responde la pregunta del usuario usando ÚNICAMENTE los datos pre-calculados que se muestran a continuación. Razona paso a paso internamente, pero entrega solo la respuesta final.

=== DEFINICIONES ===
- "agencia": Cliente externo / agencia de viajes (ej: HUALAMBARI, DREAMS).
- "operativo": Asesor interno de CTB Viajando (ej: Karla Freire, Eva Freire).
- "comercial": Canal o ejecutivo comercial que trajo el negocio.
- "destino": Lugar turístico del viaje.
- "es_venta: true": La cotización se convirtió en venta real confirmada.
- "es_venta: false": Solo es una cotización, no se concretó la venta.

=== TOTALES DEL PERÍODO ===
- Total cotizaciones: ${cleanDataset.length}
- Total ventas confirmadas: ${ventas.length}
- Total sin vender: ${cotizaciones.length}

=== AGENCIAS QUE VENDIERON ===
${JSON.stringify(agenciasVentas, null, 2)}

=== AGENCIAS QUE SOLO COTIZARON (SIN VENDER) ===
${JSON.stringify(agenciasSoloCotizan)}

=== DESTINOS VENDIDOS ===
${JSON.stringify(destinosVentas, null, 2)}

=== RESUMEN POR OPERATIVO ===
${JSON.stringify(operativosMap, null, 2)}

=== RESUMEN POR COMERCIAL ===
${JSON.stringify(Object.keys(comercialesMap).length > 0 ? comercialesMap : { 'sin_datos': 'No hay comerciales registrados' }, null, 2)}

=== LEADERBOARD DE ASESORES ===
${JSON.stringify(cleanLeaderboard, null, 2)}

=== REGLAS DE RESPUESTA ===
1. Responde en MÁXIMO 2 líneas. Sin introducciones ni saludos.
2. Usa negrita para nombres, destinos y montos: **DREAMS**, **Karla Freire**, **$1,035 USD**.
3. Si preguntan por "quién vendió más" → usa el campo "ventas" y "monto" de los resúmenes de VENTAS.
4. Si preguntan por "quién solo cotizó sin vender" → usa la lista "AGENCIAS QUE SOLO COTIZARON".
5. Si algo no tiene datos en los resúmenes, responde: "No se registran datos para [Nombre] en este período."
6. Nunca mezcles: agencia ≠ operativo ≠ comercial ≠ destino.
7. Si hubiera empate, menciona a todos los empatados.

Pregunta del usuario: "${question}"`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1
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
