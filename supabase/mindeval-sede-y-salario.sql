-- MINDEVAL SELECCIÓN -- sede y filtro de salario opcionales en postulación
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Idempotente. Aditivo: columnas nullable, no toca filas existentes.
--
-- Por qué: caso especial pedido por Fundación Unbound Ecuador -- la vacante
-- "Promotor Social 2 -- Subproyecto y Comunidades" busca 2 personas para
-- sedes distintas (Quito Norte / Quito Sur) y quiere descartar automático a
-- quien no acepte el salario ofertado ($510). En vez de hardcodear el id de
-- esa vacante en el código, `sedes` y `salario_pregunta` quedan como
-- columnas genéricas y opcionales en mindeval_vacantes: el formulario
-- público solo muestra el selector de sede / la pregunta de salario si la
-- vacante trae esos campos poblados. Por default quedan NULL, así que esto
-- no cambia nada para el resto de vacantes ni de clientes.
ALTER TABLE mindeval_vacantes ADD COLUMN IF NOT EXISTS sedes JSONB;
ALTER TABLE mindeval_vacantes ADD COLUMN IF NOT EXISTS salario_pregunta JSONB;

ALTER TABLE mindeval_candidatos ADD COLUMN IF NOT EXISTS sede TEXT;
ALTER TABLE mindeval_candidatos ADD COLUMN IF NOT EXISTS salario_acuerdo BOOLEAN;

-- Activa el caso especial únicamente en la vacante de Fundación Unbound
-- Ecuador (id tomado del link de postulación ya compartido con candidatos).
-- No corre en ninguna otra vacante.
UPDATE mindeval_vacantes
SET
  sedes = '["Quito Norte", "Quito Sur"]'::jsonb,
  salario_pregunta = '{"monto": 510}'::jsonb
WHERE id = '499b0bb0-877d-41e5-a64b-6217e973c120';
