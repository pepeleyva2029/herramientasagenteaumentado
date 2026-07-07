import { json } from "./_lib/http.mjs";

export default async (request) => {
  const url = new URL(request.url);
  const fallback = Number(url.searchParams.get("fallback") || 0) || null;
  const token = process.env.BANXICO_TOKEN;

  if (!token) {
    return json({
      ok: Boolean(fallback),
      value: fallback,
      date: null,
      source: "Valor capturado en la cotización",
      official: false,
      warning: "Configura BANXICO_TOKEN para consultar automáticamente el valor oficial."
    }, fallback ? 200 : 503, { "cache-control": "public, max-age=300" });
  }

  try {
    const endpoint = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/SP68257/datos/oportuno?token=${encodeURIComponent(token)}`;
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Banxico respondió ${response.status}`);
    const payload = await response.json();
    const datum = payload?.bmx?.series?.[0]?.datos?.[0];
    const value = Number(String(datum?.dato || "").replace(/,/g, ""));
    if (!Number.isFinite(value)) throw new Error("Banxico no devolvió un valor válido.");
    return json({
      ok: true,
      value,
      date: datum?.fecha || null,
      source: "Banco de México · SIE · Serie SP68257",
      official: true
    }, 200, { "cache-control": "public, max-age=3600, s-maxage=3600" });
  } catch (error) {
    return json({
      ok: Boolean(fallback),
      value: fallback,
      date: null,
      source: "Valor capturado en la cotización",
      official: false,
      warning: "No fue posible consultar Banxico en este momento."
    }, fallback ? 200 : 502, { "cache-control": "public, max-age=120" });
  }
};
