import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { json, errorResponse, makeSlug, sanitizeSlug } from "./_lib/http.mjs";
import { getQuoteRecord, listQuoteRecords, setQuoteRecord } from "./_lib/store.mjs";
import { applyBusinessDefaults } from "./_lib/quote-schema.mjs";

export default async (request) => {
  try {
    const user = await getUser();
    if (!user) return json({ ok: false, error: "No autorizado." }, 401);

    const url = new URL(request.url);
    if (request.method === "GET") {
      const slug = url.searchParams.get("slug");
      if (slug) {
        const record = await getQuoteRecord(slug);
        if (!record) return json({ ok: false, error: "Cotización no encontrada." }, 404);
        return json({ ok: true, record });
      }
      const records = await listQuoteRecords();
      const items = records
        .map((record) => ({
          slug: record.slug,
          status: record.status,
          version: record.version,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          prospectName: record.data?.prospect?.name || "Sin nombre",
          insurer: record.data?.quote?.insurer || "Sin aseguradora",
          product: record.data?.quote?.product || "Sin producto"
        }))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return json({ ok: true, items });
    }

    if (request.method === "POST") {
      verifyRequestOrigin(request);
      const body = await request.json();
      const requestedSlug = sanitizeSlug(body.slug || "");
      const existingSlug = String(body.existingSlug || "").trim();
      const slug = existingSlug || requestedSlug || makeSlug();
      if (!/^[A-Za-z0-9-]{4,48}$/.test(slug)) {
        return json({ ok: false, error: "La dirección debe tener entre 4 y 48 caracteres, usando letras, números o guiones." }, 400);
      }

      const status = body.status === "published" ? "published" : "draft";
      const data = applyBusinessDefaults(body.data || {});
      const now = new Date().toISOString();
      const existing = await getQuoteRecord(slug);
      const previousVersions = Array.isArray(existing?.versions) ? existing.versions : [];
      const versions = existing
        ? [...previousVersions, {
            version: existing.version,
            savedAt: existing.updatedAt,
            status: existing.status,
            data: existing.data
          }].slice(-20)
        : [];

      const record = {
        slug,
        status,
        version: Number(existing?.version || 0) + 1,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        updatedBy: user.email || user.id,
        data,
        versions
      };
      await setQuoteRecord(slug, record);
      return json({ ok: true, record, publicUrl: `/cotizacion/${slug}` });
    }

    return json({ ok: false, error: "Método no permitido." }, 405);
  } catch (error) {
    return errorResponse(error, "No fue posible guardar la cotización.");
  }
};
