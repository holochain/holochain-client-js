import { decode } from "@msgpack/msgpack";
import { encodeHashToBase64 } from "../../utils/base64.js";
import { HolochainError } from "../common.js";
import { AppSignal, RawSignal, Signal, SignalType } from "./types.js";

/**
 * Convert msgpack map keys the way Holochain conductor responses require:
 * string and number keys pass through, byte-array keys are HoloHashes and are
 * returned in their Base64 string form. Shared by every transport
 * ({@link WsClient} and {@link TauriAppTransport}) so decoded responses match
 * byte for byte regardless of pipe.
 *
 * @internal
 */
export const holoHashMapKeyConverter = (key: unknown) => {
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
 * Turn an already-decoded raw signal into the {@link Signal} surfaced to
 * callers: system signals pass through; app signals have their inner payload
 * decoded. Shared by every transport so signal handling is identical whether
 * the bytes arrive over a websocket or Tauri IPC.
 *
 * @internal
 */
export function decodeSignal(rawSignal: unknown): Signal {
  assertHolochainSignal(rawSignal);

  if (rawSignal.type === SignalType.System) {
    return { type: SignalType.System, value: rawSignal.value } as Signal;
  }

  const encodedAppSignal = rawSignal.value;
  // In order to return readable content to the UI, the signal payload must also
  // be deserialized.
  const signal: AppSignal = {
    cell_id: encodedAppSignal.cell_id,
    zome_name: encodedAppSignal.zome_name,
    payload: decode(encodedAppSignal.signal),
  };
  return { type: SignalType.App, value: signal } as Signal;
}
