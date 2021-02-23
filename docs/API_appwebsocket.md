[back to API.md](API.md)


# `new AppWebsocket( client, timeout )`
A class for interacting with Conductor's app API.

- `client` - the websocket client used for transporting requests and responses
- `timeout` - an (optional) `number` that defaults to `15_000`

**Instance properties**

- `<AdminWebsocket>.client` - the websocket connection client that expects the `WsClient` interface.
- `<AdminWebsocket>.defaultTimeout` - the default timeout setting


## `AppWebsocket.connect( url, timeout?, signal_handler? )`
Create a new connection to the given URL.

- `url` - a `string`
- `timeout` - an (optional) `number`
- `signal_handler` - an (optional) `function` for handling app signals
  - `function ( signal ) { ... }`
  - [see Signal Object](API_wsclient.md#signal-object)

Returns a `Promise` for a new connected instance of `AppWebsocket`.


## `<AppWebsocket>.appInfo({ installed_app_id })`
Request the info about a given installed app.  The response is the same as when the app was
installed.

- `installed_app_id` - a `string`

Returns a `Promise` for the corresponding response.

### Response format
```javascript
{
    "installed_app_id": string,
    "cell_data": [
        [ [ buffer, buffer ] , string ],
        ...
    ]
}
```


## `<AppWebsocket>.callZome({ cell_id, zome_name, fn_name, payload, provenance, cap })`
Send a request to call a cell's zome function.

- `cell_id` - a 2 part `array` with
  - `[0]` - a `buffer` identifying the DNA
  - `[1]` - a `buffer` identifying the Agent
- `zome_name` - a `string`
- `fn_name` - a `string`
- `payload` - an `object`
- `provenance` - a `buffer`
- `cap` - a `buffer`

Returns a `Promise` for the corresponding response.

### Response format
```javascript
any
```
