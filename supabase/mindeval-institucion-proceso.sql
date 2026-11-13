-- Proceso de evaluación para instituciones (USECIPOL / Policía Nacional).
--
-- Reusa mindeval_vacantes como "proceso" y mindeval_sesiones_prueba como
-- "invitación". Solo agrega columnas opcionales: los clientes empresa no
-- las usan y nada existente cambia.
--
--  * mindeval_vacantes.tiempo_limite_min : tiempo total del examen (ej. 120).
--                                          NULL = se usa la suma por batería.
--  * mindeval_sesiones_prueba.clave_hash : contraseña temporal del evaluado
--                                          (scrypt, nunca en claro).
--  * mindeval_sesiones_prueba.clave_intentos : intentos fallidos; a los 5 se
--                                          bloquea hasta reenviar invitación.

alter table mindeval_vacantes
  add column if not exists tiempo_limite_min integer
  check (tiempo_limite_min is null or tiempo_limite_min between 5 and 600);

alter table mindeval_sesiones_prueba
  add column if not exists clave_hash text,
  add column if not exists clave_intentos integer not null default 0;
