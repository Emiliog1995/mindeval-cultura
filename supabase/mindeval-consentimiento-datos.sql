-- Constancia de aceptación de la Ley Orgánica de Protección de Datos Personales
-- (fecha/hora en que el evaluado marcó la casilla antes de rendir la prueba).
alter table mindeval_sesiones_prueba add column if not exists acepto_datos_en timestamptz;
