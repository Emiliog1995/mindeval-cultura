import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Normaliza texto para comparar (minúsculas, sin tildes, sin espacios extra)
function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SEED_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 1. Obtener empresa UNBOUND
  const { data: empresa, error: empError } = await supabaseAdmin
    .from("empresas_mdt")
    .select("id")
    .ilike("nombre", "%UNBOUND%")
    .maybeSingle();

  if (empError || !empresa) {
    return NextResponse.json({ error: "Empresa UNBOUND no encontrada" }, { status: 404 });
  }

  // 2. Obtener catálogo de puestos
  const { data: catalogo } = await supabaseAdmin
    .from("catalogo_puestos")
    .select("nombre_puesto, actividades")
    .eq("empresa_id", empresa.id);

  if (!catalogo || catalogo.length === 0) {
    return NextResponse.json({ error: "Catálogo vacío. Ejecuta primero seed-catalogo-unbound." }, { status: 400 });
  }

  // Mapa: nombre_puesto normalizado → actividades[]
  const catalogoMap = new Map<string, string[]>();
  for (const p of catalogo) {
    catalogoMap.set(normalizar(p.nombre_puesto), p.actividades ?? []);
  }

  // 3. Obtener todas las respuestas de UNBOUND
  const { data: respuestas, error: respError } = await supabaseAdmin
    .from("respuestas_ocupante")
    .select("id, cargo_actual, actividades")
    .eq("empresa_id", empresa.id);

  if (respError || !respuestas) {
    return NextResponse.json({ error: "Error al obtener respuestas" }, { status: 500 });
  }

  let actualizadas = 0;
  let sinCatalogo = 0;
  const detalle: { id: string; cargo: string; agregadas: number }[] = [];

  for (const resp of respuestas) {
    const cargoNorm = normalizar(String(resp.cargo_actual ?? ""));

    // Buscar puesto en catálogo (exacto primero, luego parcial)
    let subActividades: string[] = [];
    if (catalogoMap.has(cargoNorm)) {
      subActividades = catalogoMap.get(cargoNorm)!;
    } else {
      // Búsqueda parcial
      for (const [key, acts] of catalogoMap.entries()) {
        if (key.includes(cargoNorm) || cargoNorm.includes(key)) {
          subActividades = acts;
          break;
        }
      }
    }

    if (subActividades.length === 0) {
      sinCatalogo++;
      continue;
    }

    // Actividades existentes (con sus calificaciones)
    const existentes: { descripcion: string; frecuencia: string; dificultad: string; consecuencia: string }[] =
      Array.isArray(resp.actividades) ? resp.actividades : [];

    // Descripciones ya existentes (normalizadas para comparar)
    const existentesNorm = new Set(existentes.map((a) => normalizar(a.descripcion ?? "")));

    // Sub-actividades del catálogo que NO están ya en la respuesta
    const nuevas = subActividades
      .filter((desc) => !existentesNorm.has(normalizar(desc)))
      .map((desc) => ({ descripcion: desc, frecuencia: "", dificultad: "", consecuencia: "" }));

    if (nuevas.length === 0) {
      // Ya tiene todas las actividades del catálogo
      detalle.push({ id: resp.id, cargo: resp.cargo_actual, agregadas: 0 });
      continue;
    }

    // Fusionar: existentes primero, luego las nuevas al final
    const fusionadas = [...existentes, ...nuevas];

    const { error: updError } = await supabaseAdmin
      .from("respuestas_ocupante")
      .update({ actividades: fusionadas })
      .eq("id", resp.id);

    if (!updError) {
      actualizadas++;
      detalle.push({ id: resp.id, cargo: resp.cargo_actual, agregadas: nuevas.length });
    }
  }

  return NextResponse.json({
    ok: true,
    total_respuestas: respuestas.length,
    actualizadas,
    sin_catalogo: sinCatalogo,
    detalle,
  });
}
