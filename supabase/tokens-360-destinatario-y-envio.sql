-- Destinatario y estado de envío de cada enlace 360°
-- ==================================================
-- tokens_360 guardaba el enlace pero no a quién iba dirigido: ese dato vivía
-- solo en la pantalla del consultor justo después de generarlo. Al recargar
-- se perdía, así que no había forma de mandar los correos después, de
-- reenviar uno que se fue a spam, ni de saber a quién ya se le escribió.

ALTER TABLE tokens_360
  ADD COLUMN IF NOT EXISTS evaluador_nombre text,
  ADD COLUMN IF NOT EXISTS evaluador_email  text,
  ADD COLUMN IF NOT EXISTS enviado_en       timestamptz;

COMMENT ON COLUMN tokens_360.evaluador_nombre IS 'A quién va dirigido este enlace, resuelto al generarlo.';
COMMENT ON COLUMN tokens_360.evaluador_email  IS 'Correo del evaluador. Sin esto el enlace no se puede enviar, solo copiar a mano.';
COMMENT ON COLUMN tokens_360.enviado_en       IS 'Cuándo salió el correo. NULL = todavía no se envió. Se marca solo si Resend confirmó el envío.';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tokens_360'
  AND column_name IN ('evaluador_nombre','evaluador_email','enviado_en');
