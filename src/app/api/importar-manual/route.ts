import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) return Response.json({ error: 'No se recibió archivo' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  let textoExtraido = ''

  if (file.name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer })
    textoExtraido = result.value
  } else if (file.name.endsWith('.pdf')) {
    return Response.json({ error: 'PDF no soportado directamente. Pega el texto del documento en el campo de texto.' }, { status: 400 })
  } else {
    textoExtraido = buffer.toString('utf-8')
  }

  if (!textoExtraido.trim()) {
    return Response.json({ error: 'No se pudo extraer texto del documento.' }, { status: 400 })
  }

  const client = new Anthropic()

  const prompt = `Tienes un manual de puestos en texto extraído de un documento.
Puede estar desordenado, mezclar procesos con funciones, o no seguir ningún formato estándar.

Tu tarea:
1. Identificar cada puesto que aparece en el documento
2. Para cada puesto, extraer o inferir:
   - nombre_puesto, area, supervisado_por, supervisa_a
   - mision (si existe o inferirla de las funciones)
   - actividades: lista de strings con las actividades/funciones (NO pongas valores F/CE/CM)
   - conocimientos: lista de strings — conocimientos técnicos, herramientas, software, normativas
   - destrezas: lista de strings — habilidades cognitivas y técnicas (pensamiento crítico, redacción, análisis...)
   - competencias_conductuales: lista de strings — actitudes y comportamientos (trabajo en equipo, liderazgo, orientación a resultados...)
   - instruccion: string con nivel educativo, título y experiencia mencionados
   - indicadores_mencionados: lista de strings con indicadores, métricas o KPIs mencionados
3. Si no puedes distinguir entre destrezas y conductuales, pon los de habilidades blandas en conductuales y los técnicos en destrezas
4. Si hay información mezclada, reorganizarla por puesto

Responde ÚNICAMENTE en JSON array:
[
  {
    "nombre_puesto": "...",
    "area": "...",
    "supervisado_por": "...",
    "supervisa_a": "...",
    "mision": "...",
    "actividades": ["...", "..."],
    "conocimientos": ["..."],
    "destrezas": ["..."],
    "competencias_conductuales": ["..."],
    "instruccion": "...",
    "indicadores_mencionados": ["..."]
  }
]

TEXTO DEL DOCUMENTO:
${textoExtraido.slice(0, 12000)}`

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = texto.match(/\[[\s\S]*\]/)
  const puestos = jsonMatch ? JSON.parse(jsonMatch[0]) : []

  return Response.json({ puestos, caracteres_procesados: textoExtraido.length })
}
