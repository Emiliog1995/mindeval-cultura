-- ============================================================================
-- CONTACTO RESPONSABLE DE LA VACANTE — auditoría 2026-09, I-7 y M-4
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura). Idempotente.
--
-- Por qué: los correos salían sin ninguna persona detrás y no había a quién
-- avisar cuando un candidato terminaba su prueba. Dos consecuencias:
--
--   · El candidato recibía correos sin firma ni forma de responder si algo
--     le fallaba — se leen como automáticos y terminan en spam (M-4).
--   · El reclutador tenía que entrar al panel a revisar manualmente si
--     alguien había avanzado; nada le avisaba (I-7).
--
-- El contacto es por vacante, no global, porque un mismo despliegue atiende
-- a varias empresas y cada proceso tiene su responsable.
-- ============================================================================

alter table mindeval_vacantes
  add column if not exists contacto_nombre text,
  add column if not exists contacto_email  text;

comment on column mindeval_vacantes.contacto_email is
  'Correo del reclutador responsable. Recibe el aviso cuando un candidato completa una prueba, y aparece como contacto en los correos al candidato. NULL = sin avisos y sin firma de contacto.';
