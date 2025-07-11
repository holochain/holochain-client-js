<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [AppWebsocket](./client.appwebsocket.md) &gt; [agentInfo](./client.appwebsocket.agentinfo.md)

## AppWebsocket.agentInfo() method

Request the currently known agents of the app.

**Signature:**

```typescript
agentInfo(req: AgentInfoRequest, timeout?: number): Promise<AgentInfoResponse>;
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

req


</td><td>

[AgentInfoRequest](./client.agentinforequest.md)


</td><td>

An array of DNA hashes or null


</td></tr>
<tr><td>

timeout


</td><td>

number


</td><td>

_(Optional)_


</td></tr>
</tbody></table>
**Returns:**

Promise&lt;[AgentInfoResponse](./client.agentinforesponse.md)<!-- -->&gt;

The app's agent infos as JSON string.

