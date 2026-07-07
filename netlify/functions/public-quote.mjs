import { json, errorResponse } from "./_lib/http.mjs";
import { getQuoteRecord } from "./_lib/store.mjs";

export default async (request) => {
  try {
    const url = new URL(request.url);
    const slug = String(url.searchParams.get("slug") || "").trim();
    if (!slug) return json({ ok: false, error: "Falta la dirección de la cotización." }, 400);
    const record = await getQuoteRecord(slug);
    if (!record || record.status !== "published") {
      return json({ ok: false, error: "Esta cotización no está publicada o no existe." }, 404);
    }
    return json({ ok: true, slug: record.slug, version: record.version, updatedAt: record.updatedAt, data: record.data }, 200, {
      "cache-control": "public, max-age=60, s-maxage=60"
    });
  } catch (error) {
    return errorResponse(error, "No fue posible abrir la cotización.");
  }
};
