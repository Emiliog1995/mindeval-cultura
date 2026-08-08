-- Panel interno de clientes — PASO 2: retrofit de empresa_id
-- Ejecutar en Supabase → SQL Editor (proyecto mindeval-cultura)
-- Columnas nullable + backfill manual ya validado con el cliente.
-- No toca el texto libre existente (empresa), queda como respaldo histórico.

-- 1) Agregar empresa_id (nullable) a los 4 módulos que hoy usan texto libre ----
ALTER TABLE evaluaciones     ADD COLUMN empresa_id UUID REFERENCES empresas_mdt(id);
ALTER TABLE clima_respuestas ADD COLUMN empresa_id UUID REFERENCES empresas_mdt(id);
ALTER TABLE sesiones         ADD COLUMN empresa_id UUID REFERENCES empresas_mdt(id);
ALTER TABLE evaluados_360    ADD COLUMN empresa_id UUID REFERENCES empresas_mdt(id);

-- 2) Backfill manual, revisado fila por fila con el cliente -------------------

-- evaluaciones: 2 filas, todas MINDTALENT
UPDATE evaluaciones
SET empresa_id = 'caf63cab-1351-45b9-b445-db792b6a4a62'
WHERE empresa = 'MINDTALENT';

-- clima_respuestas: 10 filas, las 3 variantes de texto son la misma empresa
UPDATE clima_respuestas
SET empresa_id = 'caf63cab-1351-45b9-b445-db792b6a4a62'
WHERE empresa IN ('MINDTALENT', 'MINDATLENT', 'mindlant');

-- sesiones: única fila real restante (typo de Unbound)
UPDATE sesiones
SET empresa_id = '66732802-652a-4bb8-bccb-29d9a951d106'
WHERE empresa = 'FUNDACION UNBOUD';

-- evaluados_360: 5 filas reales restantes (limpiadas en el paso previo), todas MINDTALENT
UPDATE evaluados_360
SET empresa_id = 'caf63cab-1351-45b9-b445-db792b6a4a62'
WHERE id IN (
  'cfcb87e6-6a44-4ff5-973c-02a0160203a2',
  '78eaa15e-20bb-4049-af1a-a80bf054907e',
  '3bdf8a90-e0ef-4149-98f6-8071c14c1416',
  '93c2c130-b790-4d0d-9749-416f9b161385',
  'ac664b00-d82c-48d2-94e2-2a7cbbff49ba'
);
