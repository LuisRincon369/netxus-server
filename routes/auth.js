const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const supabase = require('../config/supabase')
require('dotenv').config()

// Login usuario normal
router.post('/login', async (req, res) => {
  const { username, password } = req.body
  try {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*, roles(*)')
      .eq('username', username)
      .eq('activo', true)
      .single()

    if (error || !usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado' })
    }

    const valida = await bcrypt.compare(password, usuario.password_hash)
    if (!valida) {
      return res.status(401).json({ error: 'Contraseña incorrecta' })
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        rol: usuario.roles.nombre,
        nivel: usuario.roles.nivel,
        max_tokens: usuario.roles.max_tokens,
        temperature: usuario.roles.temperature,
        limite_diario: usuario.roles.limite_diario_tokens,
        limite_mensual: usuario.roles.limite_mensual
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      token,
      usuario: {
        nombre: usuario.nombre,
        rol: usuario.roles.nombre,
        nivel: usuario.roles.nivel,
        limite_mensual: usuario.roles.limite_mensual
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Login admin
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body
  try {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*, roles(*)')
      .eq('username', username)
      .eq('activo', true)
      .single()

    if (error || !usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado' })
    }

    if (usuario.roles.nombre !== 'admin') {
      return res.status(403).json({ error: 'Acceso solo para admin' })
    }

    const valida = await bcrypt.compare(password, usuario.password_hash)
    if (!valida) {
      return res.status(401).json({ error: 'Contraseña incorrecta' })
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        rol: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      token,
      admin: {
        nombre: usuario.nombre,
        username: usuario.username
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
