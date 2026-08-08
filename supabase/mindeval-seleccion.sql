-- Ejecutar en Supabase SQL Editor
-- Módulo MINDEVAL SELECCIÓN — ecosistema MindTalent
--
-- Modelo de acceso: igual al resto del ecosistema (ver rls_setup.sql).
-- Solo el equipo MINDTALENT autenticado en Supabase Auth gestiona vacantes
-- y candidatos. mindeval_candidatos y mindeval_alertas_fraude además
-- aceptan INSERT público (sin login) porque los llenan directamente el
-- candidato postulante y el navegador del candidato durante una prueba.
--
-- mindeval_vacantes.puesto_id referencia el catálogo de Manual de Puestos
-- (puestos) cuando ese módulo ya está instalado; si no, se usa el fallback
-- jsonb perfil_cargo_manual. No se duplica la tabla puestos.

-- 1. Vacantes ---------------------------------------------------------------
create table if not exists mindeval_vacantes (
  id                  uuid primary key default gen_random_uuid(),
  puesto_id           uuid references puestos(id) on delete set null,
  perfil_cargo_manual jsonb,
  titulo              text not null,
  empresa             text not null,
  codigo_proceso      text,
  estado              text not null default 'abierta' check (estado in ('abierta','pausada','cerrada')),
  corte_match_cv      numeric not null default 72,
  corte_sten          numeric not null default 6,
  corte_tecnica       numeric not null default 70,
  created_at          timestamptz default now()
);

-- 2. Candidatos ---------------------------------------------------------------
create table if not exists mindeval_candidatos (
  id                 uuid primary key default gen_random_uuid(),
  vacante_id         uuid not null references mindeval_vacantes(id) on delete cascade,
  nombre_completo    text not null,
  cedula             text,
  email              text,
  telefono           text,
  ciudad             text,
  anios_experiencia  numeric,
  educacion          text,
  cv_texto           text,
  cv_url             text,
  etapa_actual       text not null default 'postulado' check (
    etapa_actual in ('postulado','filtro_cv','verificacion_titulo','psicometricas','tecnica','assessment','entrevista','finalista','contratado','descartado')
  ),
  estado             text not null default 'activo' check (estado in ('activo','descartado','contratado')),
  motivo_descarte    text,
  created_at         timestamptz default now()
);

-- 3. Match de CV por IA -------------------------------------------------------
create table if not exists mindeval_cv_matches (
  id            uuid primary key default gen_random_uuid(),
  candidato_id  uuid not null references mindeval_candidatos(id) on delete cascade,
  match_pct     numeric not null,
  razones       jsonb,
  generado_en   timestamptz default now()
);

-- 4. Verificación SENESCYT (manual) ------------------------------------------
create table if not exists mindeval_verificaciones_titulo (
  id                uuid primary key default gen_random_uuid(),
  candidato_id      uuid not null references mindeval_candidatos(id) on delete cascade,
  titulo_declarado  text,
  institucion       text,
  anio              int,
  estado            text not null default 'pendiente' check (estado in ('pendiente','registrado','sin_registro')),
  verificado_por    text,
  verificado_en     timestamptz,
  comprobante_url   text
);

-- 5. Pruebas psicométricas ----------------------------------------------------
create table if not exists mindeval_pruebas_psicometricas (
  id            uuid primary key default gen_random_uuid(),
  candidato_id  uuid not null references mindeval_candidatos(id) on delete cascade,
  bateria       text not null,
  sten          int check (sten between 1 and 10),
  percentil     numeric,
  respuestas    jsonb,
  aplicada_en   timestamptz default now()
);

-- 6. Pruebas técnicas ----------------------------------------------------------
create table if not exists mindeval_pruebas_tecnicas (
  id                  uuid primary key default gen_random_uuid(),
  candidato_id        uuid not null references mindeval_candidatos(id) on delete cascade,
  caso_generado       text not null,
  criterios           jsonb,
  respuesta_candidato text,
  puntaje_analisis    numeric,
  puntaje_estrategia  numeric,
  puntaje_kpis        numeric,
  puntaje_claridad    numeric,
  puntaje_total       numeric generated always as (
    coalesce(puntaje_analisis,0) + coalesce(puntaje_estrategia,0) + coalesce(puntaje_kpis,0) + coalesce(puntaje_claridad,0)
  ) stored,
  corregido_por       text default 'ia',
  created_at          timestamptz default now()
);

