-- Contexto institucional de la organización (empresas_mdt)
-- =========================================================
-- El PDI con IA (/api/360-pdi-sugerido) y la sugerencia de misión de puesto
-- (/api/sugerir-mision) arman su "Contexto organizacional" con estos campos.
-- Si están NULL la IA redacta sin saber para qué existe la organización y el
-- plan sale genérico — se sostiene, pero pierde la mitad de su valor.
--
-- ESTOS DATOS LOS ENTREGA EL CLIENTE. No se deducen del Manual de Puestos ni
-- se redactan "a criterio": la misión de un puesto describe el puesto, no a la
-- institución. Pedírselos a la contraparte de RRHH antes de la corrida real.
--
-- Uso: reemplaza los textos entre <> con lo que envió el cliente y ejecuta en
-- el SQL Editor de Supabase. Deja fuera del SET cualquier campo que aún no
-- tengas en vez de poner un texto de relleno.

-- 1) Ver qué hay cargado hoy antes de escribir
SELECT id, nombre, sector, giro_negocio, mision_empresa, objetivos, valores
FROM empresas_mdt
WHERE id = '66732802-652a-4bb8-bccb-29d9a951d106';  -- Fundación Unbound Ecuador

-- 2) Cargar el contexto
UPDATE empresas_mdt
SET
  mision_empresa = '<misión institucional textual que entregó el cliente>',
  objetivos      = '<objetivos estratégicos, uno por línea>',
  valores        = '<valores organizacionales, separados por coma>',
  giro_negocio   = '<a qué se dedica, en una línea>'
WHERE id = '66732802-652a-4bb8-bccb-29d9a951d106';

-- 3) Verificar contra la base — no confiar en el mensaje de éxito
SELECT id, nombre, mision_empresa, objetivos, valores, giro_negocio
FROM empresas_mdt
WHERE id = '66732802-652a-4bb8-bccb-29d9a951d106';
