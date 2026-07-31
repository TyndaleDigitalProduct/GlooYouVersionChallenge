import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./youversion-token.js";

/** Minimal fakes for the Node (req, res) handler signature, mirroring what
 * generate-cards.ts's handler expects; there is no existing test for that
 * route to follow a precedent from, so this is this file's own convention. */
function fakeRequest(body: unknown, method = "POST") {
  return { method, body } as unknown as Parameters<typeof handler>[0];
}

function fakeResponse() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(chunk?: string) {
      this.body = chunk ?? "";
    },
  };
  return res as unknown as Parameters<typeof handler>[1] & typeof res;
}

const validRequestBody = {
  code: "auth-code",
  codeVerifier: "verifier",
  redirectUri: "https://example.test/",
  appKey: "test-app-key",
};

describe("api/youversion-token (PRD-10, the second of the two-route tier)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("declares the Node runtime, per ADR-0002 Hosting", async () => {
    const module = await import("./youversion-token.js");
    expect(module.config).toEqual({ runtime: "nodejs" });
  });

  it("rejects a non-POST method", async () => {
    const req = fakeRequest(undefined, "GET");
    const res = fakeResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body)).toMatchObject({ status: "unavailable" });
  });

  it("rejects a malformed body", async () => {
    const req = fakeRequest({ code: "only-a-code" });
    const res = fakeResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ status: "unavailable" });
  });

  it("forwards a well-formed request to YouVersion's token endpoint and relays the tokens", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.youversion.com/auth/token");
      const sentBody = new URLSearchParams(init.body as string);
      expect(sentBody.get("grant_type")).toBe("authorization_code");
      expect(sentBody.get("code")).toBe("auth-code");
      expect(sentBody.get("code_verifier")).toBe("verifier");
      expect(sentBody.get("redirect_uri")).toBe("https://example.test/");
      expect(sentBody.get("client_id")).toBe("test-app-key");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-123",
          refresh_token: "refresh-456",
          expires_in: 3600,
          id_token: "header.payload.sig",
          scope: "openid profile",
          token_type: "Bearer",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = fakeRequest(validRequestBody);
    const res = fakeResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      status: "ok",
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresIn: 3600,
      idToken: "header.payload.sig",
    });
  });

  it("reports unavailable, never throws, when YouVersion's token endpoint rejects the exchange", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "invalid_grant" }),
      })),
    );

    const req = fakeRequest(validRequestBody);
    const res = fakeResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: "unavailable" });
  });

  it("reports unavailable, never throws, on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const req = fakeRequest(validRequestBody);
    const res = fakeResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: "unavailable" });
  });

  it("reports unavailable when the token response is missing required fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ token_type: "Bearer" }) })),
    );

    const req = fakeRequest(validRequestBody);
    const res = fakeResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: "unavailable" });
  });

  it("never reads or forwards a client secret — there is none for PKCE", async () => {
    // AGENTS.md §6 / ADR-0002 "Sign-in": PKCE has no client secret to guard.
    // Proven here by construction: the route file itself must not name one.
    // Mirrors glooCredentialBoundary.test.ts's process.cwd()-relative read.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "api", "youversion-token.ts"), "utf8");
    expect(source).not.toMatch(/client_secret/i);
  });
});
