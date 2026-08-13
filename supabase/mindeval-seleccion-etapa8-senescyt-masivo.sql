-- ============================================================================
-- MINDEVAL SELECCIÓN — Etapa 8: verificación SENESCYT masiva desde el ranking
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Idempotente: se puede correr más de una vez sin problema.
--
-- Qué agrega:
-- 1) created_at: mindeval_verificaciones_titulo no tenía columna de fecha —
--    el código existente ordenaba por "id" (uuid aleatorio) para encontrar la
--    verificación "más reciente", lo cual no es confiable. Se agrega la
--    columna real y se rellenan las filas existentes con now() como mejor
--    aproximación disponible (no hay forma de reconstruir la fecha real de
--    filas ya insertadas sin esta columna).
-- 2) resultado_automatico / consultado_automaticamente_en: guardan lo que
--    encontró el proveedor externo (webservices.ec) en una consulta masiva,
--    SIN tocar "estado" (que sigue en 'pendiente' hasta que el reclutador
--    confirma) — es la cola de "pendientes de revisar" del ranking.
-- ============================================================================

alter table mindeval_verificaciones_titulo
  add column if not exists created_at timestamptz not null default now();

alter table mindeval_verificaciones_titulo
  add column if not exists resultado_automatico text
    check (resultado_automatico in ('registrado', 'sin_registro'));

alter table mindeval_verificaciones_titulo
  add column if not exists consultado_automaticamente_en timestamptz;
