-- Panel interno de clientes — PASO 3/4: campos faltantes en empresas_mdt
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Aditivo: 2 columnas nullable, no toca las 2 filas existentes.

ALTER TABLE empresas_mdt ADD COLUMN ruc TEXT;
ALTER TABLE empresas_mdt ADD COLUMN contacto TEXT;
