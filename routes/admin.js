const router = require('express').Router()
const bcrypt = require('bcryptjs')
const auth = require('../middleware/auth')
const supabase = require('../config/supabase')

router.use(auth)

// Obtener usuarios
router.get('/usuarios', async (req, res) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo admin' })
  }
  const { data, error } = await supabase
    .from('usuarios')
    .select('*, roles(*)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Crear usuario
router.post('/usuarios', async (req, res) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo admin' })
  }
  const { nombre, username, rol_id, limite_mensual, telegram_chat_id } = req.body

  const password_temp = Math.random().toString(36).slice(-8)
  const password_hash = await bcrypt.hash(password_temp, 10)

  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      nombre,
      username,
      password_hash,
      rol_id,
      limite_mensual,
      telegram_chat_id
    })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json({ usuario: data, password_temp })
})

// Toggle activo/inactivo
router.patch('/usuarios/:id/toggle', async (req, res) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo admin' })
  }
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('activo')
    .eq('id', req.params.id)
    .single()

  const { error } = await supabase
    .from('usuarios')
    .update({ activo: !usuario.activo })
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// Reset contraseña
router.post('/usuarios/:id/reset-password', async (req, res) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo admin' })
  }
  const password_temp = Math.random().toString(36).slice(-8)
  const password_hash = await bcrypt.hash(password_temp, 10)

  const { error } = await supabase
    .from('usuarios')
    .update({ password_hash })
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ password_temp })
})

// Obtener roles
router.get('/roles', async (req, res) => {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('limite_mensual', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Uso por usuario
router.get('/uso/:periodo', async (req, res) => {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo admin' })
  }
  const { periodo } = req.params
  const hoy = new Date()
  let desde

  if (periodo === 'hoy') {
    desde = new Date(hoy.setHours(0, 0, 0, 0))
  } else if (periodo === 'semana') {
    desde = new Date(hoy.setDate(hoy.getDate() - 7))
  } else {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  }

  const { data: usoData } = await supabase
    .from('uso_tokens')
    .select('*, usuarios(nombre, roles(nombre, nivel), limite_mensual)')
    .gte('created_at', desde.toISOString())

  const { data: todosUsuarios } = await supabase
    .from('usuarios')
    .select('id, nombre, roles(nombre, nivel), limite_mensual')
    .eq('activo', true)

  const porUsuario = {}
  todosUsuarios?.forEach(u => {
    porUsuario[u.id] = {
      nombre: u.nombre,
      rol: u.roles?.nombre,
      nivel: u.roles?.nivel,
      limite_mensual: u.limite_mensual || u.roles?.limite_mensual,
      costo_mes: 0,
      tokens_total: 0,
      nodos_creados: 0
    }
  })

  usoData?.forEach(u => {
    if (porUsuario[u.usuario_id]) {
      porUsuario[u.usuario_id].costo_mes += u.costo
      porUsuario[u.usuario_id].tokens_total += u.tokens_input + u.tokens_output
    }
  })

  const { data: nodos } = await supabase
    .from('nodos')
    .select('usuario_id')
    .gte('created_at', desde.toISOString())

  nodos?.forEach(n => {
    if (porUsuario[n.usuario_id]) {
      porUsuario[n.usuario_id].nodos_creados++
    }
  })

  const { data: todoNodos } = await supabase
    .from('nodos')
    .select('tipo')

  const tiposAgrupados = (todoNodos || []).reduce((acc, n) => {
    acc[n.tipo] = (acc[n.tipo] || 0) + 1
    return acc
  }, {})

  const usuarios = Object.values(porUsuario)
  const alertas = usuarios
    .filter(u => u.limite_mensual && (u.costo_mes / u.limite_mensual) >= 0.8)
    .map(u => ({
      tipo: 'limite',
      usuario: u.nombre,
      mensaje: `${u.nombre} está al ${Math.round((u.costo_mes / u.limite_mensual) * 100)}% de su límite mensual`
    }))

  res.json({
    resumen: {
      usuarios_activos: usuarios.filter(u => u.tokens_total > 0).length,
      usuarios_total: usuarios.length,
      tokens_total: usuarios.reduce((a, u) => a + u.tokens_total, 0),
      costo_total: usuarios.reduce((a, u) => a + u.costo_mes, 0),
      presupuesto_total: usuarios.reduce((a, u) => a + (u.limite_mensual || 0), 0),
      nodos_total: todoNodos?.length || 0,
      nodos_nuevos: nodos?.length || 0
    },
    usuarios,
    alertas,
    kb: {
      por_tipo: Object.entries(tiposAgrupados).map(([nombre, cantidad]) => ({
        nombre,
        cantidad,
        nuevos: (nodos || []).filter(n => n.tipo === nombre).length
      }))
    }
  })
})

module.exports = router
