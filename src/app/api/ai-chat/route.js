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
      estado: q.estado,
      total: Number(q.valor_total || 0),
      aporte: Number(q.valor_utilidad || 0) + Number(q.valor_comision || 0),
      operativo: q.profiles?.nombre || 'Desconocido',
      comercial: q.comercial || '---',
      fecha: q.created_at ? q.created_at.split('T')[0] : ''
    })) || []

    const prompt = `Eres un asistente inteligente de analítica comercial para la mayorista de turismo "CTB Viajando". 
Tienes acceso a los registros de cotizaciones filtrados por el período actual elegido por el usuario. 
Tu tarea es responder la pregunta comercial del usuario de forma extremadamente precisa, clara y amigable en español.

Si la pregunta requiere cálculos matemáticos (por ejemplo, sumas de ventas, conteos de cotizaciones por agencia, promedios de conversión o listados), CALCÚLALOS y obtén el resultado exacto analizando los datos reales provistos a continuación.

Datos reales de cotizaciones en el sistema:
${JSON.stringify(cleanDataset, null, 2)}

Pregunta del usuario:
"${question}"

Instrucciones de respuesta:
1. Responde de forma directa a la pregunta en español.
2. Si realizas un cálculo, desglosa brevemente el resultado para dar confianza (ej. "La agencia que más cotizó fue Viajes X con 5 cotizaciones, de las cuales se vendieron 2...").
3. Mantén un tono profesional, comercial y analítico.
4. Responde en un formato limpio (puedes usar viñetas si es necesario). No inventes datos que no estén en la lista.`

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
