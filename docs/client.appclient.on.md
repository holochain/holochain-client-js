<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [AppClient](./client.appclient.md) &gt; [on](./client.appclient.on.md)

## AppClient.on() method

**Signature:**

```typescript
on<Name extends keyof AppEvents>(eventName: Name | readonly Name[], listener: SignalCb): UnsubscribeFunction;
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

eventName


</td><td>

Name \| readonly Name\[\]


</td><td>


</td></tr>
<tr><td>

listener


</td><td>

[SignalCb](./client.signalcb.md)


</td><td>


</td></tr>
</tbody></table>
**Returns:**

UnsubscribeFunction

