-- Ejecutar en Supabase SQL Editor
-- Módulo NÓMINA — Ecuador 2026 (ecosistema MindTalent)
--
-- Modelo de acceso: igual al resto del ecosistema (ver rls_setup.sql).
-- Solo el equipo MINDTALENT autenticado en Supabase Auth accede a estas
-- tablas. No hay aislamiento por empresa_id a nivel de RLS — la separación
-- por cliente es solo de presentación (filtros en la UI).
--
-- empleados_nomina.puesto_id referencia el catálogo de cargos existente
-- (puestos), pero nombre, cédula, fecha de ingreso y sueldo son propios
-- de Nómina — no existen en el módulo Manual de Puestos.

-- 1. Empleados de nómina ---------------------------------------------------
create table if not exists empleados_nomina (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas_mdt(id) on delete cascade,
  puesto_id uuid references puestos(id) on delete set null,
  nombre text not null,
  cedula text,
  fecha_ingreso date,
  cargo text,
  area text,
  sueldo_nominal numeric not null default 0,
  tipo_contrato text,
  estado text not null default 'activo',
  fondos_reserva_activo boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists empleados_nomina_empresa_idx on empleados_nomina(empresa_id);
create index if not exists empleados_nomina_puesto_idx on empleados_nomina(puesto_id);

-- Agregado para el reparto de utilidades (5% proporcional a cargas familiares).
-- Seguro de re-ejecutar: no afecta filas existentes (default 0).
alter table empleados_nomina add column if not exists cargas_familiares int not null default 0;

-- 2. Nómina procesada por periodo ------------------------------------------
create table if not exists nomina_mensual (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados_nomina(id) on delete cascade,
  empresa_id uuid not null references empresas_mdt(id) on delete cascade,
  periodo text not null, -- 'YYYY-MM'
  dias_trabajados numeric not null default 30,
  horas_suplementarias numeric not null default 0,
  horas_extraordinarias numeric not null default 0,
  comisiones numeric not null default 0,
  bonos numeric not null default 0,
  ausencias_dias numeric not null default 0,
  atrasos_minutos numeric not null default 0,
  anticipos numeric not null default 0,
  prestamo_iess numeric not null default 0,
  otros_descuentos numeric not null default 0,
  sueldo_ganado numeric not null default 0,
  total_ingresos numeric not null default 0,
  aporte_iess_personal numeric not null default 0,
  impuesto_renta numeric not null default 0,
  total_descuentos numeric not null default 0,
  liquido_recibir numeric not null default 0,
  aporte_patronal numeric not null default 0,
  fondos_reserva numeric not null default 0,
  costo_empresa numeric not null default 0,
  provision_decimo3 numeric not null default 0,
  provision_decimo4 numeric not null default 0,
  provision_vacaciones numeric not null default 0,
  estado text not null default 'borrador', -- 'borrador' | 'aprobado' | 'pagado'
  created_at timestamptz default now(),
  unique (empleado_id, periodo)
);

create index if not exists nomina_mensual_empresa_periodo_idx on nomina_mensual(empresa_id, periodo);
create index if not exists nomina_mensual_empleado_idx on nomina_mensual(empleado_id);

-- 3. Saldo de vacaciones por empleado ---------------------------------------
create table if not exists vacaciones_empleado (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados_nomina(id) on delete cascade,
  dias_acumulados numeric not null default 0,
  dias_tomados numeric not null default 0,
  dias_pendientes numeric not null default 0,
  ultimo_calculo date,
  created_at timestamptz default now(),
  unique (empleado_id)
);

-- 4. Novedades mensuales -----------------------------------------------------
create table if not exists novedades_nomina (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados_nomina(id) on delete cascade,
  periodo text not null, -- 'YYYY-MM'
  tipo_novedad text not null, -- 'ausencia','atraso','permiso_cg','permiso_sg','anticipo','extra','suplementaria'
  descripcion text,
  valor numeric not null default 0,
  aplicado boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists novedades_nomina_empleado_periodo_idx on novedades_nomina(empleado_id, periodo);

-- 5. Parámetros legales por año (editable en admin) -------------------------
create table if not exists parametros_legales (
  id uuid primary key default gen_random_uuid(),
  anio int not null unique,
  sbu numeric not null,
  aporte_personal numeric not null,
  aporte_patronal numeric not null,
  fondos_reserva numeric not null,
  factor_decimo3 numeric not null,
  factor_decimo4 numeric not null,
  factor_vacaciones numeric not null,
  tabla_ir jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Seed 2026, según Plantilla_Nomina_Ecuador_2026.xlsm ------------------------
insert into parametros_legales (
  anio, sbu, aporte_personal, aporte_patronal, fondos_reserva,
  factor_decimo3, factor_decimo4, factor_vacaciones, tabla_ir
)
values (
  2026, 482, 0.0945, 0.1115, 0.0833,
  0.083333333333333, 40.1666666666667, 0.041666666666667,
  '[
    {"desde": 0,      "hasta": 12081,   "impuesto_fraccion": 0,     "porcentaje_excedente": 0},
    {"desde": 12081,  "hasta": 15387,   "impuesto_fraccion": 0,     "porcentaje_excedente": 0.05},
    {"desde": 15387,  "hasta": 19920,   "impuesto_fraccion": 165,   "porcentaje_excedente": 0.10},
    {"desde": 19920,  "hasta": 26766,   "impuesto_fraccion": 618,   "porcentaje_excedente": 0.12},
    {"desde": 26766,  "hasta": 35216,   "impuesto_fraccion": 1440,  "porcentaje_excedente": 0.15},
    {"desde": 35216,  "hasta": 46930,   "impuesto_fraccion": 2707,  "porcentaje_excedente": 0.20},
    {"desde": 46930,  "hasta": 62385,   "impuesto_fraccion": 5050,  "porcentaje_excedente": 0.25},
    {"desde": 62385,  "hasta": 83029,   "impuesto_fraccion": 8914,  "porcentaje_excedente": 0.30},
    {"desde": 83029,  "hasta": 108810,  "impuesto_fraccion": 15107, "porcentaje_excedente": 0.35},
    {"desde": 108810, "hasta": 9999999, "impuesto_fraccion": 24130, "porcentaje_excedente": 0.37}
  ]'::jsonb
)
on conflict (anio) do nothing;

-- RLS ------------------------------------------------------------------------
-- Mismo patrón que el resto del ecosistema (ver rls_setup.sql): solo el
-- equipo MINDTALENT autenticado accede; sin acceso anon.

alter table empleados_nomina enable row level security;
create policy "empleados_nomina_all_auth" on empleados_nomina
  for all to authenticated using (true) with check (true);

alter table nomina_mensual enable row level security;
create policy "nomina_mensual_all_auth" on nomina_mensual
  for all to authenticated using (true) with check (true);

alter table vacaciones_empleado enable row level security;
create policy "vacaciones_empleado_all_auth" on vacaciones_empleado
  for all to authenticated using (true) with check (true);

alter table novedades_nomina enable row level security;
create policy "novedades_nomina_all_auth" on novedades_nomina
  for all to authenticated using (true) with check (true);

alter table parametros_legales enable row level security;
create policy "parametros_legales_all_auth" on parametros_legales
  for all to authenticated using (true) with check (true);
