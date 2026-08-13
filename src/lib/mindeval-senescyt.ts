import "server-only";

export interface TituloSenescyt {
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

export type ResultadoConsultaSenescyt =
  | { ok: true; estado: "registrado" | "sin_registro"; titulos: TituloSenescyt[] }
  | { ok: false; error: string; status: number };

/**
 * Consulta asistida a SENESCYT vía webservices.ec (proveedor externo de
 * pago, $0.10/consulta) — nunca reemplaza la confirmación del reclutador,
 * solo devuelve lo que el proveedor reporta. Compartida entre la consulta
 * individual (`/api/mindeval-verificar-senescyt`) y la masiva
 * (`/api/mindeval-verificar-senescyt-masivo`) para no duplicar el manejo de
 * cada código de estado del proveedor.
 */
export async function consultarSenescyt(cedula: string): Promise<ResultadoConsultaSenescyt> {
  if (!process.env.WEBSERVICES_EC_TOKEN) {
    return { ok: false, error: "WEBSERVICES_EC_TOKEN no configurada — usa la consulta manual mientras tanto", status: 400 };
  }
  if (!/^\d{10}$/.test(cedula)) {
    return { ok: false, error: "Cédula inválida (debe tener 10 dígitos)", status: 400 };
  }

  try {
    const resp = await fetch(`https://webservices.ec/api/senescyt/${cedula}`, {
      headers: {
        Authorization: `Bearer ${process.env.WEBSERVICES_EC_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (resp.status === 404) {
      return { ok: true, estado: "sin_registro", titulos: [] };
    }
    if (resp.status === 402) {
      return { ok: false, error: "Sin saldo en webservices.ec — recarga en webservices.ec o usa la consulta manual", status: 402 };
    }
    if (resp.status === 401) {
      return { ok: false, error: "Token de webservices.ec inválido o expirado — revisa WEBSERVICES_EC_TOKEN", status: 502 };
    }
    if (resp.status === 429) {
      return { ok: false, error: "El token de webservices.ec alcanzó su límite de consultas — usa la consulta manual", status: 429 };
    }
    if (!resp.ok) {
      // webservices.ec sí manda un motivo real en el cuerpo (ej. 503 con
      // {"data":{"error":"Problemas en el Servicio Público","codigo":503}}
      // cuando el propio sitio de SENESCYT está caído — verificado en vivo,
      // no es un problema de la cédula ni de este código). Se lo mostramos
      // al reclutador tal cual en vez de un mensaje genérico que sugiere
      // erróneamente que algo está mal con la consulta.
      let motivoProveedor: string | undefined;
      try {
        const body = await resp.json();
        motivoProveedor = (body as { data?: { error?: string } })?.data?.error;
      } catch {
        // el proveedor no siempre devuelve JSON en sus fallos (ej. 5xx crudos de su gateway)
      }
      return {
        ok: false,
        error: motivoProveedor
          ? `SENESCYT no respondió: "${motivoProveedor}" — es una falla del servicio del gobierno, no de la cédula. Intenta más tarde o usa la consulta manual.`
          : "El servicio de verificación no respondió correctamente — usa la consulta manual",
        status: 502,
      };
    }

    const body = await resp.json();
    const titulos = normalizarTitulos(body?.data);

    return { ok: true, estado: titulos.length > 0 ? "registrado" : "sin_registro", titulos };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al consultar SENESCYT";
    return { ok: false, error: msg, status: 500 };
  }
}
