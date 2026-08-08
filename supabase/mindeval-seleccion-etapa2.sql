-- Ejecutar en Supabase SQL Editor DESPUÉS de mindeval-seleccion.sql
-- MINDEVAL SELECCIÓN — Etapa 2: subida de CV + agendamiento de pruebas
--
-- Cambios de esta etapa:
-- 1. mindeval_sesiones_prueba: agenda de psicométrica/técnica con token de
--    acceso público. Sigue el mismo patrón que tokens_360 (sin acceso anon
--    directo — el candidato entra por /seleccion/prueba/[token], que valida
--    el token en un Route Handler con service_role, nunca con la anon key).
-- 2. Bucket de Storage "mindeval-cvs" (privado) para el archivo original del
--    CV subido por el postulante.
-- 3. La postulación pública ahora sube el CV y calcula el match desde
--    /api/mindeval-postular (service_role), así que las políticas anon que
--    permitían insertar directo desde el navegador ya no son necesarias —
--    se retiran para seguir el mismo criterio que el resto del ecosistema
--    ("los flujos públicos que necesitan leer algo antes de escribir pasan
--    por rutas server-side", ver rls_setup.sql).

-- 1. Sesiones de prueba agendadas ---------------------------------------------
create table if not exists mindeval_sesiones_prueba (
  id                uuid primary key default gen_random_uuid(),
  candidato_id      uuid not null references mindeval_candidatos(id) on delete cascade,
  vacante_id        uuid not null references mindeval_vacantes(id) on delete cascade,
  tipo              text not null check (tipo in ('psicometrica','tecnica')),
  token             uuid not null unique default gen_random_uuid(),
  fecha_programada  timestamptz not null,
  estado            text not null default 'programada' check (estado in ('programada','en_curso','completada','expirada')),
  completada_en     timestamptz,
  created_at        timestamptz default now()
);

create index if not exists mindeval_sesiones_prueba_candidato_idx on mindeval_sesiones_prueba(candidato_id);
create index if not exists mindeval_sesiones_prueba_token_idx on mindeval_sesiones_prueba(token);

alter table mindeval_sesiones_prueba enable row level security;

-- Sin acceso anon: el candidato entra por /seleccion/prueba/[token], que
-- valida el token del lado del servidor con supabaseAdmin.
create policy "mindeval_sesiones_prueba_all_auth" on mindeval_sesiones_prueba
  for all to authenticated using (true) with check (true);

-- 2. Endurecer políticas públicas de la etapa 1 --------------------------------
-- La postulación ahora pasa por /api/mindeval-postular (service_role), que
-- valida el estado de la vacante del lado del servidor antes de insertar.
drop policy if exists "mindeval_candidatos_insert_publico" on mindeval_candidatos;
drop policy if exists "mindeval_vacantes_select_publico" on mindeval_vacantes;

-- 3. Bucket de Storage para los CVs originales ---------------------------------
insert into storage.buckets (id, name, public)
values ('mindeval-cvs', 'mindeval-cvs', false)
on conflict (id) do nothing;

-- Solo service_role sube/lee los archivos (siempre vía Route Handlers,
-- nunca directo desde el navegador con la anon key).
create policy "mindeval_cvs_service_role_all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'mindeval-cvs')
  with check (bucket_id = 'mindeval-cvs');

-- 4. Realtime para el panel de monitoreo en vivo del reclutador ---------------
-- (/seleccion/[vacanteId]/monitoreo se suscribe a nuevas alertas sin recargar)
alter publication supabase_realtime add table mindeval_alertas_fraude;
