const router = require('express').Router()
const auth = require('../middleware/auth')
const fs = require('fs')
const path = require('path')

// CLAUDE.md global
router.get('/claude-md', auth, (req, res) => {
  try {
    const content = fs.readFileSync(
      path.join(__dirname, '../templates/CLAUDE.md'),
      'utf8'
    )
    res.send(content)
  } catch {
    res.status(404).json({ error: 'CLAUDE.md no encontrado' })
  }
})

// Agente por rol
router.get('/agente/:rol', auth, (req, res) => {
  const { rol } = req.params

  if (req.usuario.rol !== rol && req.usuario.rol !== 'admin') {
    return res.status(403).json({
      error: 'No puedes descargar el agente de otro rol'
    })
  }

  try {
    const content = fs.readFileSync(
      path.join(__dirname, `../templates/agentes/${rol}.md`),
      'utf8'
    )
    res.send(content)
  } catch {
    res.status(404).json({ error: `Agente ${rol} no encontrado` })
  }
})

// Skill de OpenClaw por rol
router.get('/skill/:rol', auth, (req, res) => {
  const { rol } = req.params

  if (req.usuario.rol !== rol && req.usuario.rol !== 'admin') {
    return res.status(403).json({
      error: 'No puedes descargar el skill de otro rol'
    })
  }

  try {
    const content = fs.readFileSync(
      path.join(__dirname, `../templates/skills/${rol}.md`),
      'utf8'
    )
    res.send(content)
  } catch {
    res.status(404).json({ error: `Skill ${rol} no encontrado` })
  }
})

// Estado del límite de uso
router.get('/limite', auth, async (req, res) => {
  const { verificarLimite } = require('../services/anthropic')
  try {
    const estado = await verificarLimite(
      req.usuario.id,
      req.usuario.limite_diario
    )
    res.json(estado)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
