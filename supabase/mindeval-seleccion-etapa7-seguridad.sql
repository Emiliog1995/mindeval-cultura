-- ============================================================================
-- MINDEVAL SELECCIÓN — Etapa 7: cerrar el hueco de RLS (auditoría 2026-08-10)
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Idempotente: se puede correr más de una vez sin problema.
--
-- Por qué: el módulo de Selección quedó fuera de la auditoría de seguridad
-- del 2026-08-08 (ver panel_clientes_paso7_seguridad.sql) porque todavía no
-- estaba terminado. Sus 13 tablas quedaron con "to authenticated using (true)"
-- en vez de "to authenticated using (is_usuario_autorizado())" — cualquier
-- cuenta de Supabase Auth de este proyecto (no solo las de la allowlist)
-- tiene hoy lectura/escritura total sobre CVs, respuestas psicométricas
-- crudas, resultados técnicos, notas de entrevista y alertas de fraude de
-- todos los candidatos de todos los procesos. is_usuario_autorizado() ya
-- existe (se creó en panel_clientes_paso7_seguridad.sql) — este script solo
-- la aplica aquí también.
-- ============================================================================

CREATE OR REPLACE FUNCTION _drop_all_policies(tbl text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
  END LOOP;
END $$;

-- tablas de uso exclusivo del equipo de reclutamiento: mismo patrón que el
-- resto del ecosistema, anon bloqueado por completo, authenticated solo si
-- está en la allowlist.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mindeval_vacantes', 'mindeval_candidatos', 'mindeval_cv_matches',
    'mindeval_verificaciones_titulo', 'mindeval_pruebas_psicometricas',
    'mindeval_pruebas_tecnicas', 'mindeval_assessment_evaluaciones',
    'mindeval_entrevistas', 'mindeval_informes_ia', 'mindeval_sesiones_prueba',
    'mindeval_banco_preguntas', 'mindeval_banco_ejercicios'
  ] LOOP
    PERFORM _drop_all_policies(t);
    EXECUTE format(
      'CREATE POLICY "autorizado_all" ON public.%I FOR ALL TO authenticated USING (is_usuario_autorizado()) WITH CHECK (is_usuario_autorizado())',
      t
    );
  END LOOP;
END $$;

-- mindeval_alertas_fraude: caso especial, el navegador del candidato (sin
-- login, durante el examen) necesita poder insertar sus propias alertas —
-- se mantiene esa policy anon insert-only, solo se endurece la de lectura.
SELECT _drop_all_policies('mindeval_alertas_fraude');
CREATE POLICY "mindeval_alertas_all_auth" ON mindeval_alertas_fraude
  FOR ALL TO authenticated USING (is_usuario_autorizado()) WITH CHECK (is_usuario_autorizado());
CREATE POLICY "mindeval_alertas_insert_publico" ON mindeval_alertas_fraude
  FOR INSERT TO anon WITH CHECK (true);

DROP FUNCTION IF EXISTS _drop_all_policies(text);
