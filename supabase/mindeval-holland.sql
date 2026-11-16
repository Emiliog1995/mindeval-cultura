-- Test vocacional de Holland (RIASEC) como prueba disponible (instituciones).
-- Amplía la lista de pruebas permitidas en una vacante/proceso. Nada existente
-- cambia: solo se agrega 'holland' a los valores válidos.
alter table mindeval_vacantes
  drop constraint if exists mindeval_vacantes_tests_psicometricos_check;
alter table mindeval_vacantes
  add constraint mindeval_vacantes_tests_psicometricos_check
  check (tests_psicometricos <@ array['16pf5','kostick','disc','valanti','holland']::text[]);
