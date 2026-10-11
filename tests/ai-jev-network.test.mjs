import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { createJevBootstrap, JevNetworkError, readWindowsProxySettings, resolveJevNetwork, runJevBootstrap } from "../scripts/run-ai-jev.mjs";

const win = { ProxyEnable: 1, ProxyServer: "localhost:8080", AutoConfigURL: "" };
const runtime = { nodeVersion: "24.14.1", supportsEnvProxy: true, supportsStripTypes: true, execPath: "node-fixture", repoRoot: resolve("fixture-repo") };
const realArgs = ["--mode", "jev", "--preset", "smoke", "--start-seed", "94999901"];

test("process proxy settings win over Windows and lower case wins over upper case", () => {
  let reads = 0;
  const result = resolveJevNetwork({ environment: { HTTP_PROXY: "http://upper.example:8080", http_proxy: "http://lower.example:8080", HTTPS_PROXY: "https://secure.example:8443" }, platform: "win32", readWindowsProxy: () => { reads += 1; return win; } });
  assert.equal(reads, 0);
  assert.equal(result.source, "environment");
  assert.equal(result.httpProxy, "http://lower.example:8080/");
  assert.equal(result.httpsProxy, "https://secure.example:8443/");
  const httpOnly = resolveJevNetwork({ environment: { HTTP_PROXY: "http://explicit.example:8080" }, platform: "win32", readWindowsProxy: () => { throw new Error("must not read"); } });
  assert.equal(httpOnly.httpsProxy, httpOnly.httpProxy);
});

test("Windows generic and per-protocol HTTPS settings select only existing loopback proxies", () => {
  const generic = resolveJevNetwork({ environment: {}, platform: "win32", readWindowsProxy: () => win });
  assert.deepEqual(generic, { source: "windows", proxyEnabled: true, httpProxy: "http://localhost:8080/", httpsProxy: "http://localhost:8080/" });
  const protocols = resolveJevNetwork({ environment: {}, platform: "win32", readWindowsProxy: () => ({ ...win, ProxyServer: "http=localhost:8080;https=localhost:8443;socks=localhost:1080" }) });
  assert.equal(protocols.httpProxy, "http://localhost:8080/");
  assert.equal(protocols.httpsProxy, "http://localhost:8443/");
  assert.throws(() => resolveJevNetwork({ environment: {}, platform: "win32", readWindowsProxy: () => ({ ...win, ProxyServer: "proxy.example:8080" }) }), (error) => error instanceof JevNetworkError && error.code === "windows-proxy");
  assert.throws(() => resolveJevNetwork({ environment: {}, platform: "win32", readWindowsProxy: () => ({ ...win, ProxyServer: "http=localhost:8080" }) }), /no supported HTTPS proxy/);
});

test("disabled proxy is direct and PAC-only configurations fail without interpreting PAC", () => {
  const result = resolveJevNetwork({ environment: {}, platform: "win32", readWindowsProxy: () => ({ ...win, ProxyEnable: 0 }) });
  assert.deepEqual(result, { source: "direct", proxyEnabled: false });
  assert.throws(() => resolveJevNetwork({ environment: {}, platform: "win32", readWindowsProxy: () => ({ ...win, ProxyEnable: 0, AutoConfigURL: "https://pac.example/settings" }) }), (error) => error instanceof JevNetworkError && error.code === "proxy-pac" && !error.message.includes("pac.example"));
  assert.deepEqual(resolveJevNetwork({ environment: {}, platform: "linux", readWindowsProxy: () => { throw new Error("must not read"); } }), { source: "direct", proxyEnabled: false });
});

test("unsafe proxy syntax, authentication, path and unsupported schemes are rejected without leaked values", () => {
  for (const value of ["socks5://localhost:1080", "http://fixture:placeholder@localhost:8080", "http://localhost:8080/private", "http://localhost:8080/?token=placeholder", "http://localhost:8080/#private", "not a URL", "http://localhost:65536", "http://localhost:8080\r\nheader"]) {
    assert.throws(() => resolveJevNetwork({ environment: { HTTPS_PROXY: value }, platform: "win32", readWindowsProxy: () => { throw new Error("never fallback"); } }), (error) => error instanceof JevNetworkError && error.code === "proxy-configuration" && !error.message.includes(value) && !error.message.includes("placeholder"));
  }
  assert.throws(() => resolveJevNetwork({ environment: {}, platform: "win32", readWindowsProxy: () => ({ ...win, ProxyServer: "https=localhost:8443;https=localhost:8080" }) }), /invalid/);
});

