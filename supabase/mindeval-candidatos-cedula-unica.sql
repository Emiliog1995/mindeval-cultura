-- ============================================================================
-- DUPLICADOS POR CÉDULA (Selección) — auditoría 2026-09, F2-4
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura). Idempotente.
--
-- Por qué: una misma persona que reenviaba el formulario público de
-- postulación (subió el CV equivocado, no vio la confirmación, o volvió a
-- llenarlo) creaba una fila nueva cada vez. El mismo candidato aparecía dos o
-- tres veces en el ranking, podía recibir dos invitaciones a la misma prueba,
-- y el reclutador no tenía forma de saber cuál de las filas era la buena.
--
-- La defensa principal ya vive en la aplicación (/api/mindeval-postular
-- actualiza al candidato existente en vez de insertar; /api/mindeval-alta-
-- candidato bloquea con un 409 que nombra al candidato que ya está). Este
-- índice es la red de seguridad de la base para cualquier camino futuro que
-- se olvide de esa regla.
--
-- Alcance deliberado: la unicidad es (vacante_id, cedula), NO cedula sola.
-- La misma persona SÍ puede postularse a varias vacantes distintas — es un
-- caso normal y legítimo. El índice es parcial (where cedula is not null)
-- porque el alta manual permite registrar a alguien de un referido antes de
-- tener su cédula, y varios NULL no deben chocar entre sí.
-- ============================================================================

-- PASO 1 — Revisa ANTES si la vacante en curso ya arrastra duplicados.
-- Si esto devuelve filas, el PASO 2 no podrá crear el índice hasta que las
-- resuelvas a mano (quedarte con la fila que tiene el historial del proceso
-- y borrar la otra). Corre solo este SELECT primero:
--
--   select vacante_id, cedula, count(*) as veces,
--          array_agg(id order by created_at) as candidato_ids,
--          array_agg(nombre_completo order by created_at) as nombres,
--          array_agg(etapa_actual order by created_at) as etapas
--   from mindeval_candidatos
--   where cedula is not null
--   group by vacante_id, cedula
--   having count(*) > 1;

-- PASO 2 — Crea el índice. Si todavía hay duplicados, NO rompe el script:
-- avisa por NOTICE y deja la base como estaba, para que puedas limpiarlos y
-- volver a ejecutar esto sin haber roto nada en medio de un proceso en curso.
do $$
begin
  create unique index if not exists mindeval_candidatos_vacante_cedula_uniq
    on mindeval_candidatos (vacante_id, cedula)
    where cedula is not null;
  raise notice 'OK: índice único (vacante_id, cedula) activo.';
exception
  when unique_violation then
    raise notice 'PENDIENTE: ya existen candidatos duplicados por cédula. Corre el SELECT del PASO 1, resuélvelos y vuelve a ejecutar este script. La aplicación ya evita crear duplicados nuevos.';
end $$;
