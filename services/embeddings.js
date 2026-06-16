const axios = require('axios')
require('dotenv').config()

// Voyage AI no tiene SDK oficial de Node, así que llamamos su API REST.
// La key va en VOYAGE_API_KEY (NO es la de Anthropic).
const voyage = axios.create({
  baseURL: 'https://api.voyageai.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    'Content-Type': 'application/json'
  }
})

const MODELO = 'voyage-code-3'

// Embedding de un documento (para indexar en la base de conocimiento)
async function generarEmbedding(texto) {
  // Asegurar que sea string (obtenerContenido puede devolver un objeto)
  const textoString = typeof texto === 'string'
    ? texto
    : JSON.stringify(texto)

  const textoLimpio = textoString
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)

  try {
    const { data } = await voyage.post('/embeddings', {
      input: textoLimpio,
      model: MODELO,
      input_type: 'document'
    })
    return data.data[0].embedding
  } catch (error) {
    // Surface el detalle real de la API de Voyage si lo hay
    throw new Error(
      `Error generando embedding: ${error.response?.data?.detail || error.message}`
    )
  }
}

// Embedding de una consulta (para buscar contra los documentos indexados)
async function generarEmbeddingConsulta(consulta) {
  try {
    const { data } = await voyage.post('/embeddings', {
      input: consulta,
      model: MODELO,
      input_type: 'query'
    })
    return data.data[0].embedding
  } catch (error) {
    throw new Error(
      `Error generando embedding de consulta: ${error.response?.data?.detail || error.message}`
    )
  }
}

// Embedding de varios documentos en un solo request (más eficiente)
async function generarEmbeddingLote(textos) {
  try {
    const { data } = await voyage.post('/embeddings', {
      input: textos.map(t => t.slice(0, 8000)),
      model: MODELO,
      input_type: 'document'
    })
    return data.data.map(d => d.embedding)
  } catch (error) {
    throw new Error(
      `Error generando embeddings en lote: ${error.response?.data?.detail || error.message}`
    )
  }
}

module.exports = {
  generarEmbedding,
  generarEmbeddingConsulta,
  generarEmbeddingLote
}