test("registry reader asks only three allowlisted values and sanitizes all failures", () => {
  let runs = 0;
  const settings = readWindowsProxySettings((command, args, options) => {
    runs += 1;
    assert.equal(command, "powershell.exe");
    assert.deepEqual(args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-Command"]);
    assert.equal(args[3].includes("GetValue('ProxyEnable'"), true);
    assert.equal(args[3].includes("GetValue('ProxyServer'"), true);
    assert.equal(args[3].includes("GetValue('AutoConfigURL'"), true);
    assert.equal(args[3].includes("Get-ItemProperty"), false);
    assert.equal(options.windowsHide, true);
    assert.deepEqual(options.stdio, ["ignore", "pipe", "ignore"]);
    return JSON.stringify(win);
  });
  assert.equal(runs, 1);
  assert.deepEqual(settings, win);
  for (const text of ["warning secret fixture value", "{}", "null", '{"ProxyEnable":1,"ProxyServer":42,"AutoConfigURL":""}']) {
    assert.throws(() => readWindowsProxySettings(() => text), (error) => error instanceof JevNetworkError && error.code === "registry-read" && !error.message.includes(text));
  }
  assert.throws(() => readWindowsProxySettings(() => { throw new Error("secret registry failure"); }), (error) => error instanceof JevNetworkError && !error.message.includes("secret"));
});

test("bootstrap uses env proxy flag and only child env values while preserving NO_PROXY and TLS", () => {
  const environment = { NO_PROXY: "localhost,.example", TYPESAFE_API_KEY: "not-a-real-key", NODE_EXTRA_CA_CERTS: "fixture-ca.pem" };
  const original = { ...environment };
  const plan = createJevBootstrap(realArgs, { ...runtime, environment, platform: "win32", readWindowsProxy: () => win });
  assert.equal(plan.args[0], "--use-env-proxy");
  assert.equal(plan.args[1], "--experimental-strip-types");
  assert.equal(plan.args[2], resolve(runtime.repoRoot, "scripts/benchmark-ai-jev.ts"));
  assert.deepEqual(plan.args.slice(3), realArgs);
  assert.equal(plan.env.HTTPS_PROXY, "http://localhost:8080/");
  assert.equal(plan.env.NO_PROXY, environment.NO_PROXY);
  assert.equal(plan.env.TYPESAFE_API_KEY, environment.TYPESAFE_API_KEY);
  assert.equal(plan.env.NODE_EXTRA_CA_CERTS, environment.NODE_EXTRA_CA_CERTS);
  assert.equal(plan.env.NODE_TLS_REJECT_UNAUTHORIZED, undefined);
  assert.equal(plan.env.JEV_NETWORK_SOURCE, "windows");
  assert.deepEqual(plan.network, { source: "windows", proxyEnabled: true });
  assert.equal(JSON.stringify(plan.args).includes("localhost"), false);
  assert.equal(JSON.stringify(plan.args).includes("not-a-real-key"), false);
  assert.deepEqual(environment, original);
  assert.throws(() => createJevBootstrap(realArgs, { ...runtime, environment: { NODE_TLS_REJECT_UNAUTHORIZED: "0" }, platform: "linux" }), /TLS certificate verification/);
});

test("fixture and help avoid Windows reads and do not require proxy-capable Node", () => {
  let reads = 0;
  for (const args of [["--mode", "fixture", "--preset", "smoke", "--start-seed", "94999901"], ["--help"], ["--diagnose", "--help"]]) {
    const plan = createJevBootstrap(args, { ...runtime, nodeVersion: "22.13.0", supportsEnvProxy: false, environment: {}, platform: "win32", readWindowsProxy: () => { reads += 1; throw new Error("must not read"); } });
    assert.equal(plan.args.includes("--use-env-proxy"), false);
  }
  assert.equal(reads, 0);
});

test("proxy mode requires native Node proxy support; direct mode works on repository minimum", () => {
  for (const version of ["22.13.0", "24.0.0"]) assert.throws(() => createJevBootstrap(realArgs, { ...runtime, nodeVersion: version, supportsEnvProxy: false, environment: { HTTPS_PROXY: "http://localhost:8080" }, platform: "linux" }), /Node.js 24/);
  const direct = createJevBootstrap(realArgs, { ...runtime, nodeVersion: "22.13.0", supportsEnvProxy: false, environment: {}, platform: "linux" });
  assert.deepEqual(direct.network, { source: "direct", proxyEnabled: false });
  assert.equal(direct.args.includes("--use-env-proxy"), false);
  assert.throws(() => createJevBootstrap(realArgs, { ...runtime, nodeVersion: "22.12.0", environment: {}, platform: "linux" }), /22.13/);
});

test("diagnosis routing removes only wrapper flag and forwards diagnostic options", () => {
  const plan = createJevBootstrap(["--diagnose", "--inference", "--env-file", ".env"], { ...runtime, environment: {}, platform: "linux" });
  assert.equal(plan.args[1], resolve(runtime.repoRoot, "scripts/diagnose-ai-jev.ts"));
  assert.deepEqual(plan.args.slice(2), ["--inference", "--env-file", ".env"]);
  assert.throws(() => createJevBootstrap(["--diagnose", "--diagnose"], { ...runtime, environment: {}, platform: "linux" }), /Invalid/);
});

test("runner spawns exactly one child, propagates failures, never retries directly or emits raw child errors", () => {
  let calls = 0;
  const deps = { ...runtime, environment: { HTTPS_PROXY: "http://localhost:8080" }, platform: "linux", spawn: (_command, args, options) => {
    calls += 1;
    assert.equal(args[0], "--use-env-proxy");
    assert.equal(options.cwd, runtime.repoRoot);
    assert.equal(options.windowsHide, true);
    assert.equal(options.stdio, "inherit");
    return { status: 7 };
  } };
  assert.equal(runJevBootstrap(realArgs, deps).status, 7);
  assert.equal(calls, 1);
  for (const spawn of [() => { throw new Error("secret child failure"); }, () => ({ status: null, error: new Error("secret child failure") })]) {
    assert.throws(() => runJevBootstrap(realArgs, { ...deps, spawn }), (error) => error instanceof JevNetworkError && error.code === "child-process" && !error.message.includes("secret"));
  }
});
