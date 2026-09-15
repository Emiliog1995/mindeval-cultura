-- Tres ajustes pedidos por Fundación Unbound
-- ==========================================

-- 1) "No se lleva registro" en los indicadores de gestión
-- El jefe estaba obligado a poner un número del 1 al 5 en cada indicador.
-- Cuando la organización no mide ese indicador, eso lo forzaba a inventar un
-- número que después pesa 40% del desempeño. Ahora puede declarar que no hay
-- registro: no cuenta como 1, se excluye del promedio, y queda guardado como
-- hallazgo — saber cuántos indicadores no tienen registro es en sí mismo uno
-- de los resultados de la evaluación.
ALTER TABLE indicadores_resultado_360
  ADD COLUMN IF NOT EXISTS sin_registro boolean NOT NULL DEFAULT false;

-- Con sin_registro = true la calificación queda en NULL, así que la columna
-- tiene que admitirlo (si ya era nullable, esto no hace nada).
ALTER TABLE indicadores_resultado_360
  ALTER COLUMN calificacion DROP NOT NULL;

COMMENT ON COLUMN indicadores_resultado_360.sin_registro IS
  'true = el jefe declaró que la organización no lleva registro de este indicador. Distinto de no haber contestado: se excluye del promedio y se reporta como hallazgo.';

-- 2) Cuadro de necesidades en la autoevaluación
-- Texto libre y opcional donde la persona pide capacitaciones o materiales.
-- Solo se llena en la autoevaluación; en el resto de fuentes queda NULL.
ALTER TABLE evaluaciones_360
  ADD COLUMN IF NOT EXISTS necesidades text;

COMMENT ON COLUMN evaluaciones_360.necesidades IS
  'Necesidades que declara la propia persona en su autoevaluación: capacitaciones, materiales, apoyo. Opcional.';

-- 3) Nombres de competencias por organización
-- Las 6 competencias son las mismas para todos, pero cómo se llaman no: una
-- fundación de apadrinamiento no habla de "Servicio al Cliente". Solo se
-- guardan los nombres que la organización quiere cambiar; el resto usa los
-- genéricos. La CLAVE interna de cada competencia nunca cambia, porque las
-- evaluaciones ya guardadas la tienen adentro.
ALTER TABLE empresas_mdt
  ADD COLUMN IF NOT EXISTS competencias_labels jsonb;

COMMENT ON COLUMN empresas_mdt.competencias_labels IS
  'Renombres de competencias para esta organización, por clave. Ej: {"servicio_cliente": "Servicio al Apadrinamiento"}. Lo que no esté aquí usa el nombre genérico.';

-- Fundación Unbound Ecuador
UPDATE empresas_mdt
SET competencias_labels = '{"servicio_cliente": "Servicio al Apadrinamiento"}'::jsonb
WHERE id = '66732802-652a-4bb8-bccb-29d9a951d106';

-- Verificar
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE (table_name = 'indicadores_resultado_360' AND column_name IN ('sin_registro','calificacion'))
   OR (table_name = 'evaluaciones_360'          AND column_name = 'necesidades')
   OR (table_name = 'empresas_mdt'              AND column_name = 'competencias_labels')
ORDER BY table_name, column_name;

SELECT nombre, competencias_labels FROM empresas_mdt WHERE competencias_labels IS NOT NULL;
