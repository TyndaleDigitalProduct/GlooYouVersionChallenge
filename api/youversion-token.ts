// The YouVersion token-exchange route (PRD-10). The second of the two-route
// server tier ADR-0002 "Hosting" describes; the first, Gloo card generation,
// is api/generate-cards.ts.
//
// Sign-in is OAuth 2.0 with PKCE and no client secret (AGENTS.md §6; ADR-0002
// "Sign-in"), so there is nothing secret this route is guarding — the
// `app_key` it forwards as `client_id` is the one credential §6 already
// allows in the browser bundle. What this route buys is not a hidden secret,
// it is ADR-0002's own architecture: the token exchange is server-side by
// decision, not by necessity, and this is where that decision is spent. A
// direct browser-to-YouVersion exchange would work technically (PKCE needs no
// secret to do it), which is exactly why this route stays a thin, credential-
// free proxy rather than growing any logic of its own.
//
// The contract mirrors PassageResult/CardSetResult: a discriminated union,
// never a thrown exception across the wire. Any failure (bad request, a
// rejected exchange, a malformed upstream response) is `{status:
// "unavailable", reason}`, which sessionProvider.ts turns into a recoverable
// `Result` — the client never needs to distinguish "YouVersion said no" from
// "the network dropped" beyond that one reason string.
import type { IncomingMessage, ServerResponse } from "node:http";

// Node runtime, per ADR-0002 "Hosting": matches the Gloo route's runtime, and
// this route also wants a real fetch with no edge-specific quirks.
export const config = { runtime: "nodejs" };

// The classic Node (req, res) handler signature — see api/generate-cards.ts's
// header comment for why (vercel dev does not adapt a returned Response).
type NodeRequest = IncomingMessage & { body?: unknown };

const YOUVERSION_API_HOST_DEFAULT = "api.youversion.com";

interface TokenExchangeRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  appKey: string;
}

function parseRequest(body: unknown): TokenExchangeRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const { code, codeVerifier, redirectUri, appKey } = record;
  if (
    typeof code !== "string" ||
    typeof codeVerifier !== "string" ||
    typeof redirectUri !== "string" ||
    typeof appKey !== "string"
  ) {
    return null;
  }
  return { code, codeVerifier, redirectUri, appKey };
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function unavailableBody(reason: string) {
  return { status: "unavailable", reason };
}

export default async function handler(req: NodeRequest, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, unavailableBody("method-not-allowed"));
    return;
  }

  let raw: unknown = req.body;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const parsed = parseRequest(raw);
  if (!parsed) {
    sendJson(res, 400, unavailableBody("bad-request"));
    return;
  }

  const apiHost = process.env.YOUVERSION_API_HOST || YOUVERSION_API_HOST_DEFAULT;
  const tokenUrl = `https://${apiHost}/auth/token`;
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: parsed.code,
    redirect_uri: parsed.redirectUri,
    client_id: parsed.appKey,
    code_verifier: parsed.codeVerifier,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      sendJson(res, 200, unavailableBody(`token-exchange-failed-${response.status}`));
      return;
    }

    const tokens = (await response.json()) as Record<string, unknown>;
    if (typeof tokens.access_token !== "string" || typeof tokens.id_token !== "string") {
      // Distinct from the client's own malformed-response cases: this one means
      // YouVersion answered 200 without the tokens. See sessionProvider.ts.
      sendJson(res, 200, unavailableBody("upstream-missing-tokens"));
      return;
    }

    sendJson(res, 200, {
      status: "ok",
      accessToken: tokens.access_token,
      refreshToken: typeof tokens.refresh_token === "string" ? tokens.refresh_token : null,
      expiresIn: typeof tokens.expires_in === "number" ? tokens.expires_in : null,
      idToken: tokens.id_token,
    });
  } catch {
    sendJson(res, 200, unavailableBody("token-exchange-threw"));
  } finally {
    clearTimeout(timer);
  }
}
