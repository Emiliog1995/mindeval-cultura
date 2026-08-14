-- ============================================================================
-- PERMISOS POR EMPRESA (Selección) -- una cuenta de cliente externo solo ve
-- lo suyo, en toda la cadena de tablas del módulo, más el Manual de Puestos
-- de su propia empresa.
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Ejecutar DESPUÉS de permisos-por-modulo-seguridad.sql (usa
-- usuario_tiene_modulo(), que ese script crea). Idempotente.
--
-- Por qué: permisos-por-modulo-seguridad.sql resuelve "qué módulos ve esta
-- cuenta" pero no "de qué empresa". Una cuenta con modulos_permitidos =
-- ['seleccion'] veía TODAS las vacantes/candidatos de TODOS los clientes de
-- MINDTALENT, no solo los suyos -- y no podía leer el Manual de Puestos en
-- absoluto (aislamiento total, sin excepción). Este script agrega una
-- segunda dimensión de permiso, ortogonal a la de módulo:
--
--   usuarios_autorizados.empresa_id  NULL      -> cuenta de staff MINDTALENT,
--                                                  ve todas las empresas
--                                                  (comportamiento actual,
--                                                  nada cambia para ti).
--   usuarios_autorizados.empresa_id  <uuid>    -> cuenta de un cliente
--                                                  externo, solo ve/edita
--                                                  filas de SU empresa.
--
-- Qué hace:
--  1) Agrega usuarios_autorizados.empresa_id (UUID, FK a empresas_mdt).
--  2) Crea usuario_empresa_id(), equivalente de lectura a modulos_permitidos.
--  3) Reescribe las policies de las 13 tablas de Selección para exigir,
--     además del módulo, que la vacante (directa o vía candidato_id) sea de
--     la empresa de la cuenta -- cuando la cuenta tiene empresa_id NULL, no
--     se filtra nada (mismo comportamiento de hoy).
--  4) Da acceso de SOLO LECTURA a `puestos` para cuentas de módulo
--     'seleccion' -- pero solo a los puestos de su propia empresa si la
--     cuenta tiene empresa_id asignado. No toca la policy existente de
--     manual_puestos (queda igual, full acceso).
--  5) Ajusta empresas_mdt: una cuenta de cliente (empresa_id asignado) solo
--     ve su propia fila, de solo lectura -- no puede ver ni editar otras
--     empresas ni crear una nueva. Staff (empresa_id NULL) con módulo
--     seleccion, manual_puestos o nomina sigue viendo/editando todas.
--
-- Gap conocido, deliberadamente fuera de este script: las rutas API que usan
-- requireAuth() + service_role (ej. /api/mindeval-alta-candidato, /api/
-- mindeval-cv-match, /api/mindeval-generar-caso...) no verifican todavía
-- que el candidato_id/vacante_id recibido pertenezca a la empresa de quien
-- llama -- solo revisan el módulo. Como esas rutas se llaman siempre desde
-- páginas que ya solo muestran al usuario sus propios candidatos (gracias a
-- este RLS), hoy no hay forma de descubrir el UUID de un candidato de otra
-- empresa desde la interfaz. Sigue siendo una capa de defensa que falta si
-- se quiere blindaje completo -- ciérrala antes de dar una cuenta de cliente
-- real si esto te preocupa.
-- ============================================================================

ALTER TABLE usuarios_autorizados ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas_mdt(id);

CREATE OR REPLACE FUNCTION usuario_empresa_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT empresa_id FROM usuarios_autorizados
  WHERE email = auth.email() AND activo = true;
$$;

