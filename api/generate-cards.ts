// The Gloo card-generation route (PRD-09). The first of the two-route server
// tier ADR-0002 describes; the second, the YouVersion token exchange, is
// PRD-10.
//
// This is the only place the Gloo credential is ever read. The API key, base
// URL, and model id come from server-side environment variables and are never
// imported into anything Vite bundles — AGENTS.md §6 allows exactly one
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
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { EncounterCard } from "../src/core/encounters";
import { validateCardSet } from "../src/core/encounters";

// Node runtime, per ADR-0002 "Hosting": the OpenAI-compatible SDK expects it.
export const config = { runtime: "nodejs" };

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
  ].join("\n");
}

/** The unavailable body, returned for every failure so the client degrades once. */
function unavailable(reference: string): Response {
  return Response.json({
    status: "unavailable",
    reference,
    reason: "Gloo card generation is unavailable for this encounter.",
  });
}

/**
 * One generateObject attempt, validated against the shared `validateCardSet`
 * rule. Returns the cards on success or null on any failure, so the caller can
 * retry exactly once without a thrown exception crossing between attempts.
 */
async function attemptGeneration(
  model: LanguageModel,
  request: GenerateCardsRequest,
): Promise<EncounterCard[] | null> {
  try {
    const { object } = await generateObject({
      model,
      schema: generatedCardSetSchema,
      prompt: buildPrompt(request),
    });

    const cards: EncounterCard[] = object.cards.map((card, index) => ({
      id: `${request.reference}:gen:${index}`,
      text: card.text,
      value: card.value,
    }));

    // Re-check with the core validator rather than trusting the model to have
    // met the schema. The schema and this rule are one rule (ADR-0003).
    const validation = validateCardSet(cards);
    if (!validation.ok) return null;

    return cards;
  } catch {
    return null;
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ status: "unavailable", reason: "method-not-allowed" }, { status: 405 });
  }

  let parsed: GenerateCardsRequest | null = null;
  try {
    parsed = parseRequest(await request.json());
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return Response.json({ status: "unavailable", reason: "bad-request" }, { status: 400 });
  }

  // Credentials are read here and only here. With any of them missing the
  // route reports unavailable, which is exactly the no-credentials degradation
  // ADR-0002 requires so development is never blocked.
  const apiKey = process.env.GLOO_API_KEY;
  const baseURL = process.env.GLOO_BASE_URL;
  const modelId = process.env.GLOO_MODEL_ID;
  if (!apiKey || !baseURL || !modelId) {
    return unavailable(parsed.reference);
  }

  const gloo = createOpenAICompatible({ name: "gloo", apiKey, baseURL });
  const model = gloo(modelId);

  // One structured call, then exactly one retry on violation, then unavailable.
  const cards =
    (await attemptGeneration(model, parsed)) ?? (await attemptGeneration(model, parsed));
  if (!cards) return unavailable(parsed.reference);

  return Response.json({ status: "generated", reference: parsed.reference, cards });
}
