-- ============================================================================
-- PERMISOS POR MÓDULO -- restringir cuentas a un subconjunto de módulos
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Idempotente: se puede correr más de una vez sin problema.
--
-- Por qué: is_usuario_autorizado() (panel_clientes_paso7_seguridad.sql) es
-- todo-o-nada -- cualquier email activo en usuarios_autorizados ve TODOS los
-- módulos del ecosistema (Selección, Clima, 360, Nómina, Manual de Puestos,
-- DOCS, panel de clientes/admin), sin distinción. Hacía falta poder dar de
-- alta una cuenta que solo vea un módulo (ej. un reclutador externo que solo
-- debe entrar a Selección) sin exponerle el resto.
--
-- Qué hace:
--  1) Agrega usuarios_autorizados.modulos_permitidos (TEXT[], nullable).
--     NULL = acceso a TODOS los módulos -- ninguna cuenta existente pierde
--     acceso a nada al correr este script, es puramente aditivo.
--  2) Crea usuario_tiene_modulo(modulo text), equivalente a
--     is_usuario_autorizado() pero además exige el módulo si la cuenta está
--     restringida.
--  3) Reescribe las policies "autorizado_all" de cada tabla para usar
--     usuario_tiene_modulo('<modulo>') en vez de is_usuario_autorizado().
--     is_usuario_autorizado() se deja intacta (no se borra) por si algo más
--     la referencia, pero deja de ser el gate real de estas tablas.
--
-- Módulos válidos (deben coincidir con Modulo en src/lib/require-auth.ts):
--   'seleccion', 'clima', 'evaluacion_360', 'nomina', 'manual_puestos',
--   'cultura_docs', 'admin'.
--
-- empresas_mdt es la única tabla compartida entre tres módulos (Manual de
-- Puestos, Nómina y Selección la usan como catálogo de empresas cliente) --
-- su policy exige CUALQUIERA de los tres, no todos. Selección la necesita
-- para el selector de empresa al crear una vacante (mindeval_vacantes.
-- empresa_id) y su "+ Nueva empresa" inline.
--
-- Selección NO tiene acceso de lectura a puestos/competencias_puesto
-- aunque su flujo de "elegir puesto existente" al crear una vacante los
-- consulte -- es deliberado (aislamiento real, no "casi total"): una cuenta
-- solo-Selección ve ese selector vacío y usa el perfil ligero manual en su
-- lugar (Paso 11 de la skill). Si se prefiere que sí puedan elegir puestos
-- existentes, hay que decidirlo explícitamente y añadir esa excepción a
-- mano.
-- ============================================================================

ALTER TABLE usuarios_autorizados ADD COLUMN IF NOT EXISTS modulos_permitidos TEXT[];

CREATE OR REPLACE FUNCTION usuario_tiene_modulo(modulo text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_autorizados
    WHERE email = auth.email()
      AND activo = true
      AND (modulos_permitidos IS NULL OR modulo = ANY(modulos_permitidos))
  );
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    PERFORM _drop_all_policies(t);
    EXECUTE format(
      'CREATE POLICY "modulo_autorizado" ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      t, expresion, expresion
    );
  END LOOP;
END $$;

-- Manual de Puestos -----------------------------------------------------------
SELECT _aplicar_modulo(
  ARRAY['puestos', 'catalogo_puestos', 'actividades_puesto', 'competencias_puesto', 'instruccion_puesto', 'indicadores_puesto', 'respuestas_ocupante'],
  $$usuario_tiene_modulo('manual_puestos')$$
);

-- Evaluación 360 ---------------------------------------------------------------
SELECT _aplicar_modulo(
  ARRAY['evaluados_360', 'evaluaciones_360', 'tokens_360', 'pdi_360'],
  $$usuario_tiene_modulo('evaluacion_360')$$
);

-- Nómina -------------------------------------------------------------------
SELECT _aplicar_modulo(
  ARRAY['empleados_nomina', 'nomina_mensual', 'vacaciones_empleado', 'novedades_nomina', 'parametros_legales', 'liquidaciones_procesadas', 'utilidades_procesadas'],
  $$usuario_tiene_modulo('nomina')$$
);

-- empresas_mdt: compartida entre Manual de Puestos, Nómina y Selección
-- (el selector de empresa al crear una vacante y su "+ Nueva empresa" leen
-- y escriben esta tabla igual que los otros dos módulos) ---------------------
SELECT _aplicar_modulo(
  ARRAY['empresas_mdt'],
  $$(usuario_tiene_modulo('manual_puestos') OR usuario_tiene_modulo('nomina') OR usuario_tiene_modulo('seleccion'))$$
);

-- Panel interno MINDTALENT (gestión de clientes/módulos activos) -------------
SELECT _aplicar_modulo(
  ARRAY['modulos_activos', 'personas'],
  $$usuario_tiene_modulo('admin')$$
);

