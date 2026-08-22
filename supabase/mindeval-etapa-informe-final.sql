-- MINDEVAL SELECCIÓN -- agrega la Etapa "Informe Final" al embudo
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Idempotente.
--
-- Por qué: se agregó una etapa nueva "informe_final" ANTES de "entrevista" —
-- el Informe Ejecutivo (por niveles de evidencia: SENESCYT + psicométricas +
-- técnica + assessment) se genera para decidir a quién entrevistar; la
-- entrevista misma queda fuera del informe, es decisión humana del panel.
-- Sin este script, un candidato no se puede mover a 'informe_final' porque
-- el CHECK de mindeval_candidatos.etapa_actual todavía no lo permite.

-- Si el ADD CONSTRAINT de abajo falla con "ya existe" o el DROP no encontró
-- nada, el nombre real puede diferir del que asume este script (el default
-- de Postgres para un check sin nombre) -- confírmalo con:
--   select conname from pg_constraint where conrelid = 'mindeval_candidatos'::regclass and contype = 'c';
-- y ajusta el DROP CONSTRAINT con el nombre que encuentres.
ALTER TABLE mindeval_candidatos DROP CONSTRAINT IF EXISTS mindeval_candidatos_etapa_actual_check;

ALTER TABLE mindeval_candidatos ADD CONSTRAINT mindeval_candidatos_etapa_actual_check CHECK (
  etapa_actual IN (
    'postulado', 'filtro_cv', 'verificacion_titulo', 'psicometricas',
    'tecnica', 'assessment', 'informe_final', 'entrevista',
    'finalista', 'contratado', 'descartado'
  )
);
