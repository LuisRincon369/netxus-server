const router = require('express').Router()
const supabase = require('../config/supabase')
const { generarEmbedding } = require('../services/embeddings')
const axios = require('axios')
require('dotenv').config()

// Validar secret
function validarSecret(req, res, next) {
  const secret = req.headers['x-netxus-secret']
  if (secret !== process.env.AZURE_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Webhook no autorizado' })
  }
  next()
}

router.post('/azure', validarSecret, async (req, res) => {
  const { eventType, resource } = req.body

  try {
    if (eventType === 'git.push') {
      const repoNombre = resource.repository?.name
      if (repoNombre === 'sdd-agentes') {
        await manejarPushSDD(resource)
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

  for (const commit of commits) {
    const archivos = [
      ...(commit.added || []),
      ...(commit.modified || [])
    ]

    for (const archivo of archivos) {
      await indexarArchivo(archivo, resource.repository.id)
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

  const { error } = await supabase.from('nodos').upsert({
    tipo,
    titulo: rutaArchivo.split('/').pop().replace('.md', ''),
    contenido,
    hu_id,
    embedding
  }, {
    onConflict: 'hu_id,tipo',
    ignoreDuplicates: false
  })

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

    const url = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoId}/items?path=${path}&api-version=7.0`

    const { data } = await axios.get(url, {
      headers: { Authorization: `Basic ${pat}` }
    })
    return data
  } catch {
    return null
  }
}

module.exports = router
