import { defineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { request as httpsRequest } from "node:https";
import { constants as cryptoConstants } from "node:crypto";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "controlid-local-proxy",
      configureServer(server: ViteDevServer) {
        server.middlewares.use("/controlid-proxy", async (req: IncomingMessage, res: ServerResponse) => {
          try {
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.setHeader("Access-Control-Allow-Headers", "content-type");
              res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
              res.end();
              return;
            }

            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end("Method Not Allowed");
              return;
            }

            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const raw = Buffer.concat(chunks).toString("utf-8");
            const body = raw ? JSON.parse(raw) : {};
            const url = String(body?.url || "");
            const method = String(body?.method || "GET").toUpperCase();
            const headers = (body?.headers && typeof body.headers === "object") ? body.headers : {};
            const reqBody = body?.body;

            if (!url) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "url é obrigatório" }));
              return;
            }

            const u = new URL(url);
            const isHttps = u.protocol === "https:";
            const upstreamRequest = isHttps ? httpsRequest : httpRequest;

            res.setHeader("Access-Control-Allow-Origin", "*");

            await new Promise<void>((resolve, reject) => {
              const upstream = upstreamRequest(
                {
                  protocol: u.protocol,
                  hostname: u.hostname,
                  port: u.port ? Number(u.port) : undefined,
                  path: `${u.pathname}${u.search}`,
                  method,
                  headers,
                  insecureHTTPParser: true,
                  ...(isHttps
                    ? {
                      rejectUnauthorized: false,
                      servername: u.hostname,
                      minVersion: "TLSv1",
                      secureOptions: cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT,
                    }
                    : {}),
                },
                (upRes) => {
                  res.statusCode = upRes.statusCode || 502;
                  const ct = upRes.headers["content-type"];
                  if (ct) res.setHeader("Content-Type", String(ct));
                  upRes.on("error", reject);
                  upRes.pipe(res);
                  upRes.on("end", () => resolve());
                },
              );
              upstream.on("error", reject);

              if (method === "GET" || method === "HEAD") {
                upstream.end();
                return;
              }

              const payload =
                typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody ?? {});
              upstream.end(payload);
            });
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
          }
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
