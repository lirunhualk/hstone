/**
 * Frozen canonical JSON compatibility surface for persisted AI evidence.
 *
 * Do not change v1 semantics. New serialization rules require a new versioned
 * module so historical result pins and archives remain readable indefinitely.
 */
function assertPlainHistoricalObject(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(path + " must be a plain object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(path + " must be a plain object");
  }
}

function canonicalHistoricalJsonValueV1(
  value: unknown,
  path: string,
  ancestors: WeakSet<object>,
): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(path + " must contain only finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(path + " must contain JSON-only data");
  }
  if (ancestors.has(value)) {
    throw new TypeError(path + " must not contain cycles");
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return (
        "[" +
        value
          .map((item, index) =>
            canonicalHistoricalJsonValueV1(
              item,
              path + "[" + String(index) + "]",
              ancestors,
            ),
          )
          .join(",") +
        "]"
      );
    }
    assertPlainHistoricalObject(value, path);
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ":" +
            canonicalHistoricalJsonValueV1(
              value[key],
              path + "." + key,
              ancestors,
            ),
        )
        .join(",") +
      "}"
    );
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalHistoricalJsonV1(value: unknown): string {
  return canonicalHistoricalJsonValueV1(
    value,
    "artifact",
    new WeakSet<object>(),
  );
}
