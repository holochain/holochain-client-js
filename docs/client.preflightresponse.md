<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [PreflightResponse](./client.preflightresponse.md)

## PreflightResponse interface


**Signature:**

```typescript
export interface PreflightResponse 
```

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[agent\_state](./client.preflightresponse.agent_state.md)


</td><td>


</td><td>

[CountersigningAgentState](./client.countersigningagentstate.md)


</td><td>

The chain state declaration for the agent that produced this response.


</td></tr>
<tr><td>

[request](./client.preflightresponse.request.md)


</td><td>


</td><td>

[PreflightRequest](./client.preflightrequest.md)


</td><td>

The request associated with this response.


</td></tr>
<tr><td>

[signature](./client.preflightresponse.signature.md)


</td><td>


</td><td>

[Signature](./client.signature.md)


</td><td>

The signature of this response, by the agent that created it.


</td></tr>
</tbody></table>
