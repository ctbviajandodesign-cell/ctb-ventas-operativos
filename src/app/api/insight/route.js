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
      prompt = `Eres un Director Comercial experto en una operadora de turismo mayorista que vende en modalidad B2B a agencias de viajes minoristas (quienes a su vez venden al consumidor final). Analiza este resumen global del equipo de ventas y da exactamente 2 oraciones de consejo estratégico/diagnóstico comercial en español simple, sin jerga. Concéntrate en el volumen total, los destinos con mayor o menor demanda de las agencias, y si hay proformas perdidas/canceladas, diagnostica si el problema es de precios, objeciones de agencias o rapidez del equipo.
 
Datos Globales del Equipo:
- Meta Global del Equipo: $${metricas.globalGoal || 0}
- Aporte/Utilidad Actual: $${metricas.totalAporte || 0}
- Cumplimiento de Meta: ${metricas.porcentajeMeta ? Number(metricas.porcentajeMeta).toFixed(1) : 0}%
- Restante para Meta: $${Math.max(0, (metricas.globalGoal || 0) - (metricas.totalAporte || 0))}
- Proformas Perdidas/Canceladas por Agencias: ${metricas.perdidas || 0}
- Principales Motivos de Pérdida (Objeciones de Agencias): ${metricas.topMotivos || 'Ninguno registrado'}
- Destino Líder del Mes: ${metricas.topDestino || 'N/A'}

Responde SOLO con el consejo en 2 oraciones. Sin títulos ni bullets.`
    } else if (modo === 'INDIVIDUAL_ADMIN') {
      prompt = `Eres un Mentor de Ventas experto analizando el desempeño B2B de un asesor (operador de turismo mayorista vendiendo a agencias minoristas). Da exactamente 2 oraciones de evaluación objetiva en español simple sobre el rendimiento de este asesor para el Administrador, prestando especial atención a la tasa de cierre y a las objeciones que reportan las agencias (motivos de pérdida).

Datos del Asesor B2B (${metricas.nombreAsesor || 'Seleccionado'}):
- Meta Mensual: $${metricas.meta || 0}
- Ganancia Generada: $${metricas.totalAporte || 0}
- Cumplimiento: ${metricas.cumplimiento ? Number(metricas.cumplimiento).toFixed(1) : 0}%
- Tasa de Cierre con Agencias: ${metricas.conversion || 0}%
- Proformas (Ganadas: ${metricas.ganadas || 0}, En Proceso: ${metricas.abiertas || 0}, Perdidas: ${metricas.perdidas || 0})
- Principales Motivos de Pérdida (Objeciones de Agencias): ${metricas.topMotivos || 'Ninguno registrado'}
- Destino Principal Cotizado: ${metricas.topDestino || 'N/A'}

Responde SOLO con la evaluación en 2 oraciones. Sin títulos ni bullets.`
    } else {
      // MODO OPERATIVO (Asesor viendo su propio panel)
      prompt = `Eres un Coach de Ventas B2B de turismo mayorista. Le hablas directamente al asesor que cotiza y vende paquetes a agencias minoristas. Da exactamente 2 oraciones de consejo práctico en español simple, indicándole cómo mejorar su conversión, negociar mejor con las agencias, y superar las objeciones de precios o cancelaciones basadas en sus motivos de pérdida.

Tus Datos Actuales de Ventas B2B:
- Proformas enviadas a Agencias: ${metricas.total || 0}
- En Proceso (esperando cierre de agencia): ${metricas.abiertas || 0}
- Ventas Cerradas: ${metricas.ganadas || 0}
- No concretadas / Perdidas por Objeción: ${metricas.perdidas || 0}
- Principales Motivos de Pérdida (Objeciones de Agencias): ${metricas.topMotivos || 'Ninguno registrado'}
- Tasa de Cierre: ${metricas.conversion || 0}%
- Ganancia/Aporte Acumulado: $${metricas.totalAporte || 0}
- Destino más cotizado: ${metricas.topDestino || 'N/A'}

Responde SOLO con el consejo directo en 2 oraciones. Sin títulos ni bullets.`
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
