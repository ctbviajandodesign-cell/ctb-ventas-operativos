import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ insight: null, error: 'No API key configured' }, { status: 200 })
    }

    const { metricas, modo = 'OPERATIVE' } = await request.json()

    let prompt = ''

    if (modo === 'GLOBAL_ADMIN') {
      prompt = `Eres un Director Comercial de turismo experto. Analiza este resumen global del equipo de ventas y da exactamente 2 oraciones de consejo estratégico en español simple, sin jerga, para motivar al equipo y alcanzar la meta global. Sé directo y enfocado en números finales, y si hay proformas perdidas, menciona los motivos principales para corregir el rumbo.

Datos Globales del Equipo:
- Meta Global del Equipo: $${metricas.globalGoal || 0}
- Aporte/Utilidad Actual: $${metricas.totalAporte || 0}
- Cumplimiento de Meta: ${metricas.porcentajeMeta ? Number(metricas.porcentajeMeta).toFixed(1) : 0}%
- Restante para Meta: $${Math.max(0, (metricas.globalGoal || 0) - (metricas.totalAporte || 0))}
- Proformas Perdidas/Canceladas: ${metricas.perdidas || 0}
- Principales Motivos de Pérdida: ${metricas.topMotivos || 'N/A'}

Responde SOLO con el consejo en 2 oraciones. Sin títulos ni bullets.`
    } else if (modo === 'INDIVIDUAL_ADMIN') {
      prompt = `Eres un Mentor de Ventas experto analizando a un asesor específico para darle feedback al Administrador. Da exactamente 2 oraciones de evaluación objetiva en español simple sobre el rendimiento de este asesor y qué aspecto clave debe ajustar, prestando especial atención a por qué está perdiendo ventas.

Datos del Asesor (${metricas.nombreAsesor || 'Seleccionado'}):
- Meta Mensual: $${metricas.meta || 0}
- Ganancia Generada: $${metricas.totalAporte || 0}
- Cumplimiento: ${metricas.cumplimiento ? Number(metricas.cumplimiento).toFixed(1) : 0}%
- Tasa de Cierre: ${metricas.conversion || 0}%
- Proformas (Ganadas: ${metricas.ganadas || 0}, En Proceso: ${metricas.abiertas || 0}, Perdidas: ${metricas.perdidas || 0})
- Principales Motivos de Pérdida: ${metricas.topMotivos || 'N/A'}

Responde SOLO con la evaluación en 2 oraciones. Sin títulos ni bullets.`
    } else {
      // MODO OPERATIVO (Asesor viendo su propio panel)
      prompt = `Eres un Coach de Ventas de turismo motivador y directo. Estás hablando directamente con el asesor de viajes sobre su desempeño actual. Da exactamente 2 oraciones de consejo práctico en español simple, sin jerga, que le ayuden a mejorar sus cierres y le aconsejen cómo superar las objeciones basadas en sus principales motivos de pérdida.

Tus Datos Actuales:
- Proformas enviadas: ${metricas.total || 0}
- En Proceso (esperando cierre): ${metricas.abiertas || 0}
- Ventas Cerradas: ${metricas.ganadas || 0}
- No concretadas / Perdidas: ${metricas.perdidas || 0}
- Principales Motivos de Pérdida: ${metricas.topMotivos || 'N/A'}
- Tasa de Cierre: ${metricas.conversion || 0}%
- Ganancia/Aporte Acumulado: $${metricas.totalAporte || 0}
- Destino más cotizado: ${metricas.topDestino || 'N/A'}

Responde SOLO con el consejo directo hacia el asesor en 2 oraciones. Sin títulos ni bullets.`
    }

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
