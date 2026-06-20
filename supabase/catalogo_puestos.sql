-- Ejecutar en Supabase SQL Editor

create table if not exists catalogo_puestos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas_mdt(id) on delete cascade,
  nombre_puesto text not null,
  area text,
  supervisado_por text,
  supervisa_a text,
  actividades jsonb not null default '[]'::jsonb,
  orden int default 0,
  created_at timestamptz default now()
);

create index if not exists catalogo_puestos_empresa_idx on catalogo_puestos(empresa_id);
