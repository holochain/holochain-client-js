<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [AppAgentWebsocket](./client.appagentwebsocket.md) &gt; [callZome](./client.appagentwebsocket.callzome.md)

## AppAgentWebsocket.callZome() method

Call a zome.

**Signature:**

```typescript
callZome(request: AppAgentCallZomeRequest, timeout?: number): Promise<CallZomeResponse>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  request | [AppAgentCallZomeRequest](./client.appagentcallzomerequest.md) | The zome call arguments. |
|  timeout | number | _(Optional)_ A timeout to override the default. |

**Returns:**

Promise&lt;[CallZomeResponse](./client.callzomeresponse.md)<!-- -->&gt;

The zome call's response.

