import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ answer: 'El sistema de Inteligencia Artificial no está configurado (falta la clave API de OpenAI).', error: 'No API key' })
    }

    const { question, dataset, leaderboard, operativos } = await request.json()

    // Formateador robusto para la hora de Ecuador (America/Guayaquil, UTC-5)
    // Evita problemas de desfases y funciona de manera idéntica en cualquier servidor (local o Vercel)
    const getLocalDateIso = (dateVal) => {
      if (!dateVal) return ''
      try {
        const d = new Date(dateVal)
        if (isNaN(d.getTime())) return ''
        const parts = new Intl.DateTimeFormat('es-EC', {
          timeZone: 'America/Guayaquil',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).formatToParts(d)
        const map = {}
        parts.forEach(p => { map[p.type] = p.value })
        return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`
      } catch (err) {
        return typeof dateVal === 'string' ? dateVal.replace('T', ' ').substring(0, 16) : ''
      }
    }

    const localNow = new Date()
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const todayIso = formatter.format(localNow)

    const localYesterday = new Date(localNow.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayIso = formatter.format(localYesterday)

    const localBeforeYesterday = new Date(localNow.getTime() - 2 * 24 * 60 * 60 * 1000)
    const beforeYesterdayIso = formatter.format(localBeforeYesterday)

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Guayaquil' }
    const todayStr = localNow.toLocaleDateString('es-ES', options)

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
        fecha:            getLocalDateIso(q.created_at)
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

    // Motivos de pérdida
    const motivosPerdidaMap = {}
    cleanDataset.filter(q => q.motivo_perdida).forEach(q => {
      motivosPerdidaMap[q.motivo_perdida] = (motivosPerdidaMap[q.motivo_perdida] || 0) + 1
    })

    // Operativos resumen
    const operativosMap = {}
    cleanDataset.forEach(q => {
      if (!operativosMap[q.operativo]) operativosMap[q.operativo] = { cotizaciones: 0, ventas: 0, monto: 0, comision: 0, utilidad: 0, ingreso_ctb: 0 }
      operativosMap[q.operativo].cotizaciones++
      if (q.es_venta) {
        operativosMap[q.operativo].ventas++
        operativosMap[q.operativo].monto += q.valor_venta
        operativosMap[q.operativo].comision += q.comision
        operativosMap[q.operativo].utilidad += q.utilidad
        operativosMap[q.operativo].ingreso_ctb += q.aporte_ctb
      }
    })

    // Comerciales resumen
    const comercialesMap = {}
    cleanDataset.filter(q => q.comercial).forEach(q => {
      if (!comercialesMap[q.comercial]) comercialesMap[q.comercial] = { cotizaciones: 0, ventas: 0, monto: 0, comision: 0, utilidad: 0, ingreso_ctb: 0 }
      comercialesMap[q.comercial].cotizaciones++
      if (q.es_venta) {
        comercialesMap[q.comercial].ventas++
        comercialesMap[q.comercial].monto += q.valor_venta
        comercialesMap[q.comercial].comision += q.comision
        comercialesMap[q.comercial].utilidad += q.utilidad
        comercialesMap[q.comercial].ingreso_ctb += q.aporte_ctb
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

    const prompt = `Eres un Consultor de Ventas y Estratega de Negocios de élite (nivel MBA), experto en análisis de datos comerciales para la empresa mayorista de turismo B2B "CTB Viajando". 
Tu objetivo es dar respuestas honestas, directas, altamente estratégicas y basadas estrictamente en los números. No uses un tono genérico ni complaciente; sé asertivo, profesional, y enfocado en identificar cuellos de botella, oportunidades de conversión y rentabilidad. Sé constructivo, pero no temas señalar dónde están las fugas de dinero o los fallos de seguimiento (sin ser grosero ni usar términos como "incapacidad"). 

Responde la pregunta del usuario usando ÚNICAMENTE los datos pre-calculados que se muestran a continuación. Razona internamente paso a paso, pero entrega solo la respuesta ejecutiva final.

=== FECHA ACTUAL Y CONTEXTO TEMPORAL ===
- Fecha y día de hoy: ${todayStr} (formato YYYY-MM-DD: ${todayIso})
- Usa esta fecha de hoy como referencia absoluta para interpretar términos relativos en la pregunta del usuario:
  * "hoy" se refiere al día: ${todayIso}
  * "ayer" se refiere al día: ${yesterdayIso}
  * "anteayer" se refiere al día: ${beforeYesterdayIso}
- Al responder preguntas sobre registros del día de ayer, hoy o fechas específicas, describe con precisión los datos y menciona explícitamente el día de la semana y fecha correspondientes (ej: "ayer martes 26 de mayo" o "hoy miércoles 27 de mayo") para ubicar al usuario en el contexto temporal exacto.

=== REGLAS DE FILTRADO TEMPORAL OBLIGATORIO ===
1. Si el usuario pregunta por un día específico o relativo (como "hoy", "ayer" o "anteayer"), debes filtrar el dataset del período completo para quedarte ÚNICAMENTE con los registros individuales cuya propiedad "fecha" comience con la fecha del día consultado (ej: para "hoy", filtrar donde "fecha" comience con ${todayIso}; para "ayer", filtrar donde "fecha" comience con ${yesterdayIso}).
2. Realiza TODOS tus cálculos de cotizaciones totales, resúmenes de ventas de ese día, desgloses por operativo y conclusiones basándote EXCLUSIVAMENTE en ese subconjunto filtrado.
3. NUNCA respondas con los totales del período completo de 49 cotizaciones si el usuario está preguntando por un día en específico como "hoy" o "ayer".
4. Si no existen registros en el dataset para el día consultado, dilo claramente (ej: "No se registran cotizaciones ni ventas para ayer martes 26 de mayo").

=== DEFINICIONES ===
- "agencia": Cliente externo / agencia de viajes (ej: HUALAMBARI, DREAMS).
- "operativo" o "asesor": Asesor interno de CTB Viajando (ej: Karla Freire, Eva Freire).
- "comercial": Canal o ejecutivo comercial que trajo el negocio.
- "destino": Lugar turístico del viaje.
- "ciudad" o "país" en contexto CTB = sede del operativo (Quito, Guayaquil, Cuenca, etc.).
- Venta confirmada = "es_venta: true" en el dataset.
- "Utilidad de CTB": Es la utilidad real para la empresa (CTB Viajando), calculada como la suma de comisión + margen (comision + utilidad). Es distinto al "monto de venta" (que representa el costo cobrado al cliente).

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

=== MOTIVOS DE PÉRDIDA ===
${JSON.stringify(motivosPerdidaMap, null, 2)}

=== RESUMEN POR OPERATIVO ===
${JSON.stringify(operativosMap, null, 2)}

=== RESUMEN POR COMERCIAL ===
${JSON.stringify(Object.keys(comercialesMap).length > 0 ? comercialesMap : { 'sin_datos': 'No hay comerciales registrados' }, null, 2)}

=== OPERATIVOS POR CIUDAD/SEDE ===
${JSON.stringify(porCiudad, null, 2)}

=== RANKING DE CIUDADES/SEDES POR VENTAS ===
${JSON.stringify(rankingCiudades, null, 2)}

=== LISTADO DETALLADO DE REGISTROS (CON FECHAS INDIVIDUALES) ===
${JSON.stringify(cleanDataset.map(q => ({
  ref: q.ref,
  fecha: q.fecha,
  operativo: q.operativo,
  es_venta: q.es_venta,
  valor: q.es_venta ? q.valor_venta : q.valor_cotizacion,
  comision: q.comision,
  utilidad: q.utilidad,
  ingreso_ctb: q.aporte_ctb,
  destino: q.destino,
  agencia: q.agencia
})), null, 2)}

=== LEADERBOARD DE ASESORES (con metas) ===
${JSON.stringify(cleanLeaderboard, null, 2)}

=== REGLAS DE RESPUESTA ===
1. Responde de forma muy didáctica, sintetizada y directa. Utiliza saltos de línea y listas con viñetas (-) para organizar la información en un máximo de 3 o 4 puntos clave. Evita bloques compactos de texto corrido y NUNCA dupliques información.
2. NUNCA utilices títulos con almohadillas (evita caracteres como #, ##, ###). Si necesitas rotular una sección, usa texto en negrita al inicio de la línea.
3. **Claridad de Contexto (Sin Memoria Conversacional)**: Eres una IA "One-Shot" (no tienes memoria de los mensajes anteriores). Por lo tanto, NUNCA le hagas preguntas al usuario que requieran que él te responda para aclarar la consulta (ej: "¿De qué mes hablas?"). Si la pregunta es muy general, **asume automáticamente** que se refiere al período que el usuario tiene filtrado en su pantalla (el dataset que estás recibiendo) y entrégale la respuesta inmediatamente, pero acláralo (ej: "Según el período que tienes filtrado actualmente..."). Si haces preguntas estratégicas al final, deben ser retóricas o para reflexión del administrador, no para que te las responda en el chat.
4. Usa negrita para nombres, destinos, porcentajes y montos: **DREAMS**, **Karla Freire**, **Cancún**, **15%**, **$1,035 USD**.
4. **Agrupación Obligatoria**: Si un mismo asesor/operativo tiene múltiples cotizaciones o ventas en el subconjunto de datos, debes **agruparlas y sumarlas** en un único total. NUNCA listes al mismo asesor más de una vez en el mismo resumen.
5. **Cruces de Datos y Comparaciones**: Eres capaz de hacer comparaciones cruzadas. Si el usuario te pide comparar dos operativos, buscar el mejor vendedor de un destino específico, o identificar quién vendió menos en una ciudad, analiza el "LISTADO DETALLADO DE REGISTROS" y las agrupaciones para responder con precisión matemática exacta basándote en los números reales.
6. **Escalabilidad de Ventas**: NUNCA listes transacciones individuales una por una (agencia por agencia) a menos que el usuario lo pida explícitamente. Usa resúmenes ejecutivos.
6. **Resúmenes y Rendimiento**: Para preguntas sobre quién vendió más/menos, quién cotizó más/menos, resúmenes del día/mes o rendimiento general, agrupa y resume los datos por operativo/asesor mostrando: **Asesor**: **X** cotizaciones | **Y** ventas (**$Z USD** de monto total, con una Utilidad de CTB de **$I USD** [comisión + margen]) | **W%** de conversión (ventas / cotizaciones).
7. **Consultoría y Estrategia**: Si el usuario hace una pregunta abierta, analítica o estratégica, **NO** respondas con listas planas. Actúa como el Estratega de Negocios MBA: cruza datos, identifica cuellos de botella y da un consejo accionable. Si necesitas más contexto de negocio, plantea escenarios probables (ej: "Si esta caída de ventas es por precios, sugiero X; si es por falta de leads, sugiero Y").
8. **Comparaciones de Ventas (Monto vs Cantidad)**: Al determinar "quién vendió más" o "quién vendió menos":
   - Si la cantidad de ventas es diferente (ej: 2 ventas vs 1 venta), el mayor vendedor es quien tenga más ventas cerradas.
   - Si la cantidad de ventas es igual (ej: empate con 1 venta cada uno), el mayor vendedor se define por el monto facturado: el de mayor valor en dólares ($) vendió más, y el de menor valor vendió menos.
   - ¡CUIDADO! Realiza la comparación numérica con precisión básica: un monto como **$1,240 USD** es mayor que **$582 USD**, por ende el asesor con **$1,240 USD** es el mayor vendedor y el de **$582 USD** es el menor. No inviertas los resultados.
8. **Comparaciones complejas** (ej: "quién cotizó más y vendió menos"): Sé analítico y preciso. Desglosa ambas variables por separado (ej: quién tiene el número más alto de cotizaciones y quién tiene el número más bajo de ventas o la peor tasa de conversión) para dar una conclusión lógica y coherente, en lugar de atribuir ambas cosas erróneamente a una sola persona si no cumple ambas condiciones de forma absoluta.
9. Si preguntan por "solo cotizó sin vender" → usa la lista "AGENCIAS QUE SOLO COTIZARON".
10. Si preguntan "qué operativos hay de [ciudad]" → busca en "OPERATIVOS POR CIUDAD/SEDE" esa ciudad y lista sus nombres.
11. Si preguntan "ranking por ciudad/sede" o "quién va ganando por país" → usa "RANKING DE CIUDADES/SEDES POR VENTAS".
12. Si algo no tiene datos, responde: "No se registran datos para [Nombre] en este período."
13. Si la pregunta es abierta o ambigua ("quién vendió", "qué se vendió", "resumen de hoy"), da siempre un desglose sintetizado en un formato de lista muy limpio y unificado de máximo 3 puntos:
- **Cotizaciones totales**: [Total, y de forma inline el desglose por asesor. Ej: "Total de **21** cotizaciones (Eva Freire: **11**, Karla Freire: **9**)"].
- **Resumen de Ventas**: [Monto total vendido e inline el desglose resumido por asesor, indicando siempre la Utilidad de CTB (comisión + margen) para cada uno. Ej: "Total de **$1,822 USD** en **2** ventas con una Utilidad de CTB de **$320 USD** (Karla Freire: **1** venta por **$1,240 USD** | Utilidad CTB: **$210 USD**; Eva Freire: **1** venta por **$582 USD** | Utilidad CTB: **$110 USD**)"].
- **Asesores sin ventas**: [Nombres con sus respectivas cotizaciones].
14. En caso de empate, menciona a todos los empatados.

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
