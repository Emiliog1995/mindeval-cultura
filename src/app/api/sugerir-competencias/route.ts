import Anthropic from '@anthropic-ai/sdk'
import { DESTREZAS } from '@/lib/diccionario-destrezas'

export async function POST(req: Request) {
  const { actividades_esenciales, nombre_puesto, area } = await req.json()
  const client = new Anthropic()

  const prompt = `Eres un experto en gestión de competencias con metodología MDT del Ministerio de Trabajo de Ecuador.

Puesto: ${nombre_puesto} / Área: ${area}

Actividades esenciales:
${actividades_esenciales.map((a: { descripcion: string; total?: number }, i: number) => `${i + 1}. ${a.descripcion} (Total MDT: ${a.total ?? '?'})`).join('\n')}

Diccionario de destrezas disponibles (MDT):
${DESTREZAS.map(d => `${d.codigo} (${d.tipo}): ${d.nombre} — ${d.descripcion}`).join('\n')}

Basándote exclusivamente en las actividades esenciales y el diccionario MDT, sugiere:
1. Conocimientos académicos requeridos (3-5, disciplinas/materias específicas)
2. Destrezas generales del diccionario MDT (3-5, usa exactamente los códigos y nombres del diccionario)
3. Destrezas específicas: informáticos (software específico), idiomas (nivel requerido), equipos
4. Otras competencias conductuales (3-4, del diccionario MDT)

Responde ÚNICAMENTE en JSON con esta estructura exacta:
{
  "conocimientos": [{"descripcion": "..."}],
  "destrezas_generales": [{"codigo": "D1", "nombre": "...", "descripcion": "..."}],
  "destrezas_especificas": {"informaticos": ["..."], "idiomas": ["..."], "equipos": ["..."]},
  "capacidades": [{"descripcion": "..."}]
}`

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = texto.match(/\{[\s\S]*\}/)
  const resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

  return Response.json(resultado)
}
