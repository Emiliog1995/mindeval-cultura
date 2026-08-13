import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

interface TituloSenescyt {
  institucion: string;
  titulo: string;
  tipo: string;
  registro: string;
  fecha_registro: string;
}

// La respuesta real de webservices.ec no coincide con el ejemplo de su
// documentación pública (esa mostraba `data.titulos` con claves en
// minúscula sin tildes) — la real anida los títulos por nivel dentro de
// `data.TITULOS_REGISTRADOS` (ej. `TITULS_3ER_NVL_GRD` para tercer nivel),
// cada uno con claves en español con tildes. Aplanamos todos los niveles
// que vengan (no asumimos que solo existe tercer nivel) y normalizamos.
interface TituloSenescytRaw {
  "Título"?: string;
  "Institución_de_Educación_Superior"?: string;
  "Tipo"?: string;
  "Número_de_Registro"?: string;
  "Fecha_de_Registro"?: string;
}

function normalizarTitulos(data: unknown): TituloSenescyt[] {
  const titulosRegistrados = (data as { TITULOS_REGISTRADOS?: Record<string, TituloSenescytRaw[]> })?.TITULOS_REGISTRADOS ?? {};
  const crudos = Object.values(titulosRegistrados).flat();
  return crudos.map((t) => ({
    institucion: t["Institución_de_Educación_Superior"] ?? "",
    titulo: t["Título"] ?? "",
    tipo: t["Tipo"] ?? "",
    registro: t["Número_de_Registro"] ?? "",
    fecha_registro: t["Fecha_de_Registro"] ?? "",
  }));
}

/**
 * Consulta asistida a SENESCYT vía webservices.ec (proveedor externo de
 * pago, $0.10/consulta) — nunca reemplaza la confirmación del reclutador:
 * esta ruta solo devuelve lo que el proveedor reporta, el reclutador sigue
 * siendo quien guarda la verificación desde la pantalla de Etapa 3. Si el
 * proveedor falla o no hay saldo, el flujo manual (link oficial de
 * SENESCYT) sigue disponible como siempre.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { permitido } = checkRateLimit(req, "mindeval-verificar-senescyt");
  if (!permitido) return rateLimitResponse();

  if (!process.env.WEBSERVICES_EC_TOKEN) {
    return NextResponse.json(
      { error: "WEBSERVICES_EC_TOKEN no configurada — usa la consulta manual mientras tanto" },
      { status: 400 }
    );
  }

  try {
    const { cedula }: { cedula: string } = await req.json();
    if (!cedula || !/^\d{10}$/.test(cedula)) {
      return NextResponse.json({ error: "Cédula inválida (debe tener 10 dígitos)" }, { status: 400 });
    }

    const resp = await fetch(`https://webservices.ec/api/senescyt/${cedula}`, {
      headers: {
        Authorization: `Bearer ${process.env.WEBSERVICES_EC_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (resp.status === 404) {
      return NextResponse.json({ estado: "sin_registro", titulos: [] });
    }
    if (resp.status === 402) {
      return NextResponse.json(
        { error: "Sin saldo en webservices.ec — recarga en webservices.ec o usa la consulta manual" },
        { status: 402 }
      );
    }
    if (resp.status === 401) {
      return NextResponse.json(
        { error: "Token de webservices.ec inválido o expirado — revisa WEBSERVICES_EC_TOKEN" },
        { status: 502 }
      );
    }
    if (resp.status === 429) {
      return NextResponse.json(
        { error: "El token de webservices.ec alcanzó su límite de consultas — usa la consulta manual" },
        { status: 429 }
      );
    }
    if (!resp.ok) {
      return NextResponse.json(
        { error: "El servicio de verificación no respondió correctamente — usa la consulta manual" },
        { status: 502 }
      );
    }

    const body = await resp.json();
    const titulos = normalizarTitulos(body?.data);

    return NextResponse.json({
      estado: titulos.length > 0 ? "registrado" : "sin_registro",
      titulos,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al consultar SENESCYT";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
