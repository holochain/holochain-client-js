import { assert, test, vi } from "vitest";
import { decodeSignal } from "../src/api/app/decode.js";
import { HolochainError, SignalType } from "../src/index.js";

// Pure unit tests: no conductor, no websocket. They cover how `decodeSignal`
// treats signal variants the client cannot surface to listeners.

test("decodeSignal drops an app_direct signal instead of throwing", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const signal = decodeSignal({
      type: "app_direct",
      value: {
        cell_id: [new Uint8Array(39).fill(1), new Uint8Array(39).fill(2)],
        signal: [1, 2, 3],
      },
    });
    assert.isNull(signal, "the signal is dropped rather than delivered");
    assert.equal(warn.mock.calls.length, 1, "the drop is warned about");
  } finally {
    warn.mockRestore();
  }
});

test("decodeSignal passes a system signal through", () => {
  const signal = decodeSignal({
    type: "system",
    value: { type: "successful_countersigning", value: new Uint8Array(39) },
  });
  assert.isNotNull(signal);
  assert.equal(signal?.type, SignalType.System);
});

test("decodeSignal still throws on a malformed signal", () => {
  assert.throws(
    () => decodeSignal({ type: "not_a_signal_type", value: {} }),
    HolochainError,
  );
});