-- Selección de Talento ---------------------------------------------------------
SELECT _aplicar_modulo(
  ARRAY[
    'mindeval_vacantes', 'mindeval_candidatos', 'mindeval_cv_matches',
    'mindeval_verificaciones_titulo', 'mindeval_pruebas_psicometricas',
    'mindeval_pruebas_tecnicas', 'mindeval_assessment_evaluaciones',
    'mindeval_entrevistas', 'mindeval_informes_ia', 'mindeval_sesiones_prueba',
    'mindeval_banco_preguntas', 'mindeval_banco_ejercicios'
  ],
  $$usuario_tiene_modulo('seleccion')$$
);

-- mindeval_alertas_fraude: caso especial, el candidato sin login inserta sus
-- propias alertas durante el examen -- se mantiene ese insert público.
SELECT _drop_all_policies('mindeval_alertas_fraude');
CREATE POLICY "modulo_autorizado" ON mindeval_alertas_fraude
  FOR ALL TO authenticated USING (usuario_tiene_modulo('seleccion')) WITH CHECK (usuario_tiene_modulo('seleccion'));
CREATE POLICY "mindeval_alertas_insert_publico" ON mindeval_alertas_fraude
  FOR INSERT TO anon WITH CHECK (true);

-- evaluaciones (Cultura DOCS): insert público se mantiene ---------------------
SELECT _drop_all_policies('evaluaciones');
CREATE POLICY "evaluaciones_insert_publico" ON evaluaciones
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "evaluaciones_select_modulo" ON evaluaciones
  FOR SELECT TO authenticated USING (usuario_tiene_modulo('cultura_docs'));
CREATE POLICY "evaluaciones_update_modulo" ON evaluaciones
  FOR UPDATE TO authenticated USING (usuario_tiene_modulo('cultura_docs')) WITH CHECK (usuario_tiene_modulo('cultura_docs'));
CREATE POLICY "evaluaciones_delete_modulo" ON evaluaciones
  FOR DELETE TO authenticated USING (usuario_tiene_modulo('cultura_docs'));

-- clima_respuestas: mismo patrón ----------------------------------------------
SELECT _drop_all_policies('clima_respuestas');
CREATE POLICY "clima_insert_publico" ON clima_respuestas
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "clima_select_modulo" ON clima_respuestas
  FOR SELECT TO authenticated USING (usuario_tiene_modulo('clima'));
CREATE POLICY "clima_update_modulo" ON clima_respuestas
  FOR UPDATE TO authenticated USING (usuario_tiene_modulo('clima')) WITH CHECK (usuario_tiene_modulo('clima'));
CREATE POLICY "clima_delete_modulo" ON clima_respuestas
  FOR DELETE TO authenticated USING (usuario_tiene_modulo('clima'));

-- sesiones (Cultura DOCS): link público /eval?id=, baja sensibilidad por
-- diseño -- la lectura pública se deja igual que antes, solo se restringe
-- por módulo la escritura desde el panel de consultor.
SELECT _drop_all_policies('sesiones');
CREATE POLICY "sesiones_select_publico" ON sesiones
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sesiones_insert_modulo" ON sesiones
  FOR INSERT TO authenticated WITH CHECK (usuario_tiene_modulo('cultura_docs'));
CREATE POLICY "sesiones_update_completar_publico" ON sesiones
  FOR UPDATE TO anon
  USING (estado = 'pendiente')
  WITH CHECK (estado = 'completada');
CREATE POLICY "sesiones_update_modulo" ON sesiones
  FOR UPDATE TO authenticated USING (usuario_tiene_modulo('cultura_docs')) WITH CHECK (usuario_tiene_modulo('cultura_docs'));
CREATE POLICY "sesiones_delete_modulo" ON sesiones
  FOR DELETE TO authenticated USING (usuario_tiene_modulo('cultura_docs'));

-- limpieza de helpers temporales ----------------------------------------------
DROP FUNCTION IF EXISTS _aplicar_modulo(text[], text);
DROP FUNCTION IF EXISTS _drop_all_policies(text);

-- mis_modulos_permitidos(): permite que el propio front (cliente anon,
-- sesión ya autenticada) sepa a qué módulo mandar al usuario justo después
-- del login, sin poder leer la fila de nadie más -- usuarios_autorizados no
-- tiene policies propias (RLS deniega todo por defecto), así que el cliente
-- no puede hacer supabase.from('usuarios_autorizados').select(...) directo;
-- esta función SECURITY DEFINER es la única puerta, y solo devuelve la fila
-- de auth.email() (el usuario de la sesión actual).
CREATE OR REPLACE FUNCTION mis_modulos_permitidos()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT modulos_permitidos FROM usuarios_autorizados
  WHERE email = auth.email() AND activo = true;
$$;

-- ============================================================================
-- Para restringir una cuenta a un solo módulo (ej. Selección), después de
-- crearla en Supabase Auth (ver crear-usuario-consultor.mjs):
--
-- INSERT INTO usuarios_autorizados (email, modulos_permitidos)
-- VALUES ('nombre@dominio.com', ARRAY['seleccion'])
-- ON CONFLICT (email) DO UPDATE SET modulos_permitidos = EXCLUDED.modulos_permitidos;
--
-- Para devolverle acceso a todos los módulos:
-- UPDATE usuarios_autorizados SET modulos_permitidos = NULL WHERE email = 'nombre@dominio.com';
-- ============================================================================
