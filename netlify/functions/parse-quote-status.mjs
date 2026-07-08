import OpenAI from "openai";
import { getAuthenticatedUser } from "./_lib/auth.mjs";
import { json, errorResponse } from "./_lib/http.mjs";
import { applyBusinessDefaults } from "./_lib/quote-schema.mjs";

const TERMINAL_FAILURES = new Set(["failed", "cancelled", "incomplete"]);

export default async (request) => {
  let responseId = "";
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return json({ ok: false, error: "Inicia sesión para consultar el análisis." }, 401);

    if (request.method !== "GET") {
      return json({ ok: false, error: "Método no permitido." }, 405);
    }

    if (!process.env.OPENAI_API_KEY) {
      return json({ ok: false, error: "Falta configurar OPENAI_API_KEY." }, 503);
    }

    const url = new URL(request.url);
    responseId = String(url.searchParams.get("id") || "");
    if (!/^resp_[A-Za-z0-9_-]+$/.test(responseId)) {
      return json({ ok: false, error: "Identificador de análisis inválido." }, 400);
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.retrieve(responseId);

    if (response.status === "queued" || response.status === "in_progress") {
      return json({ ok: true, done: false, status: response.status });
    }

    if (TERMINAL_FAILURES.has(response.status)) {
      await deleteResponse(responseId);
      const detail = response.error?.message || response.incomplete_details?.reason || "El análisis no pudo completarse.";
      return json({ ok: false, done: true, status: response.status, error: detail }, 502);
    }

    if (response.status !== "completed" || !response.output_text) {
      return json({ ok: true, done: false, status: response.status || "in_progress" });
    }

    let extracted;
    try {
      extracted = applyBusinessDefaults(JSON.parse(response.output_text));
    } catch (parseError) {
      console.error("Structured output parse error", parseError, response.output_text?.slice(0, 500));
      await deleteResponse(responseId);
      return json({ ok: false, done: true, error: "La IA terminó, pero devolvió un formato inesperado. Intenta nuevamente." }, 502);
    }

    await deleteResponse(responseId);

    return json({
      ok: true,
      done: true,
      status: "completed",
      data: extracted,
      pdfStoredInNetlify: false,
      openAiResponseDeleted: true,
    });
  } catch (error) {
    console.error("parse-quote status error", {
      responseId,
      name: error?.name,
      message: error?.message,
      status: error?.status,
      requestId: error?.request_id,
    });
    return errorResponse(error, "No fue posible consultar el avance del análisis.");
  }
};

async function deleteResponse(responseId) {
  try {
    const result = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!result.ok && result.status !== 404) {
      console.warn("No fue posible eliminar la respuesta temporal de OpenAI", result.status);
    }
  } catch (error) {
    console.warn("Error al eliminar la respuesta temporal de OpenAI", error?.message || error);
  }
}
