-- Perfil del evaluado (estudiante / docente), elegido por el administrador al
-- agregarlo al proceso (USECIPOL). Es una etiqueta; NULL para el resto de
-- clientes, así que nada existente cambia.
alter table mindeval_candidatos
  add column if not exists perfil_evaluado text
  check (perfil_evaluado is null or perfil_evaluado in ('estudiante', 'docente'));
