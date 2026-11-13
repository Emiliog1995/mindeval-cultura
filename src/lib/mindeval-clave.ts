import "server-only";
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

// Sin 0/O/1/I/l: la clave se lee en un correo y se teclea a mano.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const MAX_INTENTOS_CLAVE = 5;

/** Contraseña temporal de 8 caracteres, criptográficamente aleatoria. */
export function generarClaveTemporal(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

export function hashClave(clave: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(clave.trim().toUpperCase(), salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verificarClave(clave: string, almacenada: string): boolean {
  const [saltHex, hashHex] = almacenada.split(":");
  if (!saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = scryptSync(clave.trim().toUpperCase(), Buffer.from(saltHex, "hex"), esperado.length);
  return timingSafeEqual(esperado, calculado);
}
