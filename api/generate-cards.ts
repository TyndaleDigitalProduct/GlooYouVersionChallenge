// The Gloo card-generation route (PRD-09). The first of the two-route server
// tier ADR-0002 describes; the second, the YouVersion token exchange, is
// PRD-10.
//
// This is the only place the Gloo credentials are ever read. Gloo AI does not
// issue a static API key: it uses OAuth2 client-credentials, so the client id,
// client secret, base URL, and model id come from server-side environment
// variables, and the route exchanges the id/secret for a short-lived bearer
// token before every generation (cached across warm invocations). None of this
// is ever imported into anything Vite bundles — AGENTS.md §6 allows exactly one
// credential in the browser bundle and it is the YouVersion app_key, not this.
// glooCredentialBoundary.test.ts asserts the boundary holds.
//
// The transport is the one ADR-0002 "Content" and ADR-0003 "Retained from
// ADR-0002" decided: the Vercel AI SDK with the @ai-sdk/openai-compatible
// provider pointed at Gloo's OpenAI-compatible base URL, calling
// generateObject with a zod schema. A single non-streamed structured call, not
// streamText — ADR-0003 collapsed generation to one structured call, so the
// streaming justification the route once had no longer applies. It runs on the
// Node runtime so the OpenAI-compatible SDK runs untouched.
//
// The contract mirrors PassageResult in src/app/providers.ts: the route always
// answers with a discriminated union — a generated six-card set or an explicit
// unavailable status — and never throws across the wire. Any failure (no
// credential, a model error, a schema violation that survives one retry) is an
// unavailable value the client degrades to the reviewed fallback on.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import type { EncounterCard } from "../src/core/encounters.js";
import { validateCardSet } from "../src/core/encounters.js";

// Node runtime, per ADR-0002 "Hosting": the OpenAI-compatible SDK expects it.
export const config = { runtime: "nodejs" };

// The classic Node (req, res) handler signature. Vercel supports Web-style
// (Request) -> Response handlers when deployed, but `vercel dev` in this setup
// does not adapt them — a returned Response is never written to the socket and
// the request hangs. The (req, res) form works in both dev and production, so
// the route uses it. `req.body` is the parsed JSON body Vercel populates for a
// Node handler; it is typed loosely here to avoid a dependency on the
// @vercel/node types, which are not a project dependency.
type NodeRequest = IncomingMessage & { body?: unknown };

// Gloo AI's OAuth2 client-credentials endpoint and the scope its API requires.
// The inference base URL and model id are configuration (GLOO_BASE_URL,
// GLOO_MODEL_ID) because they vary by account and model choice; these two are
// fixed properties of the Gloo platform, so they live here rather than in env.
const GLOO_TOKEN_URL = "https://platform.ai.gloo.com/oauth2/token";
const GLOO_TOKEN_SCOPE = "api/access";

// Bearer tokens are short-lived. A serverless function keeps module scope warm
// across invocations, so cache the token and reuse it until just before it
// expires rather than exchanging credentials on every generation.
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Exchanges the client id/secret for a Gloo access token, reusing a cached one
 * while it is still valid. Returns null on any failure — a missing token is one
 * more reason the route reports `unavailable`, never an exception that throws.
 */
