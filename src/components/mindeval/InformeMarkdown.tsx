import { parseInformeMarkdown, type SegmentoTexto } from "@/lib/mindeval-informe-markdown";

const NAVY = "#1B2A5B";

function renderSegmentos(segmentos: SegmentoTexto[]) {
  return segmentos.map((s, i) => (s.negrita ? <strong key={i}>{s.texto}</strong> : <span key={i}>{s.texto}</span>));
}

/**
 * Muestra en pantalla el mismo texto que descarga exportarInformeCandidatoPDF
 * (mindeval-informe-ejecutivo devuelve el subconjunto de Markdown que
 * entiende parseInformeMarkdown: #, ##, **negrita**, ---) con formato real,
 * en vez de los símbolos crudos -- antes esto se mostraba con
 * whiteSpace: "pre-wrap" sobre el texto tal cual, así que el reclutador
 * veía los ** y los # en pantalla antes incluso de descargar el PDF.
 */
export default function InformeMarkdown({ texto }: { texto: string }) {
  const bloques = parseInformeMarkdown(texto);
  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#33405F" }}>
      {bloques.map((bloque, i) => {
        if (bloque.tipo === "hr") {
          return <hr key={i} style={{ border: "none", borderTop: "1px solid #E3E8F2", margin: "14px 0" }} />;
        }
        if (bloque.tipo === "h1") {
          return (
            <h3 key={i} style={{ color: NAVY, fontSize: 15.5, fontWeight: 800, margin: "10px 0 6px" }}>
              {renderSegmentos(bloque.segmentos)}
            </h3>
          );
        }
        if (bloque.tipo === "h2") {
          return (
            <h4 key={i} style={{ color: NAVY, fontSize: 14, fontWeight: 700, margin: "12px 0 4px" }}>
              {renderSegmentos(bloque.segmentos)}
            </h4>
          );
        }
        if (bloque.tipo === "bullet") {
          return (
            <div key={i} style={{ display: "flex", gap: 8, margin: "2px 0" }}>
              <span>•</span>
              <span>{renderSegmentos(bloque.segmentos)}</span>
            </div>
          );
        }
        return (
          <p key={i} style={{ margin: "6px 0" }}>
            {renderSegmentos(bloque.segmentos)}
          </p>
        );
      })}
    </div>
  );
}
