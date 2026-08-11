-- Ejecutar en Supabase SQL Editor DESPUÉS de mindeval-seleccion-etapa4.sql
-- MINDEVAL SELECCIÓN — Etapa 5: banco de ejercicios de Assessment Center
--
-- Añade, sin reemplazar nada, un banco de escenarios abiertos generados por
-- IA y/o escritos a mano por el reclutador para la Etapa 6 (Assessment
-- Center). El registro manual directo en mindeval_assessment_evaluaciones
-- sigue funcionando exactamente igual que hoy, sin condición alguna — el
-- banco simplemente habilita, además, poder agendar una sesión de
-- assessment al candidato (mismo patrón de agenda + token + portal público
-- que psicométrica/técnica), calificada automáticamente por IA contra la
-- rúbrica de cada ejercicio y escrita como filas nuevas en la MISMA tabla
-- mindeval_assessment_evaluaciones (evaluador = 'ia').

create table if not exists mindeval_banco_ejercicios (
  id                   uuid primary key default gen_random_uuid(),
  vacante_id           uuid not null references mindeval_vacantes(id) on delete cascade,
  competencia          text not null,          -- ej. "Manejo de conflicto", "Orientación al servicio"
  enunciado            text not null,          -- escenario abierto que lee el candidato
  criterios_evaluacion text not null,          -- rúbrica en texto libre para la IA calificadora — NUNCA se envía al candidato
  origen               text not null default 'manual' check (origen in ('ia','manual')),
  estado               text not null default 'borrador' check (estado in ('borrador','activa')),
  orden                int not null default 0,
  created_at           timestamptz default now()
);

create index if not exists mindeval_banco_ejercicios_vacante_idx on mindeval_banco_ejercicios(vacante_id);

alter table mindeval_banco_ejercicios enable row level security;
create policy "mindeval_banco_ejercicios_all_auth" on mindeval_banco_ejercicios
  for all to authenticated using (true) with check (true);
-- sin policy anon: el portal público usa supabaseAdmin, igual que el banco técnico.

-- Habilita "assessment" como tercer tipo de sesión agendable (mismo patrón
-- de agenda + token que psicométrica/técnica).
alter table mindeval_sesiones_prueba drop constraint if exists mindeval_sesiones_prueba_tipo_check;
alter table mindeval_sesiones_prueba add constraint mindeval_sesiones_prueba_tipo_check
  check (tipo in ('psicometrica','tecnica','assessment'));

-- Copia server-side de los ejercicios activos asignados a esta sesión —
-- congela el assessment aunque el reclutador edite el banco después de
-- agendarlo (mismo motivo que preguntas_snapshot en mindeval_pruebas_tecnicas).
alter table mindeval_sesiones_prueba add column if not exists ejercicios_snapshot jsonb;

-- Traza qué sesión produjo cada fila calificada por IA — mindeval_assessment_evaluaciones
-- es un log plano (a diferencia de mindeval_pruebas_tecnicas, una fila por intento),
-- así que sin esto no hay forma de distinguir "estas filas vinieron de la sesión X"
-- de "el reclutador las escribió a mano el martes pasado" más allá de mirar
-- evaluador='ia' y las fechas. Nullable — las filas manuales existentes y futuras
-- simplemente quedan en null para siempre, que es lo correcto.
alter table mindeval_assessment_evaluaciones add column if not exists sesion_id uuid references mindeval_sesiones_prueba(id) on delete set null;
