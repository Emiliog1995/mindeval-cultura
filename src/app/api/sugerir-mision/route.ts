import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  const { nombre_puesto, area, actividades } = await req.json()
  const client = new Anthropic()

  const prompt = `Eres un experto en gestión del talento humano con metodología MDT del Ministerio de Trabajo de Ecuador.

Redacta la misión del siguiente puesto en 2-3 líneas. La misión debe responder: ¿Para qué existe este puesto? ¿Qué resultado final produce?

Puesto: ${nombre_puesto}
Área: ${area || 'No especificada'}
${actividades?.length > 0 ? `\nActividades principales:\n${actividades.slice(0, 8).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}` : ''}

Responde ÚNICAMENTE en JSON:
{"mision": "..."}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = texto.match(/\{[\s\S]*\}/)
  const resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

  return Response.json(resultado)
}
