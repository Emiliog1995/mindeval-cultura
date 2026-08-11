-- Ejecutar en Supabase SQL Editor DESPUÉS de mindeval-seleccion-etapa3.sql
-- MINDEVAL SELECCIÓN — Etapa 4: banco de preguntas técnicas (objetivo)
--
-- Sustituye, solo cuando el reclutador lo activa por vacante, el caso
-- práctico abierto (calificado subjetivamente por IA) por un banco de
-- preguntas de opción múltiple con respuesta correcta predefinida —
-- preguntas generadas por IA a partir del Manual de Puestos y/o escritas a
-- mano por el reclutador, conviviendo en el mismo banco. El modo por
-- defecto sigue siendo el caso abierto: nada de lo ya agendado/calificado
-- cambia de comportamiento hasta que alguien active el banco en una vacante.

create table if not exists mindeval_banco_preguntas (
  id                 uuid primary key default gen_random_uuid(),
  vacante_id         uuid not null references mindeval_vacantes(id) on delete cascade,
  enunciado          text not null,
  opciones           jsonb not null,        -- [{ "id": "a", "texto": "..." }, ...]
  respuesta_correcta text not null,         -- coincide con opciones[].id
  puntos             numeric not null default 10,
  origen             text not null default 'manual' check (origen in ('ia','manual')),
  estado             text not null default 'borrador' check (estado in ('borrador','activa')),
  orden              int not null default 0,
  created_at         timestamptz default now()
);

create index if not exists mindeval_banco_preguntas_vacante_idx on mindeval_banco_preguntas(vacante_id);

alter table mindeval_banco_preguntas enable row level security;
create policy "mindeval_banco_preguntas_all_auth" on mindeval_banco_preguntas
  for all to authenticated using (true) with check (true);
-- sin policy anon: el portal público del candidato usa supabaseAdmin
-- (service_role), igual que el resto de /api/mindeval-prueba/[token].

alter table mindeval_vacantes
  add column if not exists modo_tecnica text not null default 'caso_abierto'
    check (modo_tecnica in ('caso_abierto','banco'));

-- El caso abierto deja de ser obligatorio: el modo banco no genera caso_generado.
alter table mindeval_pruebas_tecnicas alter column caso_generado drop not null;

alter table mindeval_pruebas_tecnicas add column if not exists modo text not null default 'caso_abierto'
  check (modo in ('caso_abierto','banco'));

-- Copia server-side de las preguntas activas asignadas a este intento, CON
-- respuesta_correcta y puntos (nunca se envía completa al candidato — el
-- GET del token le quita respuesta_correcta antes de responder). Congela
-- el examen aunque el reclutador edite el banco después de agendarlo.
alter table mindeval_pruebas_tecnicas add column if not exists preguntas_snapshot jsonb;

-- Bitácora auditable tras corregir:
-- [{ pregunta_id, opcion_elegida, respuesta_correcta, correcta, puntos_obtenidos }]
alter table mindeval_pruebas_tecnicas add column if not exists respuestas_banco jsonb;

alter table mindeval_pruebas_tecnicas add column if not exists puntaje_objetivo numeric;

-- Postgres no permite ALTER sobre la expresión de una columna GENERATED,
-- solo borrar y recrear; es STORED así que se recalcula al instante desde
-- columnas ya existentes, sin pérdida de datos. Las filas en modo
-- caso_abierto quedan idénticas (mismo cálculo de siempre).
alter table mindeval_pruebas_tecnicas drop column puntaje_total;
alter table mindeval_pruebas_tecnicas add column puntaje_total numeric generated always as (
  case
    when modo = 'banco' then coalesce(puntaje_objetivo, 0)
    else coalesce(puntaje_analisis,0) + coalesce(puntaje_estrategia,0) + coalesce(puntaje_kpis,0) + coalesce(puntaje_claridad,0)
  end
) stored;
