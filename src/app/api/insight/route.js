import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ insight: null, error: 'No API key configured' }, { status: 200 })
    }

    const { metricas } = await request.json()

    const prompt = `Eres un asesor de ventas de turismo experto. Analiza estos datos de rendimiento de un asesor de viajes y da exactamente 2 oraciones de consejo práctico en español simple, sin jerga técnica, que ayuden al asesor a cerrar más ventas este mes. Sé directo y motivador.

Datos del asesor:
- Proformas enviadas: ${metricas.total || 0}
- En proceso (esperando cierre): ${metricas.abiertas || 0}
- Ventas cerradas: ${metricas.ganadas || 0}
- No concretadas: ${metricas.perdidas || 0}
- Tasa de cierre: ${metricas.conversion || 0}%
- Ganancia acumulada: $${metricas.totalAporte || 0}
- Destino más cotizado: ${metricas.topDestino || 'N/A'}

Responde SOLO con el consejo en 2 oraciones. Sin títulos ni bullets.`

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
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`)
    }

    const data = await response.json()
    const insight = data.choices?.[0]?.message?.content?.trim()

    return NextResponse.json({ insight })
  } catch (error) {
    console.error('AI insight error:', error)
    return NextResponse.json({ insight: null, error: error.message }, { status: 200 })
  }
}
