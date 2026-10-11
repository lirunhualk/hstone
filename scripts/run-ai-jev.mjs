import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = fileURLToPath(new URL("../", import.meta.url));

export class JevNetworkError extends Error {
  constructor(code) {
    const messages = {
      "proxy-configuration": "Jev proxy configuration is invalid; configure an unauthenticated HTTP(S) proxy in the process environment.",
      "windows-proxy": "Jev Windows proxy fallback requires an existing unauthenticated loopback HTTP(S) proxy; configure the process proxy explicitly for other configurations.",
      "proxy-pac": "Jev cannot evaluate Windows PAC settings; configure HTTPS_PROXY explicitly before running.",
      "proxy-https": "Windows settings have no supported HTTPS proxy; configure HTTPS_PROXY explicitly before running.",
      "registry-read": "Jev could not read the existing Windows proxy settings; configure HTTPS_PROXY explicitly or fix registry access.",
      "proxy-runtime": "Jev proxy support requires Node.js 24 with --use-env-proxy support; upgrade Node.js before running.",
      "runtime": "Jev requires Node.js 22.13 or newer with TypeScript stripping support.",
      "tls-verification": "Jev requires TLS certificate verification; remove NODE_TLS_REJECT_UNAUTHORIZED=0 before running.",
      "child-process": "Jev runner could not start or was interrupted; no direct-network retry was attempted.",
      "arguments": "Invalid Jev runner arguments.",
    };
    super(messages[code] ?? "Jev network setup failed.");
    this.name = "JevNetworkError";
    this.code = code;
  }
}

function fail(code) { throw new JevNetworkError(code); }

/** Captured JSON contains only these three values; never log it or exceptions. */
export function readWindowsProxySettings(run = execFileSync) {
  const command = "$settings = Get-Item -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -ErrorAction Stop; $payload = [ordered]@{ ProxyEnable = $settings.GetValue('ProxyEnable', 0); ProxyServer = $settings.GetValue('ProxyServer', ''); AutoConfigURL = $settings.GetValue('AutoConfigURL', '') }; $payload | ConvertTo-Json -Compress";
  try {
    const text = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"], timeout: 5000, maxBuffer: 16 * 1024,
    });
    const settings = JSON.parse(String(text).replace(/^\uFEFF/, ""));
    if (!settings || typeof settings !== "object" || Array.isArray(settings) || ![0, 1].includes(settings.ProxyEnable) || typeof settings.ProxyServer !== "string" || typeof settings.AutoConfigURL !== "string") fail("registry-read");
    return { ProxyEnable: settings.ProxyEnable, ProxyServer: settings.ProxyServer, AutoConfigURL: settings.AutoConfigURL };
  } catch {
    fail("registry-read");
  }
}

function proxyUrl(value, loopbackOnly = false, allowBare = false) {
  if (typeof value !== "string" || !value.trim() || /[\x00-\x20\x7F]/.test(value.trim())) fail("proxy-configuration");
  let url;
  try { url = new URL(allowBare && !value.includes("://") ? `http://${value.trim()}` : value.trim()); }
  catch { fail("proxy-configuration"); }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) fail("proxy-configuration");
  if (loopbackOnly && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) fail("windows-proxy");
  return url.href;
}

function environmentValue(environment, lower, upper) {
  // Node's lowercase proxy variables take precedence over uppercase ones.
  const value = environment[lower] || environment[upper];
  return value === undefined || value === "" ? undefined : value;
}

function windowsProxy(settings) {
  if (!settings || ![0, 1].includes(settings.ProxyEnable) || typeof settings.ProxyServer !== "string" || typeof settings.AutoConfigURL !== "string") fail("registry-read");
  const server = settings.ProxyServer.trim();
  if (settings.ProxyEnable !== 1 || !server) {
    if (settings.AutoConfigURL.trim()) fail("proxy-pac");
    return { source: "direct", proxyEnabled: false };
  }
  if (!server.includes("=")) {
    const proxy = proxyUrl(server, true, true);
    return { source: "windows", proxyEnabled: true, httpProxy: proxy, httpsProxy: proxy };
  }
  const protocols = new Map();
  for (const part of server.split(";")) {
    const match = /^\s*(http|https|ftp|socks)\s*=\s*(\S+)\s*$/i.exec(part);
    if (!match || protocols.has(match[1].toLowerCase())) fail("proxy-configuration");
    protocols.set(match[1].toLowerCase(), match[2]);
  }
  if (!protocols.has("https")) fail("proxy-https");
  return { source: "windows", proxyEnabled: true,
    httpProxy: protocols.has("http") ? proxyUrl(protocols.get("http"), true, true) : undefined,
    httpsProxy: proxyUrl(protocols.get("https"), true, true) };
}

