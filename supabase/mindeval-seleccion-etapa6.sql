-- Ejecutar en Supabase SQL Editor DESPUÉS de mindeval-seleccion-etapa5.sql
-- MINDEVAL SELECCIÓN — Etapa 6: bancos psicométricos reales (16PF-5, KOSTICK)
--
-- Sustituye, solo para las vacantes donde el reclutador active alguno de
-- estos tests, el placeholder BATERIAS_EJEMPLO/ITEMS_EJEMPLO (escala 1-5
-- genérica) por los bancos reales del 16PF-5 (185 ítems, 16 escalas) y
-- KOSTICK (90 pares, 20 factores). El placeholder sigue funcionando igual
-- que antes para cualquier vacante con tests_psicometricos vacío — nada de
-- lo ya agendado/calificado cambia de comportamiento.

alter table mindeval_vacantes
  add column if not exists tests_psicometricos text[] not null default '{}'::text[];

alter table mindeval_vacantes
  drop constraint if exists mindeval_vacantes_tests_psicometricos_check;
alter table mindeval_vacantes
  add constraint mindeval_vacantes_tests_psicometricos_check
  check (tests_psicometricos <@ array['16pf5','kostick','disc','valanti']::text[]);

-- El STEN del 16PF-5 (decatipo, 1-10) encaja tal cual en la columna sten
-- existente. El conteo crudo ipsativo de KOSTICK (0-9 por factor, ver
-- mindeval-kostick.ts) no — se relaja el check para admitir 0 sin forzar
-- una conversión inventada a una escala que KOSTICK no tiene.
alter table mindeval_pruebas_psicometricas drop constraint if exists mindeval_pruebas_psicometricas_sten_check;
alter table mindeval_pruebas_psicometricas add constraint mindeval_pruebas_psicometricas_sten_check
  check (sten between 0 and 10);
