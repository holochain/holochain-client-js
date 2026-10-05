import { assert, test } from "vitest";
import { decodeSignal } from "../src/api/app/decode.js";
import { HolochainError, SignalType } from "../src/index.js";

// Pure unit tests: no conductor, no websocket. They pin how `decodeSignal`
// turns each raw `Signal` variant into the `DecodedSignal` handed to
// listeners, on both the websocket and the Tauri transport.

// A throwaway 39-byte value standing in for a HoloHash.
const fakeHash = (fill: number): Uint8Array =>
  Uint8Array.from(new Array(39).fill(fill));

test("decodeSignal surfaces an app_direct signal with a Uint8Array payload", () => {
  const cellId = [fakeHash(1), fakeHash(2)];
  const fromAgent = fakeHash(3);

  const signal = decodeSignal({
    type: "app_direct",
    // Rust serializes the `Vec<u8>` payload as a msgpack array of integers.
    value: { cell_id: cellId, from_agent: fromAgent, signal: [1, 2, 3] },
  });

  assert.equal(signal.type, SignalType.AppDirect);
  assert(signal.type === SignalType.AppDirect);
  assert.deepEqual(signal.value.cell_id, cellId, "receiving cell preserved");
  assert.deepEqual(signal.value.from_agent, fromAgent, "sender preserved");
  assert.instanceOf(signal.value.signal, Uint8Array, "payload is bytes");
  assert.deepEqual(Array.from(signal.value.signal), [1, 2, 3]);
});

test("decodeSignal accepts an app_direct payload that already arrived as bytes", () => {
  const signal = decodeSignal({
    type: "app_direct",
    value: {
      cell_id: [fakeHash(1), fakeHash(2)],
      from_agent: fakeHash(3),
      signal: Uint8Array.from([4, 5]),
    },
  });

  assert(signal.type === SignalType.AppDirect);
  assert.instanceOf(signal.value.signal, Uint8Array);
  assert.deepEqual(Array.from(signal.value.signal), [4, 5]);
});

test("decodeSignal passes a system signal through", () => {
  const signal = decodeSignal({
    type: "system",
    value: { type: "successful_countersigning", value: new Uint8Array(39) },
  });
  assert.equal(signal.type, SignalType.System);
});

test("decodeSignal still throws on a malformed signal", () => {
  assert.throws(
    () => decodeSignal({ type: "not_a_signal_type", value: {} }),
    HolochainError,
  );
});
