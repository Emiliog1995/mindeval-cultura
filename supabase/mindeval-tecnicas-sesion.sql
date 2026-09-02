-- ============================================================================
-- UN INTENTO TÉCNICO POR SESIÓN — auditoría 2026-09, I-12
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura). Idempotente.
--
-- Por qué: mindeval_pruebas_tecnicas solo guardaba candidato_id, así que el
-- guardado buscaba "el intento pendiente de ESTE candidato" sin saber a qué
-- sesión pertenecía. Como no existía "reenviar invitación", la única forma de
-- volver a mandarle el enlace a alguien era agendarle otra prueba, lo que
-- creaba una segunda sesión con token nuevo SIN invalidar la anterior: el
-- candidato podía tener dos enlaces vivos, rendir dos veces, y las respuestas
-- del segundo intento podían escribirse sobre la fila del primero.
--
-- Con sesion_id, cada intento queda atado a la invitación que lo originó.
-- Las filas antiguas se quedan en NULL a propósito: el código sigue
-- aceptándolas por candidato_id como antes, así que ningún intento en curso
-- se rompe al aplicar esto.
-- ============================================================================

alter table mindeval_pruebas_tecnicas
  add column if not exists sesion_id uuid references mindeval_sesiones_prueba(id) on delete set null;

create index if not exists mindeval_pruebas_tecnicas_sesion_idx
  on mindeval_pruebas_tecnicas(sesion_id);

comment on column mindeval_pruebas_tecnicas.sesion_id is
  'Sesión de prueba que originó este intento. NULL en filas anteriores a esta migración, que se siguen resolviendo por candidato_id.';
