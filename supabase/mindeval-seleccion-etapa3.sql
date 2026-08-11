-- Ejecutar en Supabase SQL Editor DESPUÉS de mindeval-seleccion-etapa2.sql
-- MINDEVAL SELECCIÓN — Etapa 3: fecha límite de postulación
--
-- Permite definir hasta cuándo se reciben CVs en una vacante. El cierre en
-- sí se evalúa en el servidor comparando la fecha actual contra esta
-- columna (ver vacanteAceptaPostulaciones() en mindeval-types.ts) — no hace
-- falta un cron ni cambiar el campo "estado" para que el link público deje
-- de aceptar postulaciones apenas se cumple la fecha.

alter table mindeval_vacantes
  add column if not exists fecha_limite_postulacion timestamptz;
