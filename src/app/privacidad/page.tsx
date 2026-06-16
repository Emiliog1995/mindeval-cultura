import Link from 'next/link';

export default function Privacidad() {
  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      <header style={{ background: "#0A1A32" }} className="py-4 px-6 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span style={{ color: "#10b981" }} className="text-xl font-bold tracking-wide">MINDTALENT</span>
          <Link href="/" className="text-white text-sm opacity-70 hover:opacity-100">← Volver al inicio</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow p-8 space-y-6 text-sm text-gray-700 leading-relaxed">

          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "#0A1A32" }}>Aviso de Privacidad</h1>
            <p className="text-xs text-gray-400">Última actualización: junio 2025</p>
          </div>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "#0A1A32" }}>1. Responsable del tratamiento</h2>
            <p>
              <strong>MINDTALENT</strong> — gerencia@mindtalentrh.com — es el responsable del tratamiento de los datos personales recopilados a través de esta plataforma, de conformidad con la <strong>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong> de la República del Ecuador.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "#0A1A32" }}>2. Datos que recopilamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Cuestionario de Cultura Organizacional (DOCS):</strong> nombre completo, cargo, área y empresa. Estos datos son necesarios para identificar su participación y generar el informe individual.</li>
              <li><strong>Encuesta de Clima Laboral:</strong> únicamente sus respuestas al cuestionario. No se recopila ningún dato de identificación personal. La encuesta es completamente anónima.</li>
              <li><strong>Levantamiento de información de puestos (Manual MDT):</strong> nombre completo, cargo, área, estructura jerárquica, descripción de actividades, herramientas, conocimientos, nivel educativo y años de experiencia. Estos datos se usan exclusivamente para elaborar el descriptor del puesto de trabajo.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "#0A1A32" }}>3. Finalidad del tratamiento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Generar diagnósticos individuales y organizacionales de cultura y clima laboral.</li>
              <li>Elaborar informes de consultoría para la empresa contratante del servicio.</li>
              <li>Construir descriptores de puestos de trabajo (Manual MDT) basados en la información proporcionada por el ocupante del cargo.</li>
              <li>Mejorar los instrumentos y metodologías de diagnóstico organizacional.</li>
            </ul>
            <p>Sus respuestas de cultura y clima se reportan <strong>únicamente de forma grupal por área</strong>. Su nombre nunca aparecerá vinculado a sus respuestas individuales en los informes organizacionales. La información de puestos es accesible solo para el área de Talento Humano y el consultor asignado.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "#0A1A32" }}>4. Base legal</h2>
            <p>El tratamiento se realiza con base en su <strong>consentimiento expreso</strong>, otorgado al aceptar este aviso antes de completar el cuestionario (Art. 7 LOPDP), y en el <strong>cumplimiento de una relación contractual</strong> entre MINDTALENT y la empresa que contrató el servicio de diagnóstico.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "#0A1A32" }}>5. Conservación de los datos</h2>
            <p>Los datos se conservan durante el período de vigencia del contrato de consultoría y hasta <strong>2 años adicionales</strong> una vez concluido el servicio, salvo que usted solicite su eliminación antes.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "#0A1A32" }}>6. Transferencia internacional</h2>
            <p>Los datos son almacenados en servidores de <strong>Supabase</strong> y <strong>Vercel</strong>, proveedores de infraestructura en la nube con servidores ubicados fuera del Ecuador. Ambos proveedores cuentan con estándares de seguridad y cumplimiento internacionales (SOC 2, ISO 27001). Esta transferencia se realiza bajo las garantías adecuadas previstas en la LOPDP.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "#0A1A32" }}>7. Sus derechos (ARCO)</h2>
            <p>De conformidad con la LOPDP, usted tiene derecho a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Acceso:</strong> conocer qué datos suyos tenemos almacenados.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong>Cancelación:</strong> solicitar la eliminación de sus datos.</li>
              <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos para determinadas finalidades.</li>
            </ul>
            <p>Para ejercer cualquiera de estos derechos, contáctenos en: <strong>gerencia@mindtalentrh.com</strong>. Responderemos en un plazo máximo de <strong>15 días hábiles</strong>.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "#0A1A32" }}>8. Seguridad</h2>
            <p>Implementamos medidas técnicas y organizativas para proteger sus datos contra accesos no autorizados, pérdida o divulgación, incluyendo cifrado en tránsito (HTTPS) y control de acceso al panel de consultor.</p>
          </section>

          <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "#f8f6f0", borderLeft: "3px solid #10b981", color: "#0A1A32" }}>
            Para cualquier consulta sobre el tratamiento de sus datos personales: <strong>gerencia@mindtalentrh.com</strong>
          </div>
        </div>
      </main>
    </div>
  );
}
