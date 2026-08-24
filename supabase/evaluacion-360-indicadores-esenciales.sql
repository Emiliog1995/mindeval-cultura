-- ══════════════════════════════════════════════════════════════
-- Evaluación 360°: Desempeño = 360° (60%) + Indicadores esenciales (40%)
-- Ejecutar en Supabase → SQL Editor
-- No modifica columnas existentes, solo agrega
-- ══════════════════════════════════════════════════════════════

-- Vincula cada evaluado 360° con su ficha del Manual de Puestos,
-- para saber cuáles son sus indicadores de actividades esenciales.
alter table evaluados_360 add column if not exists puesto_id uuid references puestos(id);

-- Resultado real (escala 1.0–5.0) de cada indicador esencial,
-- cargado por el jefe directo en el mismo formulario del 360°.
create table if not exists indicadores_resultado_360 (
  id                  uuid primary key default gen_random_uuid(),
  evaluado_id         uuid not null references evaluados_360(id) on delete cascade,
  periodo             text not null,
  indicador_puesto_id uuid not null references indicadores_puesto(id) on delete cascade,
  calificacion        numeric(2,1) not null check (calificacion >= 1 and calificacion <= 5),
  created_at          timestamptz default now(),
  unique (evaluado_id, periodo, indicador_puesto_id)
);

alter table indicadores_resultado_360 enable row level security;

-- Mismo criterio de acceso que el resto del módulo 360°: el consultor
-- autenticado puede leer/escribir; el flujo público por token usa
-- service_role desde el Route Handler y no pasa por RLS.
create policy "authenticated_all_indicadores_resultado_360"
  on indicadores_resultado_360 for all
  using (auth.role() = 'authenticated');
