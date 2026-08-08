-- Panel interno de clientes -- PASO 5: tamano estimado de la empresa
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Aditivo: 1 columna nullable, no toca las filas existentes.

ALTER TABLE empresas_mdt ADD COLUMN tamano_estimado INTEGER;
