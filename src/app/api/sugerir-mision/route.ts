import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const { permitido } = checkRateLimit(req, 'sugerir-mision')
  if (!permitido) return rateLimitResponse()

  const { nombre_puesto, area, actividades, empresa_id } = await req.json()
  const client = new Anthropic()

  let contextoEmpresa = ''
  if (empresa_id) {
    const { data: emp } = await supabase
      .from('empresas_mdt')
      .select('nombre, giro_negocio, mision_empresa, objetivos, valores')
      .eq('id', empresa_id)
      .single()
    if (emp) {
      contextoEmpresa = `\nContexto organizacional:
Empresa: ${emp.nombre}${emp.giro_negocio ? `\nGiro / sector: ${emp.giro_negocio}` : ''}${emp.mision_empresa ? `\nMisión de la empresa: ${emp.mision_empresa}` : ''}${emp.objetivos ? `\nObjetivos estratégicos: ${emp.objetivos}` : ''}${emp.valores ? `\nValores organizacionales: ${emp.valores}` : ''}`
    }
  }

  const prompt = `Eres un experto en gestión del talento humano con metodología MDT del Ministerio de Trabajo de Ecuador.

Redacta la misión del siguiente puesto en 2-3 líneas. La misión debe responder: ¿Para qué existe este puesto? ¿Qué resultado final produce? Alinea la misión con el contexto organizacional si se proporciona.
${contextoEmpresa}
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
