-- Panel interno de clientes — PASO 1: tablas nuevas + columna persona_id
-- Ejecutar en Supabase → SQL Editor (proyecto mindeval-cultura)
-- Todo aditivo: no toca tablas ni datos existentes salvo agregar 2 columnas nullable.

-- modulos_activos ------------------------------------------------------------
-- Controla qué módulos del ecosistema tiene activados cada empresa cliente.
CREATE TABLE modulos_activos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas_mdt(id),
  modulo              TEXT NOT NULL CHECK (modulo IN (
                         'cultura', 'clima', 'salud_organizacional',
                         'evaluacion_360', 'manual_puestos', 'nomina', 'seleccion'
                       )),
  estado              TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'pausado')),
  fecha_activacion    DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_desactivacion DATE,
  notas               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, modulo)
);

ALTER TABLE modulos_activos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modulos_activos_select_auth" ON modulos_activos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "modulos_activos_insert_auth" ON modulos_activos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "modulos_activos_update_auth" ON modulos_activos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "modulos_activos_delete_auth" ON modulos_activos
  FOR DELETE TO authenticated USING (true);

-- personas ---------------------------------------------------------------------
-- Registro liviano de identidad por empresa, para no recapturar gente entre
-- módulos. NO reemplaza empleados_nomina (datos sensibles de nómina siguen ahí).
CREATE TABLE personas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas_mdt(id),
  nombre     TEXT NOT NULL,
  cedula     TEXT,
  email      TEXT,
  puesto_id  UUID REFERENCES puestos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personas_select_auth" ON personas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "personas_insert_auth" ON personas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "personas_update_auth" ON personas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "personas_delete_auth" ON personas
  FOR DELETE TO authenticated USING (true);

-- Vínculo opcional persona <-> registros existentes de nómina y 360° -----------
ALTER TABLE empleados_nomina ADD COLUMN persona_id UUID REFERENCES personas(id);
ALTER TABLE evaluados_360    ADD COLUMN persona_id UUID REFERENCES personas(id);
