import { randomByteArray } from "../api/zome-call-signing.js";
import { ActionHash, AgentPubKey, EntryHash } from "../types.js";

/** From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs */
export async function fakeEntryHash(): Promise<EntryHash> {
  const randomBytes = await randomByteArray(36);
  return new Uint8Array([0x84, 0x21, 0x24, ...randomBytes]);
}

export async function fakeAgentPubKey(): Promise<AgentPubKey> {
  const randomBytes = await randomByteArray(36);
  return new Uint8Array([0x84, 0x20, 0x24, ...randomBytes]);
}

export async function fakeActionHash(): Promise<ActionHash> {
  const randomBytes = await randomByteArray(36);
  return new Uint8Array([0x84, 0x29, 0x24, ...randomBytes]);
}
