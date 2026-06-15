const Anthropic = require('@anthropic-ai/sdk')
const supabase = require('../config/supabase')
require('dotenv').config()

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const niveles = {
  bajo:  { max_tokens: 1000, temperature: 0.2 },
  medio: { max_tokens: 4000, temperature: 0.5 },
  alto:  { max_tokens: 8000, temperature: 0.8 }
}

async function verificarLimite(usuario_id, limite_diario) {
  const hoy = new Date().toISOString().split('T')[0]

  const { data: uso } = await supabase
    .from('uso_tokens')
    .select('tokens_input, tokens_output')
    .eq('usuario_id', usuario_id)
    .eq('fecha', hoy)

  const totalHoy = (uso || []).reduce(
    (acc, u) => acc + u.tokens_input + u.tokens_output, 0
  )

  const porcentaje = (totalHoy / limite_diario) * 100

  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  manana.setHours(0, 0, 0, 0)

  return {
    bloqueado: porcentaje >= 100,
    porcentaje: Math.min(porcentaje, 100),
    restablece: manana.toISOString(),
    tokens_usados: totalHoy
  }
}

async function consultar({ usuario, messages, system = '' }) {
  const limite = await verificarLimite(usuario.id, usuario.limite_diario)

  if (limite.bloqueado) {
    throw new Error(
      `Has alcanzado tu límite de uso por hoy. Tu límite se restablece mañana a las 00:00.`
    )
  }

  const config = niveles[usuario.nivel] || niveles.medio

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: config.max_tokens,
    system,
    messages
  })

  await supabase.from('uso_tokens').insert({
    usuario_id: usuario.id,
    tokens_input: response.usage.input_tokens,
    tokens_output: response.usage.output_tokens,
    costo: (response.usage.input_tokens * 0.000003) +
           (response.usage.output_tokens * 0.000015),
    fecha: new Date().toISOString().split('T')[0]
  })

  if (limite.porcentaje >= 80) {
    const texto = response.content[0].text
    const aviso = `\n\n---\nPor cierto — estás al ${Math.round(limite.porcentaje)}% de tu uso disponible hoy. Tu límite se restablece mañana a las 00:00.`
    response.content[0].text = texto + aviso
  }

  return response
}

module.exports = { consultar, verificarLimite }
