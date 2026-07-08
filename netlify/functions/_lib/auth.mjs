import { getUser as getCookieUser } from "@netlify/identity";

/**
 * Supports both the current @netlify/identity cookie flow and the legacy
 * Netlify Identity widget, which sends a Bearer JWT in Authorization.
 */
export async function getAuthenticatedUser(request) {
  // Preferred/current flow: nf_jwt cookie handled by @netlify/identity.
  try {
    const cookieUser = await getCookieUser();
    if (cookieUser) return cookieUser;
  } catch (error) {
    console.warn("Cookie Identity lookup failed", error?.message || error);
  }

  // Compatibility flow for netlify-identity-widget.
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(authorization)) return null;

  const requestOrigin = new URL(request.url).origin;
  const siteOrigin = String(process.env.URL || requestOrigin).replace(/\/$/, "");

  try {
    const response = await fetch(`${siteOrigin}/.netlify/identity/user`, {
      method: "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
      redirect: "manual",
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Bearer Identity lookup rejected", response.status);
      return null;
    }

    const user = await response.json();
    return user && (user.id || user.email) ? user : null;
  } catch (error) {
    console.error("Bearer Identity lookup failed", error);
    return null;
  }
}
