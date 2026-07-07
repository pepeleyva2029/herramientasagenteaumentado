export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

export function errorResponse(error, fallback = "Ocurrió un error inesperado") {
  const status = Number(error?.status || error?.statusCode || 500);
  const message = status >= 500 ? fallback : (error?.message || fallback);
  console.error(error);
  return json({ ok: false, error: message }, status);
}

export function sanitizeSlug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function makeSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}
