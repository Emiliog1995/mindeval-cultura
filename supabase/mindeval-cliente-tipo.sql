-- Tipo de cliente: 'empresa' (default) o 'institucion'.
--
-- Para clientes públicos como USECIPOL (Policía Nacional) la palabra "empresa"
-- confunde. Este tipo permite que la interfaz muestre "Institución <nombre>"
-- en todo lo que ven esos usuarios, sin afectar a los clientes empresa.
--
-- ADITIVO: solo agrega una columna con default. Nada existente cambia.

alter table empresas_mdt
  add column if not exists tipo text
  not null default 'empresa'
  check (tipo in ('empresa', 'institucion'));

update empresas_mdt
  set tipo = 'institucion'
  where nombre = 'USECIPOL';
