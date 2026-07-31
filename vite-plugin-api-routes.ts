// Serves the `api/` Vercel functions from the Vite dev server, so plain
// `pnpm dev` exercises the real routes instead of 404ing on them.
//
// Why this exists: the two-route server tier ADR-0002 "Hosting" describes
// (api/generate-cards.ts, api/youversion-token.ts) is deployed by Vercel, but
// Vite alone serves only the client. A POST to /api/* under `pnpm dev` used to
// fall through to the SPA and 404, and because both routes' clients turn any
// failure into a recoverable `unavailable`/`Result`, the symptom was silent:
// the Gloo path quietly produced fallback cards, and YouVersion sign-in showed
// "Couldn't connect right now" with no indication the route had never run at
// all. `.env.example` documented that trap and pointed at `npx vercel dev`
// instead, which needs a Vercel login for what is really just a local Node
// handler. This plugin removes the trap: same code, same request shape, no
// account required.
//
// Dev only (`apply: "serve"`). In production Vercel serves these files itself
// and this plugin is not part of the build.
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { loadEnv, type Plugin } from "vite";

/** Matches a bare route filename, so a request can never escape `api/`. */
const ROUTE_NAME = /^[a-zA-Z0-9-]+$/;

/**
 * Set to "off" to leave /api/* unserved, restoring the pre-plugin behaviour.
 * playwright.config.ts sets it: with real credentials in .env, serving the
 * routes would turn every e2e run into live, billable, non-deterministic Gloo
 * calls, where the 404-to-fallback path the specs were written against is both
 * free and repeatable.
 */
const DISABLE_FLAG = "VV_DEV_API_ROUTES";

type NodeRequest = IncomingMessage & { body?: unknown };
type RouteHandler = (req: NodeRequest, res: ServerResponse) => void | Promise<void>;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function apiRoutes(): Plugin {
  return {
    name: "vv-dev-api-routes",
    apply: "serve",

    configureServer(server) {
      if (process.env[DISABLE_FLAG] === "off") {
        server.config.logger.info(
          `[dev-api] ${DISABLE_FLAG}=off — /api/* left unserved, clients will see their fallback path`,
        );
        return;
      }

      // Vercel loads .env into `process.env` for a function; Vite only exposes
      // VITE_-prefixed vars to the client and leaves `process.env` alone. The
      // empty prefix loads every var, so the server-side-only ones the routes
      // read (GLOO_*, YOUVERSION_API_HOST) reach them exactly as deployed.
      // A real shell variable still wins, matching Vercel's own precedence.
      const env = loadEnv(server.config.mode, server.config.root, "");
      for (const [key, value] of Object.entries(env)) {
        process.env[key] ??= value;
      }

      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (!pathname.startsWith("/api/")) {
          next();
          return;
        }

        const routeName = pathname.slice("/api/".length);
        if (!ROUTE_NAME.test(routeName)) {
          next();
          return;
        }

        const file = path.resolve(server.config.root, "api", `${routeName}.ts`);
        if (!fs.existsSync(file)) {
          next();
          return;
        }

        try {
          // Populate `req.body` the way Vercel does: the parsed JSON object.
          // Both routes also tolerate a raw string, which is the fallback for
          // a body that is not JSON at all.
          const raw = await readBody(req);
          if (raw.length > 0) {
            try {
              (req as NodeRequest).body = JSON.parse(raw);
            } catch {
              (req as NodeRequest).body = raw;
            }
          }

          // ssrLoadModule transpiles the TypeScript route on demand and picks
          // up edits without restarting the dev server.
          const module = await server.ssrLoadModule(file);
          const handler = (module as { default?: RouteHandler }).default;
          if (typeof handler !== "function") {
            throw new Error(`api/${routeName}.ts has no default-exported handler`);
          }

          await handler(req as NodeRequest, res);
        } catch (error) {
          // Mirrors the routes' own contract — a discriminated union, never a
          // thrown exception across the wire — so a broken route in dev fails
          // the same shape the client already handles.
          server.config.logger.error(
            `[dev-api] api/${routeName}.ts threw: ${error instanceof Error ? error.stack : String(error)}`,
          );
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ status: "unavailable", reason: "dev-route-threw" }));
          } else {
            res.end();
          }
        }
      });
    },
  };
}
