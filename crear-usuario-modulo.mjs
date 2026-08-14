// Crea (o actualiza) un usuario del ecosistema MINDTALENT, opcionalmente
// restringido a un solo módulo (ej. Selección).
//
// Requisito previo: haber corrido supabase/permisos-por-modulo-seguridad.sql
// en el SQL Editor de Supabase al menos una vez (crea la columna
// modulos_permitidos y las policies por módulo).
//
// Uso:
//   node crear-usuario-modulo.mjs <email> <password> [modulo]
//
// Módulos válidos: seleccion, clima, evaluacion_360, nomina, manual_puestos,
// cultura_docs, admin. Si se omite, la cuenta queda con acceso a todos los
// módulos (mismo comportamiento que una cuenta de consultor normal).
//
// Ejemplo (reclutador que solo debe ver Selección):
//   node crear-usuario-modulo.mjs reclutador@empresa.com "unaClaveSegura123" seleccion
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const MODULOS_VALIDOS = ["seleccion", "clima", "evaluacion_360", "nomina", "manual_puestos", "cultura_docs", "admin"];

const [, , email, password, modulo] = process.argv;

if (!email || !password) {
  console.error("Uso: node crear-usuario-modulo.mjs <email> <password> [modulo]");
  console.error(`Módulos válidos: ${MODULOS_VALIDOS.join(", ")}`);
  process.exit(1);
}
if (modulo && !MODULOS_VALIDOS.includes(modulo)) {
  console.error(`Módulo inválido: "${modulo}". Válidos: ${MODULOS_VALIDOS.join(", ")}`);
  process.exit(1);
}
if (password.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (userError) {
  console.error("ERROR creando usuario en Auth:", userError.message);
  process.exit(1);
}
console.log("Usuario creado en Auth:", userData.user.id, userData.user.email);

const { error: allowlistError } = await supabaseAdmin
  .from("usuarios_autorizados")
  .upsert(
    { email, activo: true, modulos_permitidos: modulo ? [modulo] : null },
    { onConflict: "email" }
  );
if (allowlistError) {
  console.error("ERROR agregando a usuarios_autorizados:", allowlistError.message);
  console.error("El usuario ya existe en Auth pero no puede iniciar sesión hasta que se corrija esto.");
  process.exit(1);
}

console.log(
  modulo
    ? `Acceso restringido al módulo "${modulo}" únicamente.`
    : "Acceso a todos los módulos (sin restricción)."
);
