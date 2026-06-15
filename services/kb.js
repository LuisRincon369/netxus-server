const supabase = require('../config/supabase')
const { generarEmbedding, generarEmbeddingConsulta } = require('./embeddings')

async function guardarNodo({
  proyecto_id = null,
  usuario_id,
  tipo,
  titulo,
  contenido,
  hu_id = null
}) {
  const embedding = await generarEmbedding(`${titulo}\n\n${contenido}`)

  // Si tiene hu_id → upsert, si no → insert normal
  if (hu_id) {
    const { data, error } = await supabase
      .from('nodos')
      .upsert({
        proyecto_id,
        usuario_id,
        tipo,
        titulo,
        contenido,
        hu_id,
        embedding
      }, {
        onConflict: 'hu_id,tipo',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (error) throw new Error(`Error guardando nodo: ${error.message}`)
    return data
  } else {
    const { data, error } = await supabase
      .from('nodos')
      .insert({
        proyecto_id,
        usuario_id,
        tipo,
        titulo,
        contenido,
        hu_id,
        embedding
      })
      .select()
      .single()

    if (error) throw new Error(`Error guardando nodo: ${error.message}`)
    return data
  }
}

async function buscarNodos({
  consulta,
  proyecto_id = null,
  tipo = null,
  limite = 5
}) {
  const embedding = await generarEmbeddingConsulta(consulta)

  const { data, error } = await supabase.rpc('buscar_nodos', {
    query_embedding: embedding,
    proyecto_filtro: proyecto_id,
    tipo_filtro: tipo,
    limite
  })

  if (error) throw new Error(`Error buscando nodos: ${error.message}`)
  return data
}

async function buscarNodosSnippet({
  consulta,
  proyecto_id = null,
  tipo = null,
  limite = 5,
  snippet_length = 150
}) {
  const nodos = await buscarNodos({ consulta, proyecto_id, tipo, limite })

  return nodos.map(n => ({
    ...n,
    contenido_snippet: n.contenido.slice(0, snippet_length) + '...',
    contenido: undefined
  }))
}

module.exports = { guardarNodo, buscarNodos, buscarNodosSnippet }
