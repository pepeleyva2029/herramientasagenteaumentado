import OpenAI from "openai";
import { verifyRequestOrigin } from "@netlify/identity";
import { getAuthenticatedUser } from "./_lib/auth.mjs";
import { json, errorResponse } from "./_lib/http.mjs";
import { quoteJsonSchema, applyBusinessDefaults } from "./_lib/quote-schema.mjs";

const MAX_BYTES = 4 * 1024 * 1024;

export default async (request) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return json({ ok: false, error: "Inicia sesión para analizar cotizaciones." }, 401);

    verifyRequestOrigin(request);

    if (request.method !== "POST") {
      return json({ ok: false, error: "Método no permitido." }, 405);
    }

    if (!process.env.OPENAI_API_KEY) {
      return json(
        {
          ok: false,
          error: "Falta configurar OPENAI_API_KEY. Puedes usar el ejemplo MAPFRE para probar el panel.",
        },
        503,
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json(
        {
          ok: false,
          error: "La solicitud debe enviarse como application/json. Recarga el panel e inténtalo nuevamente.",
        },
        400,
      );
    }

    const body = await request.json();
    const filename = String(body.filename || "cotizacion.pdf").slice(0, 120);
    const mimeType = String(body.mimeType || "application/pdf");

    if (mimeType !== "application/pdf" || !filename.toLowerCase().endsWith(".pdf")) {
      return json({ ok: false, error: "El archivo debe ser un PDF." }, 400);
    }

    const base64 = String(body.dataBase64 || "").replace(
      /^data:application\/pdf;base64,/,
      "",
    );

    if (!base64) {
      return json({ ok: false, error: "No se recibió el PDF." }, 400);
    }

    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length || buffer.length > MAX_BYTES) {
      return json(
        { ok: false, error: "Para este MVP el PDF debe pesar menos de 4 MB." },
        413,
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Se envía el PDF directamente a Responses API como base64.
    // Así evitamos crear un archivo temporal en Files API.
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `Eres un analista de cotizaciones de seguros de vida en México. Extrae datos exactos del PDF sin inventar cifras. La salida alimentará una herramienta que un prospecto verá, por lo que debes separar datos confirmados de supuestos.\n\nReglas:\n1. Detecta MAPFRE, Seguros Atlas, MetLife u otra aseguradora.\n2. Conserva las cantidades en la moneda/unidad original: UDI, MXN o USD. No conviertas a pesos.\n3. Si existe tabla anual, extrae todos los años disponibles en annualPremiums.\n4. En milestones prioriza años 3, 6, 9, 12, 15 y el último año, usando rescate y seguro saldado exactos.\n5. Para coberturas, redacta explicaciones muy breves y claras, sin ampliar lo que diga el documento.\n6. Para MAPFRE: BIT suele significar exención de pago de primas por invalidez total y permanente; BIPA, pago adicional por invalidez; MA, muerte accidental. Confirma que estén amparadas antes de marcarlas.\n7. Usa null cuando el dato no exista o no sea legible.\n8. Incluye advertencias específicas en extraction.warnings y asigna confidence entre 0 y 1.\n9. No incluyas datos sensibles que no sean necesarios para explicar la cotización.`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extrae y estructura esta cotización. Los datos del asesor deben quedar como Pepe Leyva, Especialista en Planes de Vida, WhatsApp 5588048778 y CTA Mándame WHA. Usa 4.5% como proyección anual únicamente si el PDF no indica otra y deja baseUnitValue en null si no aparece.",
            },
            {
              type: "input_file",
              filename,
              // OpenAI requiere un Data URL completo, no solo el texto Base64.
              file_data: `data:application/pdf;base64,${base64}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "insurance_quote",
          strict: true,
          schema: quoteJsonSchema,
        },
      },
    });

    if (!response.output_text) {
      throw new Error("La IA no devolvió datos estructurados.");
    }

    const extracted = applyBusinessDefaults(JSON.parse(response.output_text));

    return json({
      ok: true,
      data: extracted,
      pdfStored: false,
      processingMethod: "inline_pdf_data_url",
    });
  } catch (error) {
    console.error("parse-quote error", {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      requestId: error?.request_id,
    });

    return errorResponse(
      error,
      "No fue posible leer la cotización. Revisa el PDF e inténtalo de nuevo.",
    );
  }
};
