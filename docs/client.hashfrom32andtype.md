<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [hashFrom32AndType](./client.hashfrom32andtype.md)

## hashFrom32AndType() function

Generate full hash from a core hash (middle 32 bytes) and hash type label

From https://github.com/holochain/holochain/blob/develop/crates/holo\_hash/src/hash\_type/primitive.rs

**Signature:**

```typescript
export declare function hashFrom32AndType(hashCore: AgentPubKey | EntryHash | ActionHash, hashType: "Agent" | "Entry" | "Dna" | "Action" | "External"): Uint8Array;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  hashCore | [AgentPubKey](./client.agentpubkey.md) \| [EntryHash](./client.entryhash.md) \| [ActionHash](./client.actionhash.md) | The core 32 bytes of the hash. |
|  hashType | "Agent" \| "Entry" \| "Dna" \| "Action" \| "External" | The type of the hash. |

**Returns:**

Uint8Array

The full 39 byte hash.

