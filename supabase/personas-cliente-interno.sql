-- Cliente interno de cada colaborador (Fundación Unbound y cualquier otro cliente).
--
-- La organización define, por persona, quién es su cliente interno: el rol al que
-- le entrega su trabajo y que por lo tanto puede calificar la calidad de ese
-- servicio. Es la 5a fuente del 360° (peso 10%).
--
-- Se guarda como referencia a otra persona y no como texto libre para que el
-- módulo pueda resolver solo a qué correo mandar ese enlace.
--
-- Aditivo: columna nullable, no toca ninguna fila existente.

alter table personas
  add column if not exists cliente_interno_persona_id uuid references personas(id);

comment on column personas.cliente_interno_persona_id is
  'Persona que actúa como cliente interno de esta persona (fuente cliente_interno del 360°).';

create index if not exists idx_personas_cliente_interno
  on personas(cliente_interno_persona_id);
