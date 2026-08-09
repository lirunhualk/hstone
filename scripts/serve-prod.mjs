import { spawn } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `vinext start` cannot serve static files on Windows: its in-memory static
// file cache keys use the platform path separator (backslash), while browser
// URLs use forward slashes, so every /assets, /card-art and /ui request 404s.
// This wrapper serves the built static files directly from dist/client and
// proxies everything else (SSR HTML, server actions, image optimizer) to an
// inner `vinext start` instance on the next port.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_DIR = path.join(ROOT, "dist", "client");
const DEFAULT_PORT = 3100;

const CONTENT_TYPES = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function parsePort() {
  const flagIndex = process.argv.indexOf("--port");
  const value =
    flagIndex !== -1 ? process.argv[flagIndex + 1] : process.env.PORT;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536
    ? parsed
    : DEFAULT_PORT;
}

const PORT = parsePort();
const INNER_PORT = PORT + 1;

let closing = false;
const inner = spawn(
  process.execPath,
  [
    path.join(ROOT, "node_modules", "vinext", "dist", "cli.js"),
    "start",
    "--port",
    String(INNER_PORT),
  ],
  { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
inner.stdout.on("data", (chunk) => {
  for (const line of String(chunk).trimEnd().split(/\r?\n/)) {
    console.log(`[vinext:${INNER_PORT}] ${line}`);
  }
});
inner.stderr.on("data", (chunk) => {
  for (const line of String(chunk).trimEnd().split(/\r?\n/)) {
    console.error(`[vinext:${INNER_PORT}] ${line}`);
  }
});
inner.on("exit", (code) => {
  if (!closing) {
    console.error(`[serve-prod] inner vinext exited (code ${code})`);
    process.exit(1);
  }
});
inner.on("error", (error) => {
  console.error("[serve-prod] failed to start inner vinext:", error);
  process.exit(1);
});

function waitForInner() {
  return new Promise((resolve) => {
    const deadline = Date.now() + 10_000;
    const attempt = () => {
      const request = http.get(
        { hostname: "127.0.0.1", port: INNER_PORT, path: "/" },
        (response) => {
          response.resume();
          resolve(true);
        },
      );
      request.on("error", () => {
        if (Date.now() > deadline) {
          resolve(false);
        } else {
          setTimeout(attempt, 200);
        }
      });
    };
    attempt();
  });
}

function proxyToInner(req, res) {
  const url = new URL(req.url, "http://localhost");
  const request = http.request(
    {
      hostname: "127.0.0.1",
      port: INNER_PORT,
      path: url.pathname + url.search,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${INNER_PORT}` },
    },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    },
  );
  request.on("error", (error) => {
    console.error("[serve-prod] proxy error:", error.message);
    res.writeHead(502);
    res.end("Bad Gateway");
  });
  req.pipe(request);
}

function serveStatic(req, res, pathname) {
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const file = path.resolve(CLIENT_DIR, "." + decodedPathname);
  if (!file.startsWith(CLIENT_DIR + path.sep)) {
    return false;
  }
  let stat;
  try {
    stat = statSync(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) {
    return false;
  }
  const contentType =
    CONTENT_TYPES[path.extname(file).toLowerCase()] ??
    "application/octet-stream";
  const isHashed = decodedPathname.startsWith("/assets/");
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": isHashed
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
  });
  if (req.method !== "HEAD") {
    createReadStream(file).pipe(res);
  } else {
    res.end();
  }
  return true;
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url, "http://localhost").pathname;
  } catch {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }
  if (serveStatic(req, res, pathname)) {
    return;
  }
  proxyToInner(req, res);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `[serve-prod] port ${PORT} is already in use; stop the other server first`,
    );
  } else {
    console.error("[serve-prod] server error:", error);
  }
  closing = true;
  inner.kill();
  process.exit(1);
});

const ready = await waitForInner();
if (!ready) {
  console.error(`[serve-prod] inner vinext did not become ready on port ${INNER_PORT}`);
  closing = true;
  inner.kill();
  process.exit(1);
}
server.listen(PORT, () => {
  console.log(`[serve-prod] serving dist/client statics + proxying to vinext on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  closing = true;
  inner.kill();
  process.exit(0);
});
process.on("SIGTERM", () => {
  closing = true;
  inner.kill();
  process.exit(0);
});