/** Internal values may contain configured URLs. Only source/proxyEnabled are report metadata. */
export function resolveJevNetwork({ environment = process.env, platform = process.platform, readWindowsProxy = readWindowsProxySettings } = {}) {
  const http = environmentValue(environment, "http_proxy", "HTTP_PROXY");
  const https = environmentValue(environment, "https_proxy", "HTTPS_PROXY");
  if (http !== undefined || https !== undefined) {
    // An explicitly configured process proxy always wins over Windows settings.
    const httpProxy = http === undefined ? undefined : proxyUrl(http);
    const httpsProxy = https === undefined ? httpProxy : proxyUrl(https);
    return { source: "environment", proxyEnabled: true, httpProxy, httpsProxy };
  }
  if (platform !== "win32") return { source: "direct", proxyEnabled: false };
  let settings;
  try { settings = readWindowsProxy(); } catch { fail("registry-read"); }
  return windowsProxy(settings);
}

/** Build a child environment without changing process.env or any Windows setting. */
export function createJevBootstrap(args, {
  environment = process.env,
  platform = process.platform,
  nodeVersion = process.versions.node,
  execPath = process.execPath,
  supportsEnvProxy = process.allowedNodeEnvironmentFlags.has("--use-env-proxy"),
  supportsStripTypes = process.allowedNodeEnvironmentFlags.has("--experimental-strip-types"),
  readWindowsProxy = readWindowsProxySettings,
  repoRoot = REPO,
} = {}) {
  if (!Array.isArray(args) || args.some((value) => typeof value !== "string") || args.filter((value) => value === "--diagnose").length > 1) fail("arguments");
  const diagnose = args.includes("--diagnose");
  const forwarded = args.filter((value) => value !== "--diagnose");
  const fixture = !diagnose && forwarded.some((value, index) => value === "--mode" && forwarded[index + 1] === "fixture");
  const help = forwarded.length === 1 && forwarded[0] === "--help";
  const [major, minor] = String(nodeVersion).split(".").map(Number);
  if (!Number.isInteger(major) || major < 22 || (major === 22 && minor < 13) || !supportsStripTypes) fail("runtime");
  const network = fixture || help ? { source: fixture ? "fixture" : "direct", proxyEnabled: false } : resolveJevNetwork({ environment, platform, readWindowsProxy });
  if (!fixture && !help && environment.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("tls-verification");
  if (network.proxyEnabled && (major < 24 || !supportsEnvProxy)) fail("proxy-runtime");
  const childEnvironment = { ...environment, JEV_NETWORK_SOURCE: network.source };
  if (network.proxyEnabled) {
    // Normalize case so Node sees exactly the precedence we validated. Values
    // remain in the child environment and never become CLI arguments or logs.
    for (const name of ["http_proxy", "HTTP_PROXY", "https_proxy", "HTTPS_PROXY"]) delete childEnvironment[name];
    if (network.httpProxy) childEnvironment.HTTP_PROXY = network.httpProxy;
    if (network.httpsProxy) childEnvironment.HTTPS_PROXY = network.httpsProxy;
  }
  const flags = network.proxyEnabled ? ["--use-env-proxy", "--experimental-strip-types"] : ["--experimental-strip-types"];
  return { command: execPath, args: [...flags, resolve(repoRoot, "scripts", diagnose ? "diagnose-ai-jev.ts" : "benchmark-ai-jev.ts"), ...forwarded],
    cwd: repoRoot, env: childEnvironment, network: { source: network.source, proxyEnabled: network.proxyEnabled } };
}

export function runJevBootstrap(args, dependencies = {}) {
  const plan = createJevBootstrap(args, dependencies);
  let result;
  try {
    result = (dependencies.spawn ?? spawnSync)(plan.command, plan.args, { cwd: plan.cwd, env: plan.env, stdio: "inherit", windowsHide: true });
  } catch { fail("child-process"); }
  if (result.error || result.status === null || !Number.isInteger(result.status)) fail("child-process");
  return { status: result.status, network: plan.network };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = runJevBootstrap(process.argv.slice(2)).status; }
  catch (error) {
    // Never expose child errors, registry data, proxy URLs or credentials.
    console.error(error instanceof JevNetworkError ? error.message : "Jev runner failed during network setup.");
    process.exitCode = 1;
  }
}
