import { randomByteArray } from "../api/zome-call-signing.js";
import { DnaHash, ActionHash, AgentPubKey, EntryHash } from "../types.js";
import { dhtLocationFrom32 } from "./hash-parts.js";

async function fakeValidHash<T extends Uint8Array>(
  prefix: number[]
): Promise<Uint8Array> {
  const core = await randomByteArray(32);
  const checksum = dhtLocationFrom32(core);

  return new Uint8Array([...prefix, ...core, ...Array.from(checksum)]) as T;
}

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
  return fakeValidHash<EntryHash>([0x84, 0x21, 0x24]);
}

/**
 * Generate a valid agent key of a non-existing agent.
 *
 * @returns An {@link AgentPubKey}.
 *
 * @public
 */
export async function fakeAgentPubKey(): Promise<AgentPubKey> {
  return fakeValidHash<AgentPubKey>([0x84, 0x20, 0x24]);
}

/**
 * Generate a valid hash of a non-existing action.
 *
 * @returns An {@link ActionHash}.
 *
 * @public
 */
export async function fakeActionHash(): Promise<ActionHash> {
  return fakeValidHash<ActionHash>([0x84, 0x29, 0x24]);
}

/**
 * Generate a valid hash of a non-existing DNA.
 *
 * @returns A {@link DnaHash}.
 *
 * @public
 */
export async function fakeDnaHash(): Promise<DnaHash> {
  return fakeValidHash<DnaHash>([0x84, 0x2d, 0x24]);
}
