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
      ciudad: q.profiles?.ciudad || 'Desconocido',
      comercial: q.comercial || '---',
      pasajeros: q.numero_pasajeros || (Array.isArray(q.nombres_pasajeros) ? q.nombres_pasajeros.length : 0),
      motivo_perdida: q.motivo_perdida || '',
      fecha: q.created_at ? q.created_at.split('T')[0] : ''
    })) || []

    const prompt = `Eres un asistente de datos comercial directo y veloz para la mayorista "CTB Viajando".
Tienes acceso a las cotizaciones del periodo seleccionado en el panel de control.
Tu único objetivo es responder a la pregunta del usuario con la mayor brevedad posible, yendo DIRECTAMENTE al grano. Evita introducciones, saludos o conclusiones innecesarias.

Contexto del Negocio:
- "ganada" = Cotizaciones vendidas (Proformas).
- "abierta" = En espera.
- "perdida" / "anulada" = Canceladas.
- "aporte_ctb" = Comisión + Utilidad (nuestro margen).
- "valor_venta" = Monto bruto.

Datos de cotizaciones:
${JSON.stringify(cleanDataset, null, 2)}

Pregunta del usuario:
"${question}"

Reglas estrictas de formato:
1. Responde de forma directa al grano en máximo dos o tres líneas. No agregues preámbulos como "Analizando los registros..." o "En base a los datos...".
2. Si te preguntan "quién cotizó más" o similar, di el nombre, la cantidad y el desglose básico (ej: "Karla Freire con 4 cotizaciones (todas en espera)"). No listes pasajero por pasajero ni agencia por agencia a menos que te pidan explícitamente "detalla" o "lista".
3. No des recomendaciones ni consejos comerciales a menos que el usuario te pregunte explícitamente "¿Qué opinas?", "¿Qué me recomiendas?" o "¿Por qué no se vende?".
4. Usa negrita únicamente para destacar nombres de personas, agencias o montos monetarios.`

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