-- 7. Assessment Center ----------------------------------------------------------
create table if not exists mindeval_assessment_evaluaciones (
  id             uuid primary key default gen_random_uuid(),
  candidato_id   uuid not null references mindeval_candidatos(id) on delete cascade,
  ejercicio      text not null,
  competencia    text not null,
  puntaje        numeric check (puntaje between 0 and 10),
  evaluador      text,
  notas          text,
  created_at     timestamptz default now()
);

-- 8. Entrevistas ----------------------------------------------------------------
create table if not exists mindeval_entrevistas (
  id              uuid primary key default gen_random_uuid(),
  candidato_id    uuid not null references mindeval_candidatos(id) on delete cascade,
  fecha           timestamptz,
  entrevistadores text,
  resultado       text check (resultado in ('avanza','no_avanza','oferta','contratado')),
  notas           text,
  created_at      timestamptz default now()
);

-- 9. Alertas anti-fraude ----------------------------------------------------------
create table if not exists mindeval_alertas_fraude (
  id            uuid primary key default gen_random_uuid(),
  candidato_id  uuid not null references mindeval_candidatos(id) on delete cascade,
  sesion_tipo   text not null,
  tipo_alerta   text not null,
  severidad     text not null check (severidad in ('bajo','medio','alto','critico')),
  detalle       text,
  creado_en     timestamptz default now()
);

-- 10. Informes ejecutivos IA -------------------------------------------------------
create table if not exists mindeval_informes_ia (
  id            uuid primary key default gen_random_uuid(),
  candidato_id  uuid not null references mindeval_candidatos(id) on delete cascade,
  tipo          text not null default 'perfil',
  contenido     text not null,
  generado_en   timestamptz default now()
);

create index if not exists mindeval_candidatos_vacante_idx on mindeval_candidatos(vacante_id);
create index if not exists mindeval_alertas_candidato_idx on mindeval_alertas_fraude(candidato_id);

-- ============================================================================
-- RLS — igual al modelo del resto del ecosistema
-- ============================================================================

alter table mindeval_vacantes                enable row level security;
alter table mindeval_candidatos              enable row level security;
alter table mindeval_cv_matches              enable row level security;
alter table mindeval_verificaciones_titulo   enable row level security;
alter table mindeval_pruebas_psicometricas   enable row level security;
alter table mindeval_pruebas_tecnicas        enable row level security;
alter table mindeval_assessment_evaluaciones enable row level security;
alter table mindeval_entrevistas             enable row level security;
alter table mindeval_alertas_fraude          enable row level security;
alter table mindeval_informes_ia             enable row level security;

create policy "mindeval_vacantes_all_auth" on mindeval_vacantes
  for all to authenticated using (true) with check (true);

-- vacantes abiertas: lectura pública mínima para que el formulario de
-- postulación (/seleccion/[vacanteId]/postular) muestre el título sin login
create policy "mindeval_vacantes_select_publico" on mindeval_vacantes
  for select to anon
  using (estado = 'abierta');

-- candidatos: el equipo autenticado gestiona todo; además cualquiera puede
-- postular (insert público) desde /seleccion/[vacanteId]/postular
create policy "mindeval_candidatos_all_auth" on mindeval_candidatos
  for all to authenticated using (true) with check (true);

create policy "mindeval_candidatos_insert_publico" on mindeval_candidatos
  for insert to anon
  with check (true);

create policy "mindeval_cv_matches_all_auth" on mindeval_cv_matches
  for all to authenticated using (true) with check (true);

create policy "mindeval_verificaciones_all_auth" on mindeval_verificaciones_titulo
  for all to authenticated using (true) with check (true);

create policy "mindeval_psicometricas_all_auth" on mindeval_pruebas_psicometricas
  for all to authenticated using (true) with check (true);

create policy "mindeval_tecnicas_all_auth" on mindeval_pruebas_tecnicas
  for all to authenticated using (true) with check (true);

create policy "mindeval_assessment_all_auth" on mindeval_assessment_evaluaciones
  for all to authenticated using (true) with check (true);

create policy "mindeval_entrevistas_all_auth" on mindeval_entrevistas
  for all to authenticated using (true) with check (true);

create policy "mindeval_informes_all_auth" on mindeval_informes_ia
  for all to authenticated using (true) with check (true);

-- alertas_fraude: el equipo autenticado lee todo; además el navegador del
-- candidato (sin login, durante la prueba) puede insertar sus propias alertas
create policy "mindeval_alertas_all_auth" on mindeval_alertas_fraude
  for all to authenticated using (true) with check (true);

create policy "mindeval_alertas_insert_publico" on mindeval_alertas_fraude
  for insert to anon
  with check (true);