CREATE OR REPLACE FUNCTION _drop_all_policies(tbl text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION _aplicar_modulo(tablas text[], expresion text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    PERFORM _drop_all_policies(t);
    EXECUTE format(
      'CREATE POLICY "modulo_autorizado" ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      t, expresion, expresion
    );
  END LOOP;
END $$;

-- mindeval_vacantes: la tabla raíz, tiene empresa_id directo ------------------
SELECT _aplicar_modulo(
  ARRAY['mindeval_vacantes'],
  $$usuario_tiene_modulo('seleccion') AND (usuario_empresa_id() IS NULL OR empresa_id = usuario_empresa_id())$$
);

-- Tablas con vacante_id directo ------------------------------------------------
SELECT _aplicar_modulo(
  ARRAY['mindeval_candidatos', 'mindeval_sesiones_prueba', 'mindeval_banco_preguntas', 'mindeval_banco_ejercicios'],
  $$usuario_tiene_modulo('seleccion') AND (
      usuario_empresa_id() IS NULL
      OR EXISTS (SELECT 1 FROM mindeval_vacantes v WHERE v.id = vacante_id AND v.empresa_id = usuario_empresa_id())
    )$$
);

-- Tablas que solo tienen candidato_id (un salto más hasta la vacante) --------
SELECT _aplicar_modulo(
  ARRAY[
    'mindeval_cv_matches', 'mindeval_verificaciones_titulo', 'mindeval_pruebas_psicometricas',
    'mindeval_pruebas_tecnicas', 'mindeval_assessment_evaluaciones', 'mindeval_entrevistas', 'mindeval_informes_ia'
  ],
  $$usuario_tiene_modulo('seleccion') AND (
      usuario_empresa_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM mindeval_candidatos c
        JOIN mindeval_vacantes v ON v.id = c.vacante_id
        WHERE c.id = candidato_id AND v.empresa_id = usuario_empresa_id()
      )
    )$$
);

-- mindeval_alertas_fraude: caso especial, mantiene el insert público del
-- candidato sin login durante el examen --------------------------------------
SELECT _drop_all_policies('mindeval_alertas_fraude');
CREATE POLICY "modulo_autorizado" ON mindeval_alertas_fraude
  FOR ALL TO authenticated USING (
    usuario_tiene_modulo('seleccion') AND (
      usuario_empresa_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM mindeval_candidatos c
        JOIN mindeval_vacantes v ON v.id = c.vacante_id
        WHERE c.id = candidato_id AND v.empresa_id = usuario_empresa_id()
      )
    )
  ) WITH CHECK (
    usuario_tiene_modulo('seleccion') AND (
      usuario_empresa_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM mindeval_candidatos c
        JOIN mindeval_vacantes v ON v.id = c.vacante_id
        WHERE c.id = candidato_id AND v.empresa_id = usuario_empresa_id()
      )
    )
  );
CREATE POLICY "mindeval_alertas_insert_publico" ON mindeval_alertas_fraude
  FOR INSERT TO anon WITH CHECK (true);

DROP FUNCTION IF EXISTS _aplicar_modulo(text[], text);
DROP FUNCTION IF EXISTS _drop_all_policies(text);

-- puestos: acceso adicional de SOLO LECTURA para módulo 'seleccion', filtrado
-- por empresa cuando la cuenta tiene empresa_id -- se suma a la policy
-- existente "modulo_autorizado" (manual_puestos, full acceso), no la
-- reemplaza. Varias policies permisivas para el mismo comando se combinan
-- con OR, así que esto nunca le quita acceso a nadie que ya lo tenía.
DROP POLICY IF EXISTS "seleccion_select_empresa" ON puestos;
CREATE POLICY "seleccion_select_empresa" ON puestos
  FOR SELECT TO authenticated
  USING (usuario_tiene_modulo('seleccion') AND (usuario_empresa_id() IS NULL OR empresa_id = usuario_empresa_id()));

-- empresas_mdt: staff (empresa_id NULL) con seleccion/manual_puestos/nomina
-- sigue viendo y editando todas las empresas -- una cuenta de cliente
-- (empresa_id asignado) solo ve su propia fila, de solo lectura.
DROP POLICY IF EXISTS "modulo_autorizado" ON empresas_mdt;
CREATE POLICY "modulo_autorizado" ON empresas_mdt
  FOR ALL TO authenticated USING (
    usuario_tiene_modulo('manual_puestos') OR usuario_tiene_modulo('nomina')
    OR (usuario_tiene_modulo('seleccion') AND usuario_empresa_id() IS NULL)
  ) WITH CHECK (
    usuario_tiene_modulo('manual_puestos') OR usuario_tiene_modulo('nomina')
    OR (usuario_tiene_modulo('seleccion') AND usuario_empresa_id() IS NULL)
  );
CREATE POLICY "seleccion_select_propia_empresa" ON empresas_mdt
  FOR SELECT TO authenticated
  USING (usuario_tiene_modulo('seleccion') AND usuario_empresa_id() IS NOT NULL AND id = usuario_empresa_id());

-- ============================================================================
-- Para dar de alta una cuenta de cliente externo (ej. Fundación Unbound),
-- restringida a Selección y a su propia empresa:
--
-- INSERT INTO usuarios_autorizados (email, modulos_permitidos, empresa_id)
-- VALUES ('contacto@fundacion.org', ARRAY['seleccion'], '66732802-652a-4bb8-bccb-29d9a951d106')
-- ON CONFLICT (email) DO UPDATE SET
--   modulos_permitidos = EXCLUDED.modulos_permitidos,
--   empresa_id = EXCLUDED.empresa_id;
--
-- (el id de Fundación Unbound Ecuador ya está confirmado como
-- 66732802-652a-4bb8-bccb-29d9a951d106 en empresas_mdt)
-- ============================================================================
