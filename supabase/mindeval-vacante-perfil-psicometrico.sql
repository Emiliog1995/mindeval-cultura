-- ============================================================================
-- PERFIL PSICOMÉTRICO OBJETIVO POR VACANTE
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura) ANTES de
-- desplegar el código que la usa. Idempotente.
--
-- Por qué: el ajuste al perfil del 16PF-5 (lo que hoy ordena el ranking) se
-- calculaba contra un perfil objetivo FIJO EN CÓDIGO, derivado del cargo
-- "promotor/gestor social de campo" de la Fundación Unbound. Mientras solo
-- exista esa vacante el resultado es correcto, pero al abrir cualquier otra
-- —un contador, un coordinador administrativo— el sistema la habría
-- rankeado contra el perfil de promotor social SIN QUE NADIE LO NOTE: no
-- hay error, no hay aviso, solo un orden equivocado que parece válido.
--
-- Forma del JSON: un objeto escala -> dirección, con las escalas del 16PF-5
-- y las tres direcciones que sabe puntuar calcularAjuste16PF5():
--
--   { "A": "alto", "C": "alto", "H": "medio", "L": "bajo", ... }
--
-- Reglas que el código valida además de este esquema:
--   · Una escala AUSENTE del objeto no puntúa (es la forma de decir "este
--     factor no tiene dirección clara para el cargo"). Se sigue viendo
--     completa en la ficha del candidato, que es donde se interpreta.
--   · IM (Índice de manipulación) NUNCA se acepta aquí: es una escala de
--     VALIDEZ, no una competencia. Un IM alto hace que el perfil sea menos
--     confiable, no que la persona sea mejor o peor candidata.
--   · NULL = la vacante todavía no tiene perfil propio y cae a la plantilla
--     sugerida del código. La interfaz lo advierte de forma visible; no es
--     un estado silencioso.
-- ============================================================================

alter table mindeval_vacantes
  add column if not exists perfil_psicometrico jsonb;

comment on column mindeval_vacantes.perfil_psicometrico is
  'Perfil objetivo del 16PF-5 para esta vacante: {"A":"alto","L":"bajo",...} con direcciones alto|medio|bajo. Escala ausente = no puntúa. IM nunca entra (es validez, no competencia). NULL = sin configurar, el código usa la plantilla sugerida y la interfaz lo advierte.';
