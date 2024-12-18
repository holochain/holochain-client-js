<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [SessionCompletionDecisionType](./client.sessioncompletiondecisiontype.md)

## SessionCompletionDecisionType enum

Decision about an incomplete countersigning session.

**Signature:**

```typescript
export declare enum SessionCompletionDecisionType 
```

## Enumeration Members

<table><thead><tr><th>

Member


</th><th>

Value


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

Abandoned


</td><td>

`"Abandoned"`


</td><td>

Evidence found on the network that this session was abandoned and other agents have added to their chain without completing the session.


</td></tr>
<tr><td>

Complete


</td><td>

`"Complete"`


</td><td>

Evidence found on the network that this session completed successfully.


</td></tr>
<tr><td>

Failed


</td><td>

`"Failed"`


</td><td>

There were errors encountered while trying to resolve the session. Errors such as network errors are treated differently to inconclusive evidence. We don't want to force a decision when we're offline, for example. In this case, the resolution must be retried later and this attempt should not be counted.


</td></tr>
<tr><td>

Indeterminate


</td><td>

`"Indeterminate"`


</td><td>

No evidence, or inconclusive evidence, was found on the network. Holochain will not make an automatic decision until the evidence is conclusive.


</td></tr>
</tbody></table>
