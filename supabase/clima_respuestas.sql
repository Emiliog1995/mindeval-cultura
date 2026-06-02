-- Tabla para encuesta de Clima Laboral (anónima)
-- Ejecutar en Supabase → SQL Editor

CREATE TABLE clima_respuestas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respuestas   JSONB NOT NULL,
  scores       JSONB NOT NULL,
  score_global NUMERIC(4,2),
  nivel        TEXT
);

-- Habilitar Row Level Security
ALTER TABLE clima_respuestas ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede insertar (encuesta anónima pública)
CREATE POLICY "anon_insert_clima" ON clima_respuestas
  FOR INSERT TO anon WITH CHECK (true);

-- Cualquiera puede leer (el dashboard usa la anon key)
CREATE POLICY "anon_select_clima" ON clima_respuestas
  FOR SELECT TO anon USING (true);
