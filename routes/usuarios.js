const router = require('express').Router()
const auth = require('../middleware/auth')
const supabase = require('../config/supabase')

// Actualizar telegram del usuario autenticado
router.put('/telegram', auth, async (req, res) => {
  const { telegram_chat_id } = req.body
  const { error } = await supabase
    .from('usuarios')
    .update({ telegram_chat_id })
    .eq('id', req.usuario.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

module.exports = router
