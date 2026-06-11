import Anthropic from '@anthropic-ai/sdk'
import { INDICADORES } from '@/lib/diccionario-indicadores'

export async function POST(req: Request) {
  const { actividades_esenciales, nombre_puesto, area } = await req.json()
  const client = new Anthropic()

  const prompt = `Eres un experto en gestión por resultados e indicadores de desempeño (MDT Ecuador).

Puesto: ${nombre_puesto} / Área: ${area}

Actividades esenciales del puesto:
${actividades_esenciales.map((a: { descripcion: string }, i: number) => `${i + 1}. ${a.descripcion}`).join('\n')}

Catálogo de indicadores disponibles:
${INDICADORES.map(ind => `[${ind.id}] ${ind.nombre} (${ind.categoria}) | Fórmula: ${ind.formula} | Meta: ${ind.meta_referencia}`).join('\n')}

Para cada actividad esencial sugiere 1-2 indicadores del catálogo. Adapta la meta a la actividad específica.

Responde ÚNICAMENTE en JSON:
[
  {
    "actividad_index": 0,
    "indicador_id": "P1",
    "indicador": "Nombre del indicador",
    "formula": "Fórmula adaptada",
    "meta": "Meta sugerida",
    "cliente": "Quién recibe o mide este resultado"
  }
]`

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = texto.match(/\[[\s\S]*\]/)
  const resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : []

  return Response.json(resultado)
}
