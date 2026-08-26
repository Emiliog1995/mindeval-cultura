-- Ejecutar en Supabase SQL Editor
-- Permite que Evaluación 360° genere solo los links (fuentes) que
-- realmente aplican a cada puesto según el organigrama, en vez de
-- los 5 fijos (autoevaluación, jefe, par, colaborador, cliente interno).

alter table puestos add column if not exists tiene_cliente_interno boolean not null default false;
