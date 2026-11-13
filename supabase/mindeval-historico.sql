-- Evaluaciones de la plataforma anterior de USECIPOL (servidor de Contabo,
-- borrado por el proveedor en sept/oct 2026). Se reconstruyen desde el
-- extracto de auditoría de septiembre: SOLO puntajes por escala, tiempos y
-- alertas. Los dictámenes de la IA anterior ("PRUEBA INVALIDADA, IAP 0/100")
-- NO se importan: salieron de un umbral mal calibrado.
--
-- Solo lectura. RLS activo y SIN policies: nadie la lee directo desde el
-- navegador; se accede por /api/mindeval-institucion-historico, que valida
-- que la cuenta sea de esa institución (o super_admin).

create table if not exists mindeval_historico_evaluados (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas_mdt(id),
  cohorte      text not null,
  nombre       text not null,
  cedula       text,
  pruebas      jsonb not null,
  importado_en timestamptz not null default now()
);

create index if not exists mindeval_historico_empresa_idx on mindeval_historico_evaluados(empresa_id);

alter table mindeval_historico_evaluados enable row level security;
