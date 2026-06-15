require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

// Rutas
app.use('/auth',     require('./routes/auth'))
app.use('/kb',       require('./routes/kb'))
app.use('/webhooks', require('./routes/webhooks'))
app.use('/admin',    require('./routes/admin'))
app.use('/config',   require('./routes/config'))
app.use('/usuarios', require('./routes/usuarios'))

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'NETXUS',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Error interno del servidor' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`
  ███╗   ██╗███████╗████████╗██╗  ██╗██╗   ██╗███████╗
  ████╗  ██║██╔════╝╚══██╔══╝╚██╗██╔╝██║   ██║██╔════╝
  ██╔██╗ ██║█████╗     ██║    ╚███╔╝ ██║   ██║███████╗
  ██║╚██╗██║██╔══╝     ██║    ██╔██╗ ██║   ██║╚════██║
  ██║ ╚████║███████╗   ██║   ██╔╝ ██╗╚██████╔╝███████║
  ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝

  Newinntech Knowledge Agent Network
  Servidor corriendo en puerto ${PORT}
  `)
})
