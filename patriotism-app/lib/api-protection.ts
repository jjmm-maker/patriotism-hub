const MAX_REQUEST_BYTES = 16 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 12;
const MAX_TRACKED_KEYS = 10_000;

type RateEntry = {
  count: number;
  resetAt: number;
};

type RateStore = Map<string, RateEntry>;

declare global {
  var __patriotismRateStore: RateStore | undefined;
}

const rateStore: RateStore =
  globalThis.__patriotismRateStore ??
  (globalThis.__patriotismRateStore = new Map());

export function requestTooLarge(request: Request): boolean {
  const declaredLength = request.headers.get("content-length");

  if (declaredLength === null) return false;

  const length = Number(declaredLength);

  return (
    !Number.isFinite(length) ||
    length < 0 ||
    length > MAX_REQUEST_BYTES
  );
}

export async function readJsonSafely(
  request: Request,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" }
> {
  if (requestTooLarge(request)) {
    return { ok: false, reason: "too_large" };
  }

  if (!request.body) {
    return { ok: false, reason: "invalid_json" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      total += value.byteLength;

      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }

      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

export function checkRateLimit(
  key: string,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  for (const [storedKey, entry] of rateStore) {
    if (entry.resetAt <= now) rateStore.delete(storedKey);
  }

  let entry = rateStore.get(key);

  if (!entry) {
    if (rateStore.size >= MAX_TRACKED_KEYS) {
      return { allowed: false, retryAfterSeconds: 60 };
    }

    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateStore.set(key, entry);
  }

  if (entry.count >= RATE_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.resetAt - now) / 1000),
      ),
    };
  }

  entry.count += 1;

  return { allowed: true, retryAfterSeconds: 0 };
}
