import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ answer: 'El sistema de Inteligencia Artificial no está configurado (falta la clave API de OpenAI).', error: 'No API key' })
    }

    const { question, dataset } = await request.json()

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
      comercial: q.comercial || '---',
      pasajeros: q.numero_pasajeros || (Array.isArray(q.nombres_pasajeros) ? q.nombres_pasajeros.length : 0),
      motivo_perdida: q.motivo_perdida || '',
      fecha: q.created_at ? q.created_at.split('T')[0] : ''
    })) || []

    const prompt = `Eres un Director de Inteligencia Comercial y Asistente Analítico Experto para la operadora de turismo mayorista "CTB Viajando".
Tienes acceso a los registros de cotizaciones del periodo activo seleccionado en el panel de control.
Tu objetivo es responder de forma brillante, profesional, concisa y basada 100% en los datos reales provistos a continuación.

Contexto del Negocio:
- "ganada" = Cotizaciones que ya pasaron a ser vendidas (también llamadas Proformas Vendidas).
- "abierta" = Cotizaciones pendientes de cierre por parte de las agencias minoristas (En espera).
- "perdida" / "anulada" = Cotizaciones no concretadas / canceladas.
- "aporte_ctb" = Es el margen real de la empresa (Utilidad + Comisión). Este es el valor que suma hacia las metas mensuales.
- "valor_venta" = Es el cobro/monto total bruto del paquete turístico.

Datos reales de cotizaciones actuales:
${JSON.stringify(cleanDataset, null, 2)}

Pregunta del usuario:
"${question}"

Instrucciones de Respuesta:
1. Analiza los registros con máxima precisión y profesionalismo.
2. Si te preguntan sobre rendimiento de asesores, motivos de rechazo, destinos líderes, ganancias acumuladas o volumen de agencias, haz los cálculos matemáticos correspondientes.
3. Desglosa brevemente los números para respaldar tu respuesta (ej: "Se registraron 5 cotizaciones para Galápagos, de las cuales 3 fueron ganadas ($6,000 USD total) y 2 perdidas por precio...").
4. Si la pregunta es abierta o de diagnóstico, aporta 1 recomendación de negocio accionable al final (ej: "Recomiendo revisar las tarifas de X destino ya que el 40% se pierde por objeción de precio").
5. Responde con un tono ejecutivo, motivador y claro en español. Utiliza negritas para resaltar nombres o montos clave.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
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
