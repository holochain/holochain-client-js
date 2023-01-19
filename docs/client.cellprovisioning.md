<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [CellProvisioning](./client.cellprovisioning.md)

## CellProvisioning type


<b>Signature:</b>

```typescript
export declare type CellProvisioning = {
    create: {
        deferred: boolean;
    };
} | {
    create_clone: {
        deferred: boolean;
    };
} | {
    use_existing: {
        deferred: boolean;
    };
} | {
    create_if_no_exists: {
        deferred: boolean;
    };
} | {
    disabled: Record<string, never>;
};
```