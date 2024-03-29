<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [fakeDnaHash](./client.fakednahash.md)

## fakeDnaHash() function

Generate a valid hash of a non-existing DNA.

**Signature:**

```typescript
export declare function fakeDnaHash(coreByte?: number | undefined): Promise<DnaHash>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  coreByte | number \| undefined | _(Optional)_ Optionally specify a byte to repeat for all core 32 bytes. If undefined will generate random core 32 bytes. |

**Returns:**

Promise&lt;[DnaHash](./client.dnahash.md)<!-- -->&gt;

A [DnaHash](./client.dnahash.md)<!-- -->.

