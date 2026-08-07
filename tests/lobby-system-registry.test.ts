import assert from "node:assert/strict";
import test from "node:test";

import {
  PLAYABLE_SYSTEM_EVENT_DEFINITIONS,
  SYSTEM_EVENT_DEFINITIONS,
  UNSUPPORTED_SYSTEM_EVENT_EFFECTS,
} from "../lib/game/lobby-systems.ts";

test("system-event registry has the documented unique identities", () => {
  assert.equal(SYSTEM_EVENT_DEFINITIONS.length, 43);
  assert.equal(
    new Set(SYSTEM_EVENT_DEFINITIONS.map((event) => event.id)).size,
    SYSTEM_EVENT_DEFINITIONS.length,
  );
  assert.equal(
    new Set(SYSTEM_EVENT_DEFINITIONS.map((event) => event.cardId)).size,
    SYSTEM_EVENT_DEFINITIONS.length,
  );
  assert.equal(
    SYSTEM_EVENT_DEFINITIONS.find(
      (event) => event.id === "system-event-faceless",
    )?.cardId,
    "BG27_Anomaly_577",
  );
  assert.equal(UNSUPPORTED_SYSTEM_EVENT_EFFECTS.size, 24);
  assert.equal(PLAYABLE_SYSTEM_EVENT_DEFINITIONS.length, 19);
  assert.ok(
    PLAYABLE_SYSTEM_EVENT_DEFINITIONS.every(
      (event) => !UNSUPPORTED_SYSTEM_EVENT_EFFECTS.has(event.effect),
    ),
  );
  assert.deepEqual(
    new Set(
      SYSTEM_EVENT_DEFINITIONS
        .filter((event) =>
          UNSUPPORTED_SYSTEM_EVENT_EFFECTS.has(event.effect),
        )
        .map((event) => event.effect),
    ),
    UNSUPPORTED_SYSTEM_EVENT_EFFECTS,
  );
});
