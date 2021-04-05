[back to API.md](API.md)


# `new AdminWebsocket( client, timeout )`
A class for interacting with Conductor's administrative API.

- `client` - the websocket client used for transporting requests and responses
- `timeout` - an (optional) `number` that defaults to `15_000`

**Instance properties**

- `<AdminWebsocket>.client` - the websocket connection client that expects the `WsClient` interface.
- `<AdminWebsocket>.defaultTimeout` - the default timeout setting


## `AdminWebsocket.connect( url, timeout? )`
Create a new connection to the given URL.

- `url` - a `string` used as the connection address
- `timeout` - an (optional) `number` used as the timeout for requests

Returns a `Promise` for a new connected instance of `AdminWebsocket`.


## `<AdminWebsocket>.activateApp({ installed_app_id })`
Send a request to activate an installed app.

- `installed_app_id` - a `string`

Returns a `Promise` for the corresponding response.

### Response format
```javascript
null
```


## `<AdminWebsocket>.attachAppInterface({ port })`
Send a request to open the given port for `AppWebsocket` connections.

- `port` - a `number` indicating the desired port

Returns a `Promise` for the corresponding response.

### Response format
```javascript
{
    "port": number,
}
```


## `<AdminWebsocket>.deactivateApp({ installed_app_id })`
Send a request to deactivate a running app.

- `installed_app_id` - a `string`

Returns a `Promise` for the corresponding response.

### Response format
```javascript
null
```


## `<AdminWebsocket>.dumpState({ cell_id })`
Request the current state of a given App cell.

- `cell_id` - a 2 part `array` with
  - `[0]` - a `buffer` identifying the DNA
  - `[1]` - a `buffer` identifying the Agent

Returns a `Promise` for the corresponding response.

### Response format
```javascript
[
    {
        "element": {
            "signature": buffer,
            "header_address": buffer,
            "header": object,
            "entry": object?
        }
    },
    ...
]
```


## `<AdminWebsocket>.generateAgentPubKey()`
Request a new agent to be created.

Returns a `Promise` for the corresponding response.

### Response format
```javascript
buffer
```

## `<AdminWebsocket>.registerDna({ source as  path | bundle | hash, uid?, properties? })`
Request a Dna to be registered in the database for later installation.
Note: if a hash is passed as the dna source, then you must pass a uid or a properties
- dna source as one of the following named properties:
  - `path` -a `string` of path to a DNA bundle file
  - `hash` - a `string` of a registered DNA (assumes either or both uid and properties set)
  - `bundle` - an `object` with properties
    - `manifest` - an `object` with properties
      - `name` -a `string`
      - `uid` - an (optional) `string`
      - `properties` - an (optional) `object`
      - `zomes` - an `array` of zome manifest `object` that have properties
        - `name` a `string`
        - `hash` an (optional) `string`
        - a zome location `object` as one of the following named properties:
          - `bundled` - an `string` which is a key to the zome data in the resources map
          - `path` - a `string` path to zome data in a file
          - `url` - a `string` url to the zome data file
    - `resources` - an `object` with keys storing zome data
- `uid` - an (optional) `string` which overrides the DNA manifest `uid`
- `properties` - an (optional) `object` which overrides the DNA manifest `properties`

Returns a `Promise` for the corresponding response.

### Response format
```javascript
buffer  // hash of DNA registered
```

## `<AdminWebsocket>.installAppBundle({ installed_app_id, source as path | bundle | hash, uid?, properties? })`
Request a hApp to be installed using the given source, and optional uid and properties.
- `installed_app_id` - a `string`
- bundle source as one  of the following named properties:
  - `path` -a `string`  of path to an App bundle file
  - `hash` - a `string`
  - `bundle` - an `object` with properties
    - `manifest` -an `object` with properties
      - `name` - a `string`
      - `uid` - an (optional) `string`
      - `properties` - an (optional) `object`
      - `zomes` - an array of `object` with properties
        - `name` - a `string`
        - `hash` - an optional b64 encoded `string`
        - zome location as one of:
          - `bundled` - a `string` path to a wasm in resources of this bundle
          - `path` - a `string` path to an external wasm file
          - `url` - a `string` url to an external wasm file
    - `resources` - an `object` with keys storing wasm data
Returns a `Promise` for the corresponding response.

### Response format
installedApp `object` with properties:
```javascript
{
    "installed_app_id": string,
    "slots": {
        [key: string]: {
            base_cell_id: [buffer, buffer],  // CellId
            is_provisioned: boolean,
            clone_limit: number,
            clones: [[buffer, buffer]], // array of CellIds
        }
    }
}
```

## `<AdminWebsocket>.installApp({ installed_app_id, agent_key, dnas })`
Request a new App to be created using the given Agent and DNAs.

- `installed_app_id` - a `string`
- `agent_key` - a `buffer`
- `dnas` - an `array` of `object` with properties
  - `hash` - a `string`
  - `nick` - a `string`
  - `membrane_proof` - an (optional) `buffer`

Returns a `Promise` for the corresponding response.

### Response format
installedApp `object` with properties:
```javascript
{
    "installed_app_id": string,
    "slots": {
        [key: string]: {
            base_cell_id: [buffer, buffer],  // CellId
            is_provisioned: boolean,
            clone_limit: number,
            clones: [[buffer, buffer]], // array of CellIds
        }
    }
}
```

## `<AdminWebsocket>.listDnas()`
Request the list of DNAs that this Conductor has.

Returns a `Promise` for the corresponding response.

### Response format
```javascript
[ buffer, ... ]
```


## `<AdminWebsocket>.listCellIds()`
Request the list of cells that this Conductor has.

Returns a `Promise` for the corresponding response.

### Response format
```javascript
[ [ buffer, buffer ], ... ]
```


## `<AdminWebsocket>.listActiveApps()`
Request the list of actived apps that this Conductor has.

Returns a `Promise` for the corresponding response.

### Response format
```javascript
[ buffer, ... ]
```


## `<AdminWebsocket>.requestAgentInfo({ cell_id })`
Request the list of stored agent information for the given cell.

- `cell_id` - a 2 part `array` with
  - `[0]` - a `buffer` identifying the DNA
  - `[1]` - a `buffer` identifying the Agent

Returns a `Promise` for the corresponding response.

### Response format
```javascript
[
    {
        "agent": buffer,
        "signature": buffer,
        "agent_info": buffer
    },
    ...
]
```


## `<AdminWebsocket>.addAgentInfo({ agent_infos })`
Send a request to add new agent info.

- `agent_infos` - an `array` of `object` with properties
  - `agent` - a `buffer`
  - `signature` - a `buffer`
  - `agent_info` - a `buffer`

Returns a `Promise` for the corresponding response.

### Response format
```javascript
?
```
