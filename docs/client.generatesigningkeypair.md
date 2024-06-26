<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [generateSigningKeyPair](./client.generatesigningkeypair.md)

## generateSigningKeyPair() function

Generates a key pair for signing zome calls.

**Signature:**

```typescript
generateSigningKeyPair: (agentPubKey?: AgentPubKey) => Promise<[KeyPair, AgentPubKey]>
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

agentPubKey


</td><td>

[AgentPubKey](./client.agentpubkey.md)


</td><td>

_(Optional)_ The agent pub key to take 4 last bytes (= DHT location) from (optional).


</td></tr>
</tbody></table>
**Returns:**

Promise&lt;\[KeyPair, [AgentPubKey](./client.agentpubkey.md)<!-- -->\]&gt;

The signing key pair and an agent pub key based on the public key.

