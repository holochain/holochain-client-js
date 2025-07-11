<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@holochain/client](./client.md) &gt; [WsClient](./client.wsclient.md)

## WsClient class

A WebSocket client which can make requests and receive responses, as well as send and receive signals.

Uses Holochain's WireMessage for communication.

**Signature:**

```typescript
export declare class WsClient extends Emittery 
```
**Extends:** Emittery

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(socket, url, options)](./client.wsclient._constructor_.md)


</td><td>


</td><td>

Constructs a new instance of the `WsClient` class


</td></tr>
</tbody></table>

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

[options](./client.wsclient.options.md)


</td><td>


</td><td>

[WsClientOptions](./client.wsclientoptions.md) \| undefined


</td><td>


</td></tr>
<tr><td>

[socket](./client.wsclient.socket.md)


</td><td>


</td><td>

IsoWebSocket


</td><td>


</td></tr>
<tr><td>

[url](./client.wsclient.url.md)


</td><td>


</td><td>

URL \| undefined


</td><td>


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[authenticate(request)](./client.wsclient.authenticate.md)


</td><td>


</td><td>

Authenticate the client with the conductor.

This is only relevant for app websockets.


</td></tr>
<tr><td>

[close(code)](./client.wsclient.close.md)


</td><td>


</td><td>

Close the websocket connection.


</td></tr>
<tr><td>

[connect(url, options)](./client.wsclient.connect.md)


</td><td>

`static`


</td><td>

Instance factory for creating WsClients.


</td></tr>
<tr><td>

[emitSignal(data)](./client.wsclient.emitsignal.md)


</td><td>


</td><td>

Sends data as a signal.


</td></tr>
<tr><td>

[request(request)](./client.wsclient.request.md)


</td><td>


</td><td>

Send requests to the connected websocket.


</td></tr>
</tbody></table>
