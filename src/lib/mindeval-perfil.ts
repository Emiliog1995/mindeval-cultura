import type { SupabaseClient } from "@supabase/supabase-js";
import type { PerfilCargoManual, Vacante } from "./mindeval-types";

/**
 * Resuelve el perfil de referencia de una vacante: si tiene perfil_cargo_manual
 * lo usa tal cual; si no, lo arma leyendo el puesto real del módulo Manual de
 * Puestos (mision, area, competencias_puesto). Nunca duplica esas tablas.
 *
 * Funciona tanto con el cliente anon (RLS "to authenticated") desde páginas
 * de consultor como con supabaseAdmin (service_role) desde rutas públicas —
 * ambos exponen la misma API de SupabaseClient.
 */
export async function resolverPerfilCargo(db: SupabaseClient, vacante: Vacante): Promise<PerfilCargoManual | null> {
  if (vacante.perfil_cargo_manual) return vacante.perfil_cargo_manual;
  if (!vacante.puesto_id) return null;

  const [{ data: puesto }, { data: competencias }] = await Promise.all([
    db.from("puestos").select("mision, area").eq("id", vacante.puesto_id).single(),
    db.from("competencias_puesto").select("tipo, descripcion").eq("puesto_id", vacante.puesto_id),
  ]);

  const lista = (competencias ?? []) as { tipo: string; descripcion: string }[];
  const duras = lista
    .filter((c) => c.tipo !== "capacidad")
    .map((c) => ({ nombre: c.descripcion, peso: 15, excluyente: false }));
  const blandas = lista
    .filter((c) => c.tipo === "capacidad")
    .map((c) => ({ nombre: c.descripcion, nivel_esperado: 7 }));

  const p = puesto as { mision?: string; area?: string } | null;
  return {
    mision: p?.mision ?? "",
    area: p?.area ?? "",
    competencias_duras: duras,
    competencias_blandas: blandas,
  };
}
