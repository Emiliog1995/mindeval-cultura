-- Proctoring con grabación de cámara + audio para el portal del evaluado.
--
-- Contexto: un cliente (USECIPOL / Policía Nacional) exige por contrato que
-- las pruebas psicométricas se graben para revisión posterior. MindEval ya
-- tiene las alertas de navegador (AntiFraudeMonitor + mindeval_alertas); esto
-- agrega la grabación de video/audio y el perfil del evaluado.
--
-- TODO ES ADITIVO: solo agrega columnas y un bucket. No altera ni borra nada
-- existente, y las columnas son NULL por defecto, así que los otros clientes y
-- las sesiones actuales siguen igual (la grabación se activa solo cuando la
-- vacante pertenece a la empresa configurada para proctoring).

-- 1. Dónde queda el video de cada sesión (ruta dentro del bucket privado).
alter table mindeval_sesiones_prueba
  add column if not exists grabacion_path text;

-- 2. Perfil del evaluado para esta sesión: 'estudiante' | 'docente' | NULL.
--    Resuelve el defecto detectado en la plataforma original, donde el informe
--    mezclaba dos perfiles de puesto. El baremo/criterio por perfil se define
--    aparte; esta columna solo etiqueta la sesión.
alter table mindeval_sesiones_prueba
  add column if not exists perfil_evaluado text
  check (perfil_evaluado is null or perfil_evaluado in ('estudiante', 'docente'));

-- 3. Bucket privado para las grabaciones (mismo patrón que mindeval-cvs).
--    Privado y SIN políticas abiertas: el navegador del evaluado NO sube
--    directo con permiso anónimo (eso dejaría subir basura a cualquiera).
--    En su lugar, el backend valida el token de la prueba y emite una URL de
--    subida firmada para una ruta concreta; el navegador sube a esa URL. La
--    lectura (para que el cliente revise el video) también va por URL firmada
--    emitida por el backend. Todo pasa por el service-role, así que este bucket
--    no necesita ninguna policy de storage.objects.
insert into storage.buckets (id, name, public)
values ('mindeval-grabaciones', 'mindeval-grabaciones', false)
on conflict (id) do nothing;
