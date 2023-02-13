import { randomByteArray } from "../api/zome-call-signing.js";
import { ActionHash, AgentPubKey, EntryHash } from "../types.js";

/**
 * Generate a valid hash of a non-existing entry.
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @returns An {@link EntryHash}.
 *
 * @public
 */
export async function fakeEntryHash(): Promise<EntryHash> {
  const randomBytes = await randomByteArray(36);
  return new Uint8Array([0x84, 0x21, 0x24, ...randomBytes]);
}

/**
 * Generate a valid agent key of a non-existing agent.
 *
 * @returns An {@link AgentPubKey}.
 *
 * @public
 */
export async function fakeAgentPubKey(): Promise<AgentPubKey> {
  const randomBytes = await randomByteArray(36);
  return new Uint8Array([0x84, 0x20, 0x24, ...randomBytes]);
}

/**
 * Generate a valid hash of a non-existing action.
 *
 * @returns An {@link ActionHash}.
 *
 * @public
 */
export async function fakeActionHash(): Promise<ActionHash> {
  const randomBytes = await randomByteArray(36);
  return new Uint8Array([0x84, 0x29, 0x24, ...randomBytes]);
}

/**
 * Generate a valid hash of a non-existing Dna.
 *
 * @returns A {@link DnaHash}.
 *
 * @public
 */
export async function fakeDnaHash(): Promise<DnaHash> {
  const randomBytes = await randomByteArray(36);
  return new Uint8Array([0x84, 0x2d, 0x24, ...randomBytes]);
}
