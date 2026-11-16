-- Permiso por usuario para ver "Evaluaciones anteriores" (cohorte de la
-- plataforma anterior). Por defecto sí; se apaga para quien no debe verlas,
-- p. ej. una persona que fue evaluada en esa cohorte (conflicto de interés).
-- El super_admin siempre puede verlas.
alter table usuarios_autorizados
  add column if not exists ver_historico boolean not null default true;
