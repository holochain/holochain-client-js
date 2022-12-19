import { encode } from "@msgpack/msgpack";
import { Action, ActionType, Entry, Record } from "../hdk/index.js";
import { ActionHash, AgentPubKey, EntryHash } from "../types.js";

/** From https://github.com/holochain/holochain/blob/develop/crates/holo_hash/src/hash_type/primitive.rs */
export function fakeEntryHash(): EntryHash {
  return new Uint8Array([0x84, 0x21, 0x24, ...randomByteArray(36)]);
}

export function fakeAgentPubKey(): AgentPubKey {
  return new Uint8Array([0x84, 0x20, 0x24, ...randomByteArray(36)]);
}

export function fakeActionHash(): ActionHash {
  return new Uint8Array([0x84, 0x29, 0x24, ...randomByteArray(36)]);
}

export function fakeCreateAction(): Action {
  return {
    type: ActionType.Create,
    author: fakeAgentPubKey(),
    timestamp: Date.now() * 1000,
    action_seq: 10,
    prev_action: fakeActionHash(),
    entry_type: {
      App: {
        entry_index: 0,
        visibility: { Public: null },
        zome_index: 0,
      },
    },
    entry_hash: fakeEntryHash(),
  };
}

export function fakeEntry(): Entry {
  return {
    entry: encode("some data"),
    entry_type: "App",
  };
}

export function fakeRecord(
  entry: Entry = fakeEntry(),
  action: Action = fakeCreateAction()
): Record {
  return {
    entry: {
      Present: entry,
    },
    signed_action: {
      hashed: {
        content: action,
        hash: fakeActionHash(),
      },
      signature: randomByteArray(256),
    },
  };
}

function randomByteArray(n: number): Uint8Array {
  const QUOTA = 65536;
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i += QUOTA) {
    crypto.getRandomValues(a.subarray(i, i + Math.min(n - i, QUOTA)));
  }
  return a;
}
