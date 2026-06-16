import Anthropic from '@anthropic-ai/sdk'
import { INDICADORES } from '@/lib/diccionario-indicadores'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const { permitido } = checkRateLimit(req, 'sugerir-indicadores')
  if (!permitido) return rateLimitResponse()

  const { actividades_esenciales, nombre_puesto, area, empresa_id } = await req.json()
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
Empresa: ${emp.nombre}${emp.giro_negocio ? `\nGiro / sector: ${emp.giro_negocio}` : ''}${emp.mision_empresa ? `\nMisión de la empresa: ${emp.mision_empresa}` : ''}${emp.objetivos ? `\nObjetivos estratégicos: ${emp.objetivos}` : ''}${emp.valores ? `\nValores organizacionales: ${emp.valores}` : ''}\n`
    }
  }

  const prompt = `Eres un experto en gestión por resultados e indicadores de desempeño (MDT Ecuador).
${contextoEmpresa}
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
