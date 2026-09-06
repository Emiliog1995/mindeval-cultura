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
      // Se le pasa un Uint8Array, NO el Buffer de Node tal cual.
      //
      // Con un Buffer, el pdf.js que trae pdf-parse falla de forma
      // intermitente cuando en el mismo proceso ya se parseó otro PDF
      // distinto: revienta con "bad XRef entry" o "Illegal character" sobre
      // archivos que están perfectos. En serverless los procesos se reusan
      // entre peticiones, así que al segundo postulante que caía en el mismo
      // contenedor se le marcaba el CV como ilegible y quedaba fuera del
      // ranking (sin match ni idoneidad) con su PDF intacto. Se detectó con
      // 2 CVs de 77.
      //
      // Medido sobre los dos CVs que fallaban, alternándolos 12 veces en un
      // mismo proceso: Buffer crudo 7/12, Buffer copiado fuera del pool con
      // allocUnsafeSlow 7/12, Uint8Array 12/12. Lo que lo arregla es el tipo
      // que recibe pdf.js -- que es el que usa nativamente --, no dónde esté
      // alojada la memoria.
      //
      // El cast existe porque @types/pdf-parse declara Buffer, una firma más
      // estrecha que lo que la librería realmente acepta.
      const result = await pdfParse(new Uint8Array(buffer) as unknown as Buffer);
      return result.text;
    }
  } catch (e) {
    console.error("[extraerTextoCv] falló la extracción de", nombreArchivo, e);
    return "";
  }
  return "";
}
