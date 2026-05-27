import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ answer: 'El sistema de Inteligencia Artificial no está configurado (falta la clave API de OpenAI).', error: 'No API key' })
    }

    const { question, dataset, leaderboard, operativos } = await request.json()

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

    // Operativos agrupados por ciudad
    // Usar operativos[] si está disponible (tiene datos completos de profiles)
    // Complementar con datos del dataset y del leaderboard como fallback
    const porCiudad = {}

    // Primero, usar la lista de operativos de profiles (la más completa y directa)
    if (operativos && operativos.length > 0) {
      operativos.forEach(op => {
        const ciudad = op.ciudad || 'Sin ciudad'
        if (!porCiudad[ciudad]) porCiudad[ciudad] = []
        const opData = operativosMap[op.nombre] || { cotizaciones: 0, ventas: 0, monto: 0 }
        porCiudad[ciudad].push({
          nombre: op.nombre,
          cotizaciones: opData.cotizaciones,
          ventas: opData.ventas,
          monto: opData.monto
        })
      })
    } else {
      // Fallback: usar el leaderboard y el dataset (ciudad del perfil del pipeline)
      cleanLeaderboard.forEach(op => {
        const ciudad = op.ciudad || 'Sin ciudad'
        if (!porCiudad[ciudad]) porCiudad[ciudad] = []
        porCiudad[ciudad].push({
          nombre: op.nombre,
          ventas: op.ventas_confirmadas,
          meta: op.meta,
          aporte: op.aporte_ganado,
          pct_meta: op.porcentaje_meta
        })
      })
      // Complementar con ciudades del dataset si el leaderboard no tiene ciudad
      cleanDataset.forEach(q => {
        const ciudad = q.ciudad || 'Sin ciudad'
        if (!Object.values(porCiudad).flat().find(o => o.nombre === q.operativo)) {
          if (!porCiudad[ciudad]) porCiudad[ciudad] = []
          if (!porCiudad[ciudad].find(o => o.nombre === q.operativo)) {
            const opData = operativosMap[q.operativo] || { cotizaciones: 0, ventas: 0, monto: 0 }
            porCiudad[ciudad].push({ nombre: q.operativo, ...opData })
          }
        }
      })
    }
    // Ranking de ciudades por ventas
    const rankingCiudades = Object.entries(porCiudad).map(([ciudad, ops]) => ({
      ciudad,
      operativos: ops.map(o => o.nombre),
      total_ventas: ops.reduce((a, o) => a + (o.ventas || 0), 0),
      total_aporte: ops.reduce((a, o) => a + (o.aporte || 0), 0)
    })).sort((a, b) => b.total_aporte - a.total_aporte)

    const prompt = `Eres un analista de datos comerciales experto para la empresa "CTB Viajando". Responde la pregunta del usuario usando ÚNICAMENTE los datos pre-calculados que se muestran a continuación. Razona internamente paso a paso, pero entrega solo la respuesta final.

=== DEFINICIONES ===
- "agencia": Cliente externo / agencia de viajes (ej: HUALAMBARI, DREAMS).
- "operativo" o "asesor": Asesor interno de CTB Viajando (ej: Karla Freire, Eva Freire).
- "comercial": Canal o ejecutivo comercial que trajo el negocio.
- "destino": Lugar turístico del viaje.
- "ciudad" o "país" en contexto CTB = sede del operativo (Quito, Guayaquil, Cuenca, etc.).
- Venta confirmada = "es_venta: true" en el dataset.

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

=== OPERATIVOS POR CIUDAD/SEDE ===
${JSON.stringify(porCiudad, null, 2)}

=== RANKING DE CIUDADES/SEDES POR VENTAS ===
${JSON.stringify(rankingCiudades, null, 2)}

=== LEADERBOARD DE ASESORES (con metas) ===
${JSON.stringify(cleanLeaderboard, null, 2)}

=== REGLAS DE RESPUESTA ===
1. Responde de forma muy didáctica, sintetizada y directa. Utiliza saltos de línea y listas con viñetas (-) para organizar la información en un máximo de 3 o 4 puntos clave. Evita bloques compactos de texto corrido y NUNCA dupliques información.
2. NUNCA utilices títulos con almohadillas (evita caracteres como #, ##, ###). Si necesitas rotular una sección, usa texto en negrita al inicio de la línea (ej: "- **Resumen de ventas**:").
3. Usa negrita para nombres, destinos, porcentajes y montos: **DREAMS**, **Karla Freire**, **Cancún**, **15%**, **$1,035 USD**.
4. **Escalabilidad de Ventas**: NUNCA listes transacciones individuales una por una (agencia por agencia, monto por monto) en resúmenes generales o preguntas de rendimiento. Solo haz un listado detallado (ej: "Asesor vendió a Agencia con destino...") si el usuario pregunta explícitamente por detalles detallados o listados específicos (ej: "a quién no más vendieron", "lista las ventas de hoy", "a qué agencias se vendió").
5. **Resúmenes y Rendimiento**: Para preguntas sobre quién vendió más, quién cotizó más/menos, resúmenes del día/mes o rendimiento general, agrupa y resume los datos por operativo/asesor mostrando: **Asesor**: **X** cotizaciones | **Y** ventas (**$Z USD** de monto total) | **W%** de conversión (ventas / cotizaciones).
6. **Comparaciones complejas** (ej: "quién cotizó más y vendió menos"): Sé analítico y preciso. Desglosa ambas variables por separado (ej: quién tiene el número más alto de cotizaciones y quién tiene el número más bajo de ventas o la peor tasa de conversión) para dar una conclusión lógica y coherente, en lugar de atribuir ambas cosas erróneamente a una sola persona si no cumple ambas condiciones de forma absoluta.
7. Si preguntan por "solo cotizó sin vender" → usa la lista "AGENCIAS QUE SOLO COTIZARON".
8. Si preguntan "qué operativos hay de [ciudad]" → busca en "OPERATIVOS POR CIUDAD/SEDE" esa ciudad y lista sus nombres.
9. Si preguntan "ranking por ciudad/sede" o "quién va ganando por país" → usa "RANKING DE CIUDADES/SEDES POR VENTAS".
10. Si algo no tiene datos, responde: "No se registran datos para [Nombre] en este período."
11. Si la pregunta es abierta o ambigua ("quién vendió", "qué se vendió", "resumen de hoy"), da siempre un desglose sintetizado en un formato de lista muy limpio y unificado de máximo 3 puntos:
- **Cotizaciones totales**: [Total, y de forma inline el desglose por asesor. Ej: "Total de **21** cotizaciones (Eva Freire: **11**, Karla Freire: **9**)"].
- **Resumen de Ventas**: [Monto total vendido e inline el desglose resumido por asesor. Ej: "Total de **$10,500 USD** en **5** ventas (Eva Freire: **4** ventas por **$7,665 USD**, Karla Freire: **1** venta por **$2,835 USD**)"].
- **Asesores sin ventas**: [Nombres con sus respectivas cotizaciones].
12. En caso de empate, menciona a todos los empatados.

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
        max_tokens: 450,
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
