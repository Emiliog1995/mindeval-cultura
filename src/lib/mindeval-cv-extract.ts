import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

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
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      return result.text;
    }
  } catch (e) {
    console.error("[extraerTextoCv] falló la extracción de", nombreArchivo, e);
    return "";
  }
  return "";
}
