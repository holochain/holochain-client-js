import { decode } from "@msgpack/msgpack";
import { encodeHashToBase64 } from "../../utils/base64.js";
import { HolochainError } from "../common.js";
import { DecodedSignal, RawSignal, SignalType } from "./client-types.js";

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
    [SignalType.App, SignalType.AppDirect, SignalType.System].some(
      (type) => signal.type === type,
    )
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
 * Turn an already-decoded raw signal into the {@link DecodedSignal} surfaced to
 * callers: system signals pass through; app signals have their inner payload
 * decoded; direct signals have their payload turned into bytes. Shared by
 * every transport so signal handling is identical whether the bytes arrive
 * over a websocket or Tauri IPC.
 *
 * @internal
 */
export function decodeSignal(rawSignal: unknown): DecodedSignal {
  assertHolochainSignal(rawSignal);

  switch (rawSignal.type) {
    case SignalType.System:
      return { type: SignalType.System, value: rawSignal.value };
    case SignalType.AppDirect:
      return {
        type: SignalType.AppDirect,
        value: {
          cell_id: rawSignal.value.cell_id,
          from_agent: rawSignal.value.from_agent,
          // Rust serializes the opaque `Vec<u8>` payload as a msgpack array
          // of integers. Hand callers bytes either way.
          signal: Uint8Array.from(rawSignal.value.signal),
        },
      };
    case SignalType.App: {
      const encodedAppSignal = rawSignal.value;
      return {
        type: SignalType.App,
        value: {
          cell_id: encodedAppSignal.cell_id,
          zome_name: encodedAppSignal.zome_name,
          // In order to return readable content to the UI, the signal payload
          // must also be deserialized. The wire type is the msgpack-encoded
          // byte string, so what callers receive here is the decoded value,
          // typed as `unknown` because only the emitting zome knows its shape.
          signal: decode(encodedAppSignal.signal),
        },
      };
    }
  }
}
