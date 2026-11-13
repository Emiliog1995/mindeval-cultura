-- Roles de usuario para la gestión de accesos (requisito USECIPOL).
--
-- La plataforma necesita que un administrador cree usuarios con su clave y que
-- cada uno entre como 'administrador' o 'evaluador'. El dueño (MINDTALENT) es
-- 'super_admin'. Hasta ahora usuarios_autorizados solo tenía email + activo +
-- empresa_id + modulos_permitidos; esto agrega el rol y el nombre a mostrar.
--
-- ADITIVO: solo agrega columnas. Las cuentas existentes siguen funcionando
-- igual (rol NULL se trata como la cuenta de staff/consultor de siempre).

alter table usuarios_autorizados
  add column if not exists rol text
  check (rol is null or rol in ('super_admin', 'administrador', 'evaluador'));

alter table usuarios_autorizados
  add column if not exists nombre text;

-- El dueño queda como super_admin (ve todo, todas las empresas).
update usuarios_autorizados
  set rol = 'super_admin'
  where email = 'gerencia@mindtalentrh.com' and rol is null;

-- La cuenta del Cptn. Reyes (USECIPOL) queda como administrador de su
-- institución: puede crear usuarios de USECIPOL y gestionar procesos.
update usuarios_autorizados
  set rol = 'administrador', nombre = 'Cptn. Reyes Chancusig James Scott'
  where email = 'scottfly19@hotmail.com';
