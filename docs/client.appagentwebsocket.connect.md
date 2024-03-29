<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [AppAgentWebsocket](./client.appagentwebsocket.md) &gt; [connect](./client.appagentwebsocket.connect.md)

## AppAgentWebsocket.connect() method

Instance factory for creating AppAgentWebsockets.

**Signature:**

```typescript
static connect(installed_app_id: InstalledAppId, options?: WebsocketConnectionOptions): Promise<AppAgentWebsocket>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  installed\_app\_id | [InstalledAppId](./client.installedappid.md) | ID of the App to link to. |
|  options | [WebsocketConnectionOptions](./client.websocketconnectionoptions.md) | _(Optional)_ [WebsocketConnectionOptions](./client.websocketconnectionoptions.md) |

**Returns:**

Promise&lt;[AppAgentWebsocket](./client.appagentwebsocket.md)<!-- -->&gt;

A new instance of an AppAgentWebsocket.

