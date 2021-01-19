[back to API.md](API.md)


# `new WsClient( socket )`
A class for managing the websocket connection.

- `socket` - a WebSocket connection socket

**Instance properties**

- `<WsClient>.socket` - the websocket connection that expects the isomorphic-ws `WebSocket` interface.

## `WsClient.connect( url, signal_handler )`
Create a new connection to the given URL.

- `signal_handler` - an (optional) `function` for handling app signals
  - `function ( signal ) { ... }`

Returns a `Promise` for a new connected instance of `WsClient`.

### Signal Object

- `type` - a `string`
- `data` - an `object`
  - `cell_id` - a 2 part `array` with
    - `[0]` - a `buffer` identifying the DNA
    - `[1]` - a `buffer` identifying the Agent
  - `payload` - an `object`


## `<WsClient>.emitSignal( data )`
Send data as a signal.

- `data` - any data that can be encoded with `msgpack`


## `<WsClient>.request( data )`
Send data as a request.

- `data` - any data that can be encoded with `msgpack`

Returns a `Promise` for the corresponding response.


## `<WsClient>.close()`
Close the socket connection and return a `Promise` for the "close" event.


## `<WsClient>.awaitClose()`
Return a `Promise` for the "close" event.
