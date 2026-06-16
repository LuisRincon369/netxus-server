const router = require('express').Router()
const supabase = require('../config/supabase')
const { generarEmbedding } = require('../services/embeddings')
const axios = require('axios')
require('dotenv').config()

// Validar secret
function validarSecret(req, res, next) {
  console.log('Webhook recibido:', req.headers)
  console.log('Body:', JSON.stringify(req.body).slice(0, 200))

  const secret = req.headers['x-netxus-secret']
  if (secret !== process.env.AZURE_WEBHOOK_SECRET) {
    console.log('Secret inválido:', secret)
    return res.status(401).json({ error: 'Webhook no autorizado' })
  }
  next()
}

router.post('/azure', validarSecret, async (req, res) => {
  const { eventType, resource } = req.body

  console.log('EventType:', eventType)
  console.log('Resource repo:', resource?.repository?.name)
  console.log('Commits:', resource?.commits?.length)

  try {
    if (eventType === 'git.push') {
      const repoNombre = resource.repository?.name
      console.log('Repo detectado:', repoNombre)

      if (repoNombre === 'sdd-agentes') {
        console.log('Procesando push a sdd-agentes...')
        await manejarPushSDD(resource)
      } else {
        console.log('Repo ignorado:', repoNombre)
      }
    }
    res.json({ ok: true })
  } catch (error) {
    console.error('Error webhook:', error.message)
    res.status(500).json({ error: error.message })
  }
})

async function manejarPushSDD(resource) {
  const commits = resource.commits || []
  console.log('Commits a procesar:', commits.length)

  const org = process.env.AZURE_DEVOPS_ORG
  const project = process.env.AZURE_DEVOPS_PROJECT
  const pat = Buffer.from(`:${process.env.AZURE_DEVOPS_PAT}`).toString('base64')
  const repoId = resource.repository.id

  for (const commit of commits) {
    console.log('Procesando commit:', commit.commitId)

    try {
      // Obtener archivos del commit via API
      const url = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoId}/commits/${commit.commitId}/changes?api-version=7.0`

      const response = await axios.get(url, {
        headers: { Authorization: `Basic ${pat}` }
      })

      const changes = response.data.changes || []
      console.log('Cambios encontrados:', changes.length)

      const archivos = changes
        .filter(c => c.item?.gitObjectType === 'blob')
        .map(c => c.item.path.replace(/^\//, ''))

      console.log('Archivos a indexar:', archivos)

      for (const archivo of archivos) {
        await indexarArchivo(archivo, repoId)
      }
    } catch (error) {
      console.error('Error obteniendo cambios:', error.message)
    }
  }
}

async function indexarArchivo(rutaArchivo, repoId) {
  if (!rutaArchivo.endsWith('.md')) return

  const tipo = detectarTipo(rutaArchivo)
  if (!tipo) return

  const contenido = await obtenerContenido(repoId, rutaArchivo)
  if (!contenido) return

  const huMatch = rutaArchivo.match(/hu-(\d+)/i)
  const hu_id = huMatch ? `HU-${huMatch[1]}` : null

  const embedding = await generarEmbedding(contenido)

  const nodo = {
    tipo,
    titulo: rutaArchivo.split('/').pop().replace('.md', ''),
    contenido,
    hu_id,
    embedding
  }

  // Si tiene hu_id → upsert, si no → insert normal
  const { error } = hu_id
    ? await supabase.from('nodos').upsert(nodo, {
        onConflict: 'hu_id,tipo',
        ignoreDuplicates: false
      })
    : await supabase.from('nodos').insert(nodo)

  if (error) throw new Error(error.message)
  console.log(`✅ Indexado: ${rutaArchivo} → ${tipo}`)
}

function detectarTipo(ruta) {
  if (ruta.includes('comprension'))  return 'hu_comprension'
  if (ruta.includes('spec'))         return 'hu_spec'
  if (ruta.includes('closure'))      return 'hu_cierre'
  if (ruta.includes('exposition'))   return 'hu_exposition'
  if (ruta.includes('analysis'))     return 'analisis_repo'
  if (ruta.includes('glossary'))     return 'convencion'
  if (ruta.includes('conventions'))  return 'convencion'
  return null
}

async function obtenerContenido(repoId, path) {
  try {
    const org = process.env.AZURE_DEVOPS_ORG
    const project = process.env.AZURE_DEVOPS_PROJECT
    const pat = Buffer.from(`:${process.env.AZURE_DEVOPS_PAT}`).toString('base64')

    const url = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoId}/items?path=/${path}&api-version=7.0`

    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Basic ${pat}`,
        Accept: 'text/plain'  // ← forzar texto plano
      },
      responseType: 'text'   // ← forzar respuesta como texto
    })

    console.log('Contenido obtenido tipo:', typeof data)
    return typeof data === 'string' ? data : JSON.stringify(data)
  } catch (error) {
    console.error('Error obteniendo contenido:', error.message)
    return null
  }
}

module.exports = router
