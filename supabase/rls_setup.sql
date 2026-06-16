-- ============================================================================
-- RLS para mindeval-cultura (herramienta interna de consultoría MINDTALENT)
--
-- Modelo de acceso:
--   - Solo el equipo MINDTALENT (usuarios autenticados en Supabase Auth) puede
--     leer, editar o borrar cualquier dato. No hay login por empresa cliente.
--   - Los formularios públicos de UNA sola pantalla (DOCS, Clima) siguen
--     aceptando envíos sin login: son inserts simples, sin lectura previa de
--     datos sensibles.
--   - Los flujos públicos que necesitan LEER algo antes de escribir (links de
--     evaluación 360°, formulario de ocupante de puesto, formulario de
--     ocupante por empresa) ya NO usan la anon key directo desde el navegador:
--     pasan por rutas server-side (/api/token/...) que usan la service_role
--     key y validan el token antes de exponer cualquier dato. Por eso aquí
--     bloqueamos anon por completo en esas tablas (tokens_360, puestos,
--     empresas_mdt, respuestas_ocupante, evaluaciones_360).
--
-- Cómo aplicar: Supabase → SQL Editor → pegar y ejecutar completo.
-- ============================================================================

-- evaluaciones (DOCS) -----------------------------------------------------------
alter table public.evaluaciones enable row level security;

create policy "evaluaciones_insert_publico" on public.evaluaciones
  for insert to anon, authenticated
  with check (true);

create policy "evaluaciones_select_auth" on public.evaluaciones
  for select to authenticated using (true);

create policy "evaluaciones_update_auth" on public.evaluaciones
  for update to authenticated using (true) with check (true);

create policy "evaluaciones_delete_auth" on public.evaluaciones
  for delete to authenticated using (true);

-- clima_respuestas ----------------------------------------------------------------
alter table public.clima_respuestas enable row level security;

create policy "clima_insert_publico" on public.clima_respuestas
  for insert to anon, authenticated
  with check (true);

create policy "clima_select_auth" on public.clima_respuestas
  for select to authenticated using (true);

create policy "clima_update_auth" on public.clima_respuestas
  for update to authenticated using (true) with check (true);

create policy "clima_delete_auth" on public.clima_respuestas
  for delete to authenticated using (true);

-- sesiones (link genérico /eval?id=, baja sensibilidad: tipo + empresa + estado) --
alter table public.sesiones enable row level security;

create policy "sesiones_select_publico" on public.sesiones
  for select to anon, authenticated using (true);

create policy "sesiones_insert_auth" on public.sesiones
  for insert to authenticated with check (true);

-- anon solo puede marcar una sesión pendiente como completada, nada más
create policy "sesiones_update_completar_publico" on public.sesiones
  for update to anon
  using (estado = 'pendiente')
  with check (estado = 'completada');

create policy "sesiones_update_auth" on public.sesiones
  for update to authenticated using (true) with check (true);

create policy "sesiones_delete_auth" on public.sesiones
  for delete to authenticated using (true);

-- evaluados_360 — gestión exclusiva del consultor -------------------------------
alter table public.evaluados_360 enable row level security;

create policy "evaluados_360_all_auth" on public.evaluados_360
  for all to authenticated using (true) with check (true);

-- evaluaciones_360 — el insert público pasa por /api/token/360 con service_role
alter table public.evaluaciones_360 enable row level security;

create policy "evaluaciones_360_all_auth" on public.evaluaciones_360
  for all to authenticated using (true) with check (true);

-- pdi_360 -------------------------------------------------------------------------
alter table public.pdi_360 enable row level security;

create policy "pdi_360_all_auth" on public.pdi_360
  for all to authenticated using (true) with check (true);

-- tokens_360 — sin acceso anon; todo pasa por /api/token/360 con service_role ----
alter table public.tokens_360 enable row level security;

create policy "tokens_360_all_auth" on public.tokens_360
  for all to authenticated using (true) with check (true);

-- empresas_mdt — sin acceso anon; el flujo público pasa por
-- /api/token/ocupante-empresa con service_role (la tabla puede contener
-- misión/visión/datos estratégicos del cliente, no solo nombre+logo) ------------
alter table public.empresas_mdt enable row level security;

create policy "empresas_mdt_all_auth" on public.empresas_mdt
  for all to authenticated using (true) with check (true);

-- puestos — sin acceso anon; el flujo público pasa por /api/token/ocupante -------
alter table public.puestos enable row level security;

create policy "puestos_all_auth" on public.puestos
  for all to authenticated using (true) with check (true);

-- respuestas_ocupante — sin acceso anon; el insert público pasa por las rutas
-- /api/token/ocupante y /api/token/ocupante-empresa con service_role ------------
alter table public.respuestas_ocupante enable row level security;

create policy "respuestas_ocupante_all_auth" on public.respuestas_ocupante
  for all to authenticated using (true) with check (true);

-- actividades_puesto / competencias_puesto / instruccion_puesto /
-- indicadores_puesto — solo el consultor las usa (manual de puestos) ------------
alter table public.actividades_puesto enable row level security;
create policy "actividades_puesto_all_auth" on public.actividades_puesto
  for all to authenticated using (true) with check (true);

alter table public.competencias_puesto enable row level security;
create policy "competencias_puesto_all_auth" on public.competencias_puesto
  for all to authenticated using (true) with check (true);

alter table public.instruccion_puesto enable row level security;
create policy "instruccion_puesto_all_auth" on public.instruccion_puesto
  for all to authenticated using (true) with check (true);

alter table public.indicadores_puesto enable row level security;
create policy "indicadores_puesto_all_auth" on public.indicadores_puesto
  for all to authenticated using (true) with check (true);
