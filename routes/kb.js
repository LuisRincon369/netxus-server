const router = require('express').Router()
const auth = require('../middleware/auth')
const permisos = require('../middleware/permisos')
const { guardarNodo, buscarNodos, buscarNodosSnippet } = require('../services/kb')

// Buscar en KB — snippet optimizado
router.post('/buscar', auth, permisos('kb:read'), async (req, res) => {
  const { consulta, proyecto_id, tipo, limite, completo } = req.body
  try {
    const nodos = completo
      ? await buscarNodos({ consulta, proyecto_id, tipo, limite })
      : await buscarNodosSnippet({ consulta, proyecto_id, tipo, limite })
    res.json(nodos)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Guardar nodo en KB
router.post('/guardar', auth, permisos('kb:write'), async (req, res) => {
  const { proyecto_id, tipo, titulo, contenido, hu_id } = req.body
  try {
    const nodo = await guardarNodo({
      proyecto_id,
      usuario_id: req.usuario.id,
      tipo,
      titulo,
      contenido,
      hu_id
    })
    res.json(nodo)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Listar nodos recientes
router.get('/recientes', auth, permisos('kb:read'), async (req, res) => {
  const supabase = require('../config/supabase')
  const { proyecto_id, limite = 10 } = req.query
  try {
    let query = supabase
      .from('nodos')
      .select('id, titulo, tipo, hu_id, created_at, usuarios(nombre)')
      .order('created_at', { ascending: false })
      .limit(limite)

    if (proyecto_id) query = query.eq('proyecto_id', proyecto_id)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
