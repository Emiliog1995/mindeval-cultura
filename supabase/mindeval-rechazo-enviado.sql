-- ============================================================================
-- REGISTRO DEL CORREO DE NO SELECCIONADO — auditoría 2026-09, F2-7
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura). Idempotente.
--
-- Por qué: el botón "Enviar correo de no seleccionado" enviaba a un clic y no
-- dejaba rastro. Nada impedía volver a pulsarlo, así que un candidato ya
-- descartado podía recibir el mismo correo de rechazo dos o tres veces —
-- y el reclutador que retomaba el proceso días después no tenía forma de
-- saber si ya se había enviado o no.
--
-- Se guarda solo el momento del envío. No se guarda el contenido: el correo
-- es una plantilla fija (enviarNoSeleccionado en src/lib/mindeval-email.ts).
-- ============================================================================

alter table mindeval_candidatos
  add column if not exists rechazo_enviado_en timestamptz;

comment on column mindeval_candidatos.rechazo_enviado_en is
  'Momento en que se envió el correo de "no seleccionado" a este candidato. NULL = nunca se le envió. Lo escribe /api/mindeval-enviar-rechazo tras confirmar que el proveedor aceptó el correo.';
