import { decode } from "@msgpack/msgpack";
import { encodeHashToBase64 } from "../../utils/base64.js";
import { HolochainError } from "../common.js";
import { DecodedSignal, RawSignal, SignalType } from "./client-types.js";
import type { Signal } from "../../generated/api/app/types.js";

/**
 * Convert msgpack map keys the way Holochain conductor responses require:
 * string and number keys pass through, byte-array keys are HoloHashes and are
 * returned in their Base64 string form. Shared by every transport
 * ({@link WsClient} and {@link TauriAppTransport}) so decoded responses match
 * byte for byte regardless of pipe.
 *
 * @internal
 */
export const holoHashMapKeyConverter = (key: unknown): string | number => {
  if (typeof key === "string" || typeof key === "number") {
    return key;
  }
  if (key && typeof key === "object" && key instanceof Uint8Array) {
    // Key of type byte array, must be a HoloHash.
    return encodeHashToBase64(key);
  }
  throw new HolochainError(
    "DeserializationError",
    `Encountered map with unsupported key type (expected string, number, or Uint8Array HoloHash): ${JSON.stringify(
      key,
    )}`,
  );
};

/**
 * Validate that a decoded value is a well-formed Holochain signal.
 *
 * @internal
 */
export function assertHolochainSignal(
  signal: unknown,
): asserts signal is RawSignal {
  if (
    typeof signal === "object" &&
    signal !== null &&
    "type" in signal &&
    "value" in signal &&
    [SignalType.App, SignalType.System].some((type) => signal.type === type)
  ) {
    return;
  }
  throw new HolochainError(
    "UnknownSignalFormat",
    `incoming signal has unknown signal format ${JSON.stringify(
      signal,
      null,
      4,
    )}`,
  );
}

/**
 * The tag of the {@link Signal} variant emitted when a peer calls
 * `send_direct_signal`. Typed against the generated union so that a rename
 * upstream fails the build here.
 *
 * @internal
 */
const APP_DIRECT_SIGNAL_TYPE: Signal["type"] = "app_direct";

/**
 * Whether a decoded value is a direct signal from a remote agent.
 *
 * @internal
 */
function isAppDirectSignal(signal: unknown): boolean {
  return (
    typeof signal === "object" &&
    signal !== null &&
    "type" in signal &&
    signal.type === APP_DIRECT_SIGNAL_TYPE
  );
}

/**
 * Turn an already-decoded raw signal into the {@link DecodedSignal} surfaced to
 * callers: system signals pass through; app signals have their inner payload
 * decoded. Shared by every transport so signal handling is identical whether
 * the bytes arrive over a websocket or Tauri IPC.
 *
 * Returns `null` for signals the client knows about but cannot surface, which
 * callers must skip rather than emit.
 *
 * @internal
 */
export function decodeSignal(rawSignal: unknown): DecodedSignal | null {
  // Deliberate minimal guard: `app_direct` is a real, un-gated variant of the
  // conductor's `Signal` enum, but its payload is opaque to Holochain and the
  // client has no typed shape to hand to listeners. Dropping it with a warning
  // keeps it from throwing inside the transports' async message handlers, where
  // the throw would surface as an unhandled rejection and can take the process
  // down. Actually surfacing direct signals needs a public `SignalType` variant
  // and a `sendDirectSignal` method, which is separate, larger feature work.
  if (isAppDirectSignal(rawSignal)) {
    console.warn(
      "received an app_direct signal, which this client does not support yet; dropping it",
    );
    return null;
  }

  assertHolochainSignal(rawSignal);

  if (rawSignal.type === SignalType.System) {
    return { type: SignalType.System, value: rawSignal.value };
  }

  const encodedAppSignal = rawSignal.value;
  return {
    type: SignalType.App,
    value: {
      cell_id: encodedAppSignal.cell_id,
      zome_name: encodedAppSignal.zome_name,
      // In order to return readable content to the UI, the signal payload must
      // also be deserialized. The wire type is the msgpack-encoded byte string,
      // so what callers receive here is the decoded value, typed as `unknown`
      // because only the emitting zome knows its shape.
      signal: decode(encodedAppSignal.signal),
    },
  };
}
