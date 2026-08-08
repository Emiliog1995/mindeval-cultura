-- ============================================================================
-- PASO 7 -- Hardening de seguridad (auditoria 2026-08-08)
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Idempotente: se puede correr mas de una vez sin problema.
--
-- Que hace:
--  1) Crea una allowlist de usuarios autorizados (usuarios_autorizados) y una
--     funcion is_usuario_autorizado() que la consulta sin exponerla via RLS.
--     Aunque el registro publico de Supabase Auth quede abierto, una cuenta
--     nueva NO autorizada no podra leer/escribir nada sensible.
--  2) Vuelve a aplicar (estaban documentadas pero no vigentes) las politicas
--     de rls_setup.sql / nomina.sql: bloqueo total de anon en tablas
--     sensibles, salvo las excepciones publicas ya disenadas a proposito
--     (insertar evaluaciones/clima, leer/completar una sesion por id).
--  3) Cambia esas politicas de "to authenticated using (true)" a
--     "to authenticated using (is_usuario_autorizado())".
-- ============================================================================

-- 1) Allowlist de usuarios autorizados ---------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_autorizados (
  email      TEXT PRIMARY KEY,
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE usuarios_autorizados ENABLE ROW LEVEL SECURITY;
-- Sin policies: nadie la lee directo (ni authenticated). Solo la usa la
-- funcion SECURITY DEFINER de abajo, que corre con permisos propios.

INSERT INTO usuarios_autorizados (email)
VALUES ('gerencia@mindtalentrh.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION is_usuario_autorizado()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_autorizados
    WHERE email = auth.email() AND activo = true
  );
$$;

-- 2) Helper temporal: borra todas las policies existentes de una tabla ------
CREATE OR REPLACE FUNCTION _drop_all_policies(tbl text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
  END LOOP;
END $$;

-- 3) Tablas de uso exclusivo del consultor: anon bloqueado por completo -----
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'empresas_mdt', 'puestos', 'catalogo_puestos',
    'actividades_puesto', 'competencias_puesto', 'instruccion_puesto', 'indicadores_puesto',
    'evaluados_360', 'evaluaciones_360', 'tokens_360', 'pdi_360',
    'respuestas_ocupante', 'modulos_activos', 'personas',
    'empleados_nomina', 'nomina_mensual', 'vacaciones_empleado',
    'novedades_nomina', 'parametros_legales', 'liquidaciones_procesadas',
    'utilidades_procesadas'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    PERFORM _drop_all_policies(t);
    EXECUTE format(
      'CREATE POLICY "autorizado_all" ON public.%I FOR ALL TO authenticated USING (is_usuario_autorizado()) WITH CHECK (is_usuario_autorizado())',
      t
    );
  END LOOP;
END $$;

-- 4) evaluaciones (Cultura) -- insert publico se mantiene, resto se cierra --
SELECT _drop_all_policies('evaluaciones');
ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evaluaciones_insert_publico" ON evaluaciones
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "evaluaciones_select_auth" ON evaluaciones
  FOR SELECT TO authenticated USING (is_usuario_autorizado());
CREATE POLICY "evaluaciones_update_auth" ON evaluaciones
  FOR UPDATE TO authenticated USING (is_usuario_autorizado()) WITH CHECK (is_usuario_autorizado());
CREATE POLICY "evaluaciones_delete_auth" ON evaluaciones
  FOR DELETE TO authenticated USING (is_usuario_autorizado());

-- 5) clima_respuestas -- mismo patron ----------------------------------------
SELECT _drop_all_policies('clima_respuestas');
ALTER TABLE clima_respuestas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clima_insert_publico" ON clima_respuestas
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "clima_select_auth" ON clima_respuestas
  FOR SELECT TO authenticated USING (is_usuario_autorizado());
CREATE POLICY "clima_update_auth" ON clima_respuestas
  FOR UPDATE TO authenticated USING (is_usuario_autorizado()) WITH CHECK (is_usuario_autorizado());
CREATE POLICY "clima_delete_auth" ON clima_respuestas
  FOR DELETE TO authenticated USING (is_usuario_autorizado());

-- 6) sesiones -- link publico /eval?id=, baja sensibilidad por diseno -------
SELECT _drop_all_policies('sesiones');
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sesiones_select_publico" ON sesiones
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sesiones_insert_auth" ON sesiones
  FOR INSERT TO authenticated WITH CHECK (is_usuario_autorizado());
-- anon solo puede marcar una sesion pendiente como completada, nada mas
CREATE POLICY "sesiones_update_completar_publico" ON sesiones
  FOR UPDATE TO anon
  USING (estado = 'pendiente')
  WITH CHECK (estado = 'completada');
CREATE POLICY "sesiones_update_auth" ON sesiones
  FOR UPDATE TO authenticated USING (is_usuario_autorizado()) WITH CHECK (is_usuario_autorizado());
CREATE POLICY "sesiones_delete_auth" ON sesiones
  FOR DELETE TO authenticated USING (is_usuario_autorizado());

-- 7) limpieza del helper temporal ---------------------------------------------
DROP FUNCTION IF EXISTS _drop_all_policies(text);
