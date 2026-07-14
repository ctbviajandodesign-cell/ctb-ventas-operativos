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
      prompt = `Eres un Estratega de Negocios de alto nivel (C-Level, MBA) evaluando el desempeño global de una empresa mayorista de turismo B2B.
Analiza el embudo y da exactamente 2 oraciones de diagnóstico ejecutivo para los dueños. 
NO repitas los números (ya los están viendo en pantalla). Diagnostica cuellos de botella sistémicos (¿es pricing, retención, falta de empuje comercial, exceso de caducadas por falta de seguimiento?).
Sé incisivo, honesto, directo y orientado a escalar las ganancias. NUNCA seas grosero ni uses palabras como "incapacidad" o "incompetencia"; mantén un tono de consultor de élite, constructivo pero crudo. Cero frases genéricas.
 
Datos Globales del Equipo:
- Meta Global del Equipo: $${metricas.globalGoal || 0}
- Utilidad de CTB Actual: $${metricas.totalAporte || 0}
- Cumplimiento de Meta: ${metricas.porcentajeMeta ? Number(metricas.porcentajeMeta).toFixed(1) : 0}%
- Restante para Meta: $${Math.max(0, (metricas.globalGoal || 0) - (metricas.totalAporte || 0))}
- Cotizaciones Caducadas (Venció su vigencia): ${metricas.caducadas || 0}
- Cotizaciones Perdidas (No cerraron): ${metricas.perdidas || 0}
- Cotizaciones Anuladas (Se vendieron pero el cliente canceló): ${metricas.anuladas || 0}
- Principales Motivos de Pérdida (Objeciones de Agencias): ${metricas.topMotivos || 'Ninguno registrado'}
- Destino Líder del Mes: ${metricas.topDestino || 'N/A'}

Responde SOLO con el consejo en 2 oraciones. Sin títulos ni bullets.`
    } else if (modo === 'INDIVIDUAL_ADMIN') {
      prompt = `Eres un Consultor de Negocios (MBA) y Director de Ventas implacable evaluando a un ejecutivo B2B de turismo. 
Tu objetivo es darle al Administrador un diagnóstico agudo, honesto y directo sobre este asesor, basado estrictamente en sus números. 
NO resumas ni repitas los números. Úsalos para diagnosticar la raíz del problema o la clave del éxito.
Si el cierre es bajo y hay muchas caducadas, el problema es falta de seguimiento agresivo. Si hay muchas perdidas, es problema de negociación/precio.
Sé asertivo y estratégico. NUNCA seas grosero ni uses palabras como "incapacidad" o "incompetente". Habla como un consultor de élite orientando al negocio.
Da exactamente 2 oraciones de diagnóstico ejecutivo en español. Cero paja, cero frases genéricas.

Datos del Asesor B2B (${metricas.nombreAsesor || 'Seleccionado'}):
- Meta Mensual: $${metricas.meta || 0}
- Utilidad de CTB Generada: $${metricas.totalAporte || 0}
- Cumplimiento: ${metricas.cumplimiento ? Number(metricas.cumplimiento).toFixed(1) : 0}%
- Tasa de Cierre con Agencias: ${metricas.conversion || 0}%
- Cotizaciones (Ganadas: ${metricas.ganadas || 0}, En Espera: ${metricas.abiertas || 0}, Caducadas: ${metricas.caducadas || 0}, Perdidas: ${metricas.perdidas || 0}, Anuladas post-venta: ${metricas.anuladas || 0})
- Principales Motivos de Pérdida (Objeciones de Agencias): ${metricas.topMotivos || 'Ninguno registrado'}
- Destino Principal Cotizado: ${metricas.topDestino || 'N/A'}

Responde SOLO con la evaluación en 2 oraciones. Sin títulos ni bullets.`
    } else {
      // MODO OPERATIVO (Asesor viendo su propio panel)
      prompt = `Eres un Consultor de Negocios (MBA) y Coach de Ventas B2B implacable y ultra-analítico. Le hablas directamente ("tú") al asesor de turismo. 
Tu trabajo es darle un consejo estratégico agresivo, honesto y altamente accionable basado en sus números. 
NO repitas los datos que te doy. Úsalos para diagnosticar su falla o apalancar su éxito. 
Sé extremadamente directo y retador, como un gerente de ventas de élite exigiendo resultados. Sin embargo, NUNCA seas grosero ni uses palabras como "incapacidad" o "incompetente". Mantén el respeto profesional pero con máxima exigencia.
Cero frases genéricas como "sigue así" o "esfuérzate más". Dile exactamente qué parte de su embudo está rota (ej: "Tienes X caducadas, estás perdiendo dinero por no llamar a las agencias") o qué táctica de negocio debe aplicar hoy.
Da exactamente 2 oraciones directas, como un balazo.

Tus Datos Actuales de Ventas B2B:
- Cotizaciones enviadas a Agencias: ${metricas.total || 0}
- En Espera (esperando cierre de agencia): ${metricas.abiertas || 0}
- Ventas Cerradas: ${metricas.ganadas || 0}
- Ventas Anuladas post-cierre: ${metricas.anuladas || 0}
- Caducadas por falta de cierre: ${metricas.caducadas || 0}
- No concretadas / Perdidas por Objeción: ${metricas.perdidas || 0}
- Principales Motivos de Pérdida (Objeciones de Agencias): ${metricas.topMotivos || 'Ninguno registrado'}
- Tasa de Cierre: ${metricas.conversion || 0}%
- Utilidad de CTB Acumulada: $${metricas.totalAporte || 0}
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