async function getAccessToken(clientId: string, clientSecret: string): Promise<string | null> {
  // A 60s safety margin so a token never expires mid-request.
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.value;
  }

  // Never let a stalled token endpoint hang the whole request; a timeout is
  // just one more reason the route reports unavailable.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch(GLOO_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basic}`,
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(GLOO_TOKEN_SCOPE)}`,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(
        `[gloo] token exchange failed: HTTP ${response.status} ${await response.text()}`,
      );
      return null;
    }

    const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== "string") return null;

    const expiresInMs = typeof body.expires_in === "number" ? body.expires_in * 1000 : 300_000;
    cachedToken = { value: body.access_token, expiresAt: Date.now() + expiresInMs };
    return cachedToken.value;
  } catch (error) {
    console.error("[gloo] token exchange threw:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The zod schema generateObject enforces. It encodes the same five constraints
 * as `validateCardSet` in src/core/encounters.ts — exactly six cards, integer
 * values 0–5, at least one at 0, at least three above 0, no duplicate text —
 * because these are one rule expressed twice and must not drift. The route
 * still re-checks the model's output with `validateCardSet` after it returns:
 * a violation is a hard failure, not a coerced repair.
 */
const generatedCardSchema = z.object({
  text: z.string().min(1).describe("The insight statement shown on the card."),
  value: z
    .number()
    .int()
    .min(0)
    .max(5)
    .describe("0 for a distractor; 3–5 for a correct card, weighted by importance."),
});

const generatedCardSetSchema = z
  .object({ cards: z.array(generatedCardSchema).length(6) })
  .refine((set) => set.cards.some((card) => card.value === 0), {
    message: "at least one card must be a distractor valued 0",
  })
  .refine((set) => set.cards.filter((card) => card.value > 0).length >= 3, {
    message: "at least three cards must be valued above 0",
  })
  .refine((set) => new Set(set.cards.map((card) => card.text)).size === set.cards.length, {
    message: "card text must not repeat",
  });

interface GenerateCardsRequest {
  reference: string;
  anchor: string;
  section: string;
  note: string;
  danielPassage?: string;
  crossReferencePassage?: string;
}

function parseRequest(body: unknown): GenerateCardsRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const { reference, anchor, section, note, danielPassage, crossReferencePassage } = record;
  if (
    typeof reference !== "string" ||
    typeof anchor !== "string" ||
    typeof section !== "string" ||
    typeof note !== "string"
  ) {
    return null;
  }
  return {
    reference,
    anchor,
    section,
    note,
    danielPassage: typeof danielPassage === "string" ? danielPassage : undefined,
    crossReferencePassage:
      typeof crossReferencePassage === "string" ? crossReferencePassage : undefined,
  };
}

/**
 * The prompt carries the Daniel passage, the cross-referenced passage, and the
 * curated note as the authority (ADR-0003). The correct cards must be entailed
 * by the note — the model distributes a human-written claim across statements,
 * it does not decide what is true of Scripture — and the distractors must be
 * clearly wrong: contradicting the passage or importing a claim absent from it,
 * never a true-but-unstated observation that would punish a careful reader.
 */
function buildPrompt(request: GenerateCardsRequest): string {
  return [
    `You are the ${request.section} guide in a Scripture-engagement game about the book of Daniel.`,
    "Generate exactly six insight cards for one cross-reference encounter.",
    "",
    `Daniel passage (${request.anchor}):`,
    request.danielPassage ?? "(text unavailable; reason from the reference above)",
    "",
    `Cross-referenced passage (${request.reference}):`,
    request.crossReferencePassage ?? "(text unavailable; reason from the reference above)",
    "",
    "Curated note — this is the authority. Every correct card must be entailed by it:",
    request.note,
    "",
    "Rules for the six cards:",
    "- Correct cards (value 3–5) each state one connection the note actually makes,",
    "  weighted by how central that connection is. Do not invent connections the note",
    "  does not support.",
    "- At least one card is a distractor (value 0): a statement that contradicts the",
    "  passages or imports a claim absent from them. A distractor must never be a true",
    "  observation that is merely absent from the note.",
    "- Produce at least three correct cards and at least one distractor, six in total,",
    "  with no two cards sharing the same text.",
    "",
    "Output format — this is strict:",
    "- Respond with ONE JSON object and nothing else. No prose, no explanations,",
    "  no Markdown, no headings, no code fences.",
    "- The object must have exactly this shape:",
    '  {"cards":[{"text":"<insight statement>","value":<integer 0-5>}, ... exactly 6 objects]}',
    "- Each card has only the two keys `text` and `value`. Do not add any other keys.",
  ].join("\n");
}

/** Writes a JSON response with the given status code. */
function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** The unavailable body, sent for every failure so the client degrades once. */
function unavailableBody(reference: string) {
  return {
    status: "unavailable",
    reference,
    reason: "Gloo card generation is unavailable for this encounter.",
  };
}

/**
 * Gloo requires exactly one routing mechanism — `auto_routing`, `model`, or
 * `model_family` — and they are mutually exclusive. To use Gloo AI Core (the
 * platform auto-routes to the optimal model), the request must carry
 * `auto_routing: true` and NO `model`. The Vercel AI SDK always writes a
 * `model` field into the body, so this fetch wrapper rewrites the outgoing
 * request: it drops `model` and sets `auto_routing: true`. It is used only when
 * no explicit GLOO_MODEL_ID is configured; with one set, the SDK's `model`
 * field is left untouched and this wrapper is not installed.
 */
const autoRoutingFetch: typeof fetch = (input, init) => {
  if (init && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      delete body.model;
      body.auto_routing = true;
      init = { ...init, body: JSON.stringify(body) };
    } catch {
      // A body we cannot parse is left as-is rather than dropped.
    }
  }
  return fetch(input, init);
};

/**
 * Extracts the JSON object from a model's text response. We use generateText
 * rather than generateObject because Gloo's auto-routing endpoint does not
 * honor the OpenAI `response_format`/`json_schema` structured-output request —
 * it returns free-form Markdown — so the JSON contract is enforced by the
 * prompt and parsed here instead. Tolerates a stray code fence or leading and
 * trailing prose by slicing from the first `{` to the last `}`. Returns null
 * when nothing parseable is found.
 */
function extractJson(text: string): unknown {
  let candidate = text.trim();

  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();

  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  candidate = candidate.slice(first, last + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * One generation attempt, validated against the shared `validateCardSet` rule.
 * Returns the cards on success or null on any failure, so the caller can retry
 * exactly once without a thrown exception crossing between attempts. The model
 * returns text (see extractJson); the zod schema and then `validateCardSet`
 * are the two gates the output must pass, because the schema and that validator
 * are one rule (ADR-0003) and neither the model nor the transport is trusted to
 * have met it.
 */
async function attemptGeneration(
  model: LanguageModel,
  request: GenerateCardsRequest,
): Promise<EncounterCard[] | null> {
  try {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(request),
      // We own the retry policy (exactly once, in the caller); don't let the
      // SDK's own backoff multiply a stall. And never hang forever.
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(30_000),
    });

    const parsed = generatedCardSetSchema.safeParse(extractJson(text));
    if (!parsed.success) {
      console.error("[gloo] model output did not match the card schema:", parsed.error?.message);
      return null;
    }

    const cards: EncounterCard[] = parsed.data.cards.map((card, index) => ({
      id: `${request.reference}:gen:${index}`,
      text: card.text,
      value: card.value,
    }));

    const validation = validateCardSet(cards);
    if (!validation.ok) {
      console.error("[gloo] generated set failed validateCardSet:", validation.reason);
      return null;
    }

    return cards;
  } catch (error) {
    console.error("[gloo] generateText failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

export default async function handler(req: NodeRequest, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { status: "unavailable", reason: "method-not-allowed" });
    return;
  }

  // Vercel populates req.body from a JSON request; tolerate a raw string too.
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
    sendJson(res, 400, { status: "unavailable", reason: "bad-request" });
    return;
  }

  // Credentials are read here and only here. With any of them missing the
  // route reports unavailable, which is exactly the no-credentials degradation
  // ADR-0002 requires so development is never blocked.
  const clientId = process.env.GLOO_CLIENT_ID;
  const clientSecret = process.env.GLOO_CLIENT_SECRET;
  const baseURL = process.env.GLOO_BASE_URL;
  // Optional. Unset selects Gloo AI Core (auto_routing to the optimal model);
  // set to an explicit gloo-* id to pin one model instead.
  const modelId = process.env.GLOO_MODEL_ID;
  if (!clientId || !clientSecret || !baseURL) {
    sendJson(res, 200, unavailableBody(parsed.reference));
    return;
  }

  // Exchange the client credentials for a bearer token; a failed exchange is
  // the same unavailable degradation as a missing credential.
  const accessToken = await getAccessToken(clientId, clientSecret);
  if (!accessToken) {
    sendJson(res, 200, unavailableBody(parsed.reference));
    return;
  }

  // No explicit model id -> Gloo AI Core: autoRoutingFetch rewrites the body to
  // send `auto_routing: true` and drop the SDK's `model` field, so exactly one
  // routing mechanism is sent. The placeholder id below is stripped there and
  // never reaches Gloo.
  const gloo = createOpenAICompatible({
    name: "gloo",
    apiKey: accessToken,
    baseURL,
    ...(modelId ? {} : { fetch: autoRoutingFetch }),
  });
  const model = gloo(modelId ?? "gloo-ai-core");

  // One structured call, then exactly one retry on violation, then unavailable.
  const cards =
    (await attemptGeneration(model, parsed)) ?? (await attemptGeneration(model, parsed));
  if (!cards) {
    sendJson(res, 200, unavailableBody(parsed.reference));
    return;
  }

  sendJson(res, 200, { status: "generated", reference: parsed.reference, cards });
}
