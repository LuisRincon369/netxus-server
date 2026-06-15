// fetch es global desde Node 18+ (usamos Node 24), no hace falta node-fetch
const supabase = require('../config/supabase')
require('dotenv').config()

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function enviarMensaje(chat_id, mensaje) {
  const response = await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id,
      text: mensaje,
      parse_mode: 'Markdown'
    })
  })
  return response.json()
}

async function notificarUsuario(username, mensaje) {
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('telegram_chat_id, nombre')
    .eq('username', username)
    .single()

  if (!usuario?.telegram_chat_id) {
    console.log(`${username} no tiene Telegram configurado`)
    return
  }

  return enviarMensaje(usuario.telegram_chat_id, mensaje)
}

async function notificarLimite(usuario_id, porcentaje) {
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('telegram_chat_id, nombre')
    .eq('id', usuario_id)
    .single()

  if (!usuario?.telegram_chat_id) return

  const mensaje = porcentaje >= 100
    ? `🔴 *NETXUS*\nAlcanzaste tu límite de uso de hoy.\nTu límite se restablece mañana a las 00:00.\nContacta al admin si necesitas más.`
    : `⚠️ *NETXUS*\nEstás al ${Math.round(porcentaje)}% de tu uso disponible hoy.\nTu límite se restablece mañana a las 00:00.`

  return enviarMensaje(usuario.telegram_chat_id, mensaje)
}

module.exports = { enviarMensaje, notificarUsuario, notificarLimite }
