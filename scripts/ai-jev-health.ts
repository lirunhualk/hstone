import { Buffer } from "node:buffer";

const ENDPOINT = "https://api.typesafe.ai/v1/models";
const MAX_BYTES = 64_000;
const TIMEOUT_MS = 5000;

export interface JevProviderHealth {
  healthy: boolean;
  status: number | null;
  failure: "timeout" | "transport" | "http" | "shape" | null;
}

/** One read-only request on the same configured fetch route; never retry POSTs. */
export async function probeJevProviderHealth(credential: string, fetchRequest: typeof fetch = fetch): Promise<JevProviderHealth> {
  const controller = new AbortController();
  let status: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<JevProviderHealth>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ healthy: false, status, failure: "timeout" });
    }, TIMEOUT_MS);
  });
  const operation = (async (): Promise<JevProviderHealth> => {
    try {
      const response = await fetchRequest(ENDPOINT, {
        method: "GET", headers: { Authorization: `Bearer ${credential}` },
        redirect: "error", signal: controller.signal,
      });
      status = response.status;
      if (status !== 200) {
        void response.body?.cancel().catch(() => undefined);
        return { healthy: false, status, failure: "http" };
      }
      const reader = response.body?.getReader();
      if (!reader) return { healthy: false, status, failure: "shape" };
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      let complete = false;
      const cancel = () => { void reader.cancel().catch(() => undefined); };
      controller.signal.addEventListener("abort", cancel, { once: true });
      try {
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) { complete = true; break; }
          bytes += value.byteLength;
          if (bytes > MAX_BYTES) return { healthy: false, status, failure: "shape" };
          chunks.push(value);
        }
        if (!complete || controller.signal.aborted) return { healthy: false, status, failure: "timeout" };
        const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value)) return { healthy: false, status, failure: "shape" };
        const models = (value as Record<string, unknown>).models;
        if (!Array.isArray(models) || models.length < 1 || models.length > 128 || models.some((model) =>
          !model || typeof model !== "object" || Array.isArray(model) || typeof model.name !== "string" || !/^jev(?:[-_.][A-Za-z0-9]+)*$/.test(model.name))) {
          return { healthy: false, status, failure: "shape" };
        }
        return { healthy: true, status, failure: null };
      } catch {
        return { healthy: false, status, failure: controller.signal.aborted ? "timeout" : "shape" };
      } finally {
        controller.signal.removeEventListener("abort", cancel);
        if (!complete) cancel();
        reader.releaseLock();
      }
    } catch {
      return { healthy: false, status, failure: controller.signal.aborted ? "timeout" : "transport" };
    }
  })();
  try { return await Promise.race([operation, expired]); }
  finally { if (timer) clearTimeout(timer); controller.abort(); }
}
