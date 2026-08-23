import "server-only";
import mammoth from "mammoth";
import type PdfParseFn from "pdf-parse";

// Se importa el archivo interno en vez del punto de entrada del paquete --
// index.js de pdf-parse@1.1.1 trae un bloque de auto-test (`if
// (!module.parent)`) que se dispara al empaquetarse con webpack
// (module.parent se comporta distinto ahí) y busca un PDF de prueba que no
// existe en este proyecto, rompiendo el build de producción. lib/pdf-parse.js
// es la función real, sin ese wrapper -- mismo tipo que el paquete, vía
// @types/pdf-parse (solo se usa para tipar, nunca se ejecuta index.js).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as typeof PdfParseFn;

/**
 * Extrae texto de un CV en PDF o DOCX. Compartido entre la postulación
 * pública (/api/mindeval-postular) y el reintento de extracción
 * (/api/mindeval-reextraer-cv) para no duplicar la lógica de parsing.
 * Best-effort por diseño: un formato no soportado o un PDF sin capa de
 * texto (ej. escaneado) devuelve cadena vacía en vez de lanzar, para que
 * quien llama decida cómo avisar al reclutador.
 */
export async function extraerTextoCv(buffer: Buffer, nombreArchivo: string): Promise<string> {
  const nombre = nombreArchivo.toLowerCase();
  try {
    if (nombre.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    if (nombre.endsWith(".pdf")) {
      const result = await pdfParse(buffer);
      return result.text;
    }
  } catch (e) {
    console.error("[extraerTextoCv] falló la extracción de", nombreArchivo, e);
    return "";
  }
  return "";
}
