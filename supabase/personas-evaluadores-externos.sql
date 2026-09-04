-- Evaluadores externos al Manual de Puestos
-- =========================================
-- Hay evaluadores que no forman parte de la nómina de la organización y que
-- por lo tanto no tienen puesto en el Manual: contrapartes regionales, casas
-- matrices, clientes internos de otra sede. Reciben formularios pero no se
-- los evalúa a ellos.
--
-- No se les crea un puesto: el Manual de Puestos es de otro módulo y este
-- no lo modifica, solo lo lee. En su lugar llevan su cargo como texto libre.
--
-- Además de identificarlos en la UI, ese texto es lo que le permite a
-- /api/360-organigrama emparejarlos con el organigrama del Manual. Caso real:
-- la Presidenta de Fundación Unbound "reporta a la Asamblea General de
-- Miembros", que no es una persona; al registrar a la Directora de Programas
-- Internacionales como representante de esa Asamblea, la IA ya puede
-- resolver quién le llena el formulario de jefe -- que pesa 40%.

ALTER TABLE personas ADD COLUMN IF NOT EXISTS cargo_externo text;

COMMENT ON COLUMN personas.cargo_externo IS
  'Cargo en texto libre para evaluadores que no tienen puesto en el Manual de Puestos (contrapartes regionales, casa matriz). Si está lleno, puesto_id normalmente es NULL.';

-- Verificar
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'personas' AND column_name = 'cargo_externo';
