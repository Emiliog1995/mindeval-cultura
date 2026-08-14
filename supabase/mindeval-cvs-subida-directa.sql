-- MINDEVAL SELECCIÓN -- subida directa de CV a Storage (bypass límite 4.5MB de Vercel)
-- Ejecutar en Supabase -> SQL Editor (proyecto mindeval-cultura)
-- Idempotente.
--
-- Por qué: las funciones serverless de Vercel tienen un límite duro de
-- 4.5MB por request (no configurable desde el código). Un CV escaneado con
-- la cámara del celular lo supera fácil (5-15MB típico), mientras que el
-- mismo CV exportado desde Word pesa unos cientos de KB -- por eso el bug
-- se veía solo en celular y no en las pruebas de escritorio. La postulación
-- pública ahora sube el archivo directo al bucket con una URL firmada
-- (createSignedUploadUrl/uploadToSignedUrl) en vez de mandarlo dentro del
-- POST a /api/mindeval-postular. Eso NO requiere cambiar RLS -- el token
-- firmado es la autorización, no pasa por las policies de storage.objects
-- (la policy "mindeval_cvs_service_role_all" de
-- mindeval-seleccion-etapa2.sql se queda intacta, el bucket sigue tan
-- privado como antes).
--
-- Este script solo pone un límite a nivel de bucket para que un archivo
-- absurdamente grande o de un tipo no esperado nunca llegue a
-- extraerTextoCv() ni ocupe espacio de storage sin sentido.
UPDATE storage.buckets
SET file_size_limit = 20971520, -- 20 MB
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
WHERE id = 'mindeval-cvs';
