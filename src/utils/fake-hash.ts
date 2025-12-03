import { range } from "lodash-es";
import { randomByteArray } from "../api/zome-call-signing.js";
import { DnaHash, ActionHash, AgentPubKey, EntryHash } from "../types.js";
import { dhtLocationFrom32 } from "./hash-parts.js";

async function fakeValidHash<T extends Uint8Array>(
  prefix: number[],
  coreByte: number | undefined,
): Promise<Uint8Array> {
  let core;
  if (coreByte === undefined) {
    core = await randomByteArray(32);
  } else {
    core = Uint8Array.from(range(0, 32).map(() => coreByte));
  }
  const checksum = dhtLocationFrom32(core);

  return new Uint8Array([...prefix, ...core, ...Array.from(checksum)]) as T;
}

/**
 * Generate a valid hash of a non-existing entry.
 *
 * From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs
 *
 * @param coreByte - Optionally specify a byte to repeat for all core 32 bytes. If undefined will generate random core 32 bytes.
 * @returns An {@link EntryHash}.
 *
 * @public
 */
export async function fakeEntryHash(
  coreByte: number | undefined = undefined,
): Promise<EntryHash> {
  return fakeValidHash<EntryHash>([0x84, 0x21, 0x24], coreByte);
}

/**
 * Generate a valid agent key of a non-existing agent.
 *
 * @param coreByte - Optionally specify a byte to repeat for all core 32 bytes. If undefined will generate random core 32 bytes.
 * @returns An {@link AgentPubKey}.
 *
 * @public
 */
export async function fakeAgentPubKey(
  coreByte: number | undefined = undefined,
): Promise<AgentPubKey> {
  return fakeValidHash<AgentPubKey>([0x84, 0x20, 0x24], coreByte);
}

/**
 * Generate a valid hash of a non-existing action.
 *
 * @param coreByte - Optionally specify a byte to repeat for all core 32 bytes. If undefined will generate random core 32 bytes.
 * @returns An {@link ActionHash}.
 *
 * @public
 */
export async function fakeActionHash(
  coreByte: number | undefined = undefined,
): Promise<ActionHash> {
  return fakeValidHash<ActionHash>([0x84, 0x29, 0x24], coreByte);
}

/**
 * Generate a valid hash of a non-existing DNA.
 *
 * @param coreByte - Optionally specify a byte to repeat for all core 32 bytes. If undefined will generate random core 32 bytes.
 * @returns A {@link DnaHash}.
 *
 * @public
 */
export async function fakeDnaHash(
  coreByte: number | undefined = undefined,
): Promise<DnaHash> {
  return fakeValidHash<DnaHash>([0x84, 0x2d, 0x24], coreByte);
}
