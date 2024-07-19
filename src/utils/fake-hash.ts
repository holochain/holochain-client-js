import { range } from "lodash-es";
import { randomByteArray } from "../api/zome-call-signing.js";
import { DnaHash, ActionHash, AgentPubKey, EntryHash } from "../types.js";

/**
 * Generate a valid hash of a non-existing entry.
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param coreByte - Optionally specify a byte to repeat for all core 32 bytes. If undefined will generate random core 32 bytes.
 * @returns An instance of EntryHash.
 *
 * @public
 */
export async function fakeEntryHash(
  coreByte: number | undefined = undefined
): Promise<EntryHash> {
  return new EntryHash(
    coreByte
      ? Uint8Array.from(range(0, 32).map(() => coreByte))
      : await randomByteArray(32)
  );
}

/**
 * Generate a valid agent key of a non-existing agent.
 *
 * @param coreByte - Optionally specify a byte to repeat for all core 32 bytes. If undefined will generate random core 32 bytes.
 * @returns An instance ofAgentPubKey.
 *
 * @public
 */
export async function fakeAgentPubKey(
  coreByte: number | undefined = undefined
): Promise<AgentPubKey> {
  return new AgentPubKey(
    coreByte
      ? Uint8Array.from(range(0, 32).map(() => coreByte))
      : await randomByteArray(32)
  );
}

/**
 * Generate a valid hash of a non-existing action.
 *
 * @param coreByte - Optionally specify a byte to repeat for all core 32 bytes. If undefined will generate random core 32 bytes.
 * @returns An instance of ActionHash.
 *
 * @public
 */
export async function fakeActionHash(
  coreByte: number | undefined = undefined
): Promise<ActionHash> {
  return new ActionHash(
    coreByte
      ? Uint8Array.from(range(0, 32).map(() => coreByte))
      : await randomByteArray(32)
  );
}

/**
 * Generate a valid hash of a non-existing DNA.
 *
 * @param coreByte - Optionally specify a byte to repeat for all core 32 bytes. If undefined will generate random core 32 bytes.
 * @returns A instance of DnaHash.
 *
 * @public
 */
export async function fakeDnaHash(
  coreByte: number | undefined = undefined
): Promise<DnaHash> {
  return new DnaHash(
    coreByte
      ? Uint8Array.from(range(0, 32).map(() => coreByte))
      : await randomByteArray(32)
  );
}
