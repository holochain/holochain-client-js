[back to API.md](API.md)


# `new AppAgentWebsocket( appWs )`
A class for interacting with Conductor's app API, restricted to a specific installed app.
This is useful for simplifying zome and app info calls, and especially because it shares an interface (`AppAgentClient`) with the holo WebSdk client, meaning you can use this client to write the majority of your UI agnostic as to wether it's in a pure holochain or holo context.

- `appWs` - an instance of AppWebsocket, connecting to an app port on your conductor

**Instance properties**

- `<AppAgentWebsocket>.appWebsocket` - the AppWebsocket instance that all calls are forwarded to.
- `<AppAgentWebsocket>.installedAppId` - the InstalledAppId that all calls are restricted to


## `<AppAgentWebsocket>.appInfo()`
Request the info about the installed app. The response is the same as when the app was
installed.

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


## `<AppAgentWebsocket>.callZome({ cell_id?, role_id?, zome_name, fn_name, payload, provenance, cap_secret })`
Send a request to call a cell's zome function.

- `cell_id?` - an optional 2 part `array` with
  - `[0]` - a `buffer` identifying the DNA
  - `[1]` - a `buffer` identifying the Agent
- `role_id?` - an optional string, specifying the role_id of the dna you want to call
- `zome_name` - a `string`
- `fn_name` - a `string`
- `payload` - an `object`
- `provenance` - a `buffer`
- `cap_secret` - a `buffer`

This call will throw if you provide neither `cell_id` or `role_id`.

Returns a `Promise` for the corresponding response.

### Response format
```javascript
any
```

## `<AppAgentWebsocket>.createCloneCell({ role_id, modifiers,  })`
Send a request to call a cell's zome function.
- `role_id` - the role id of the dna to be cloned
-  `modifiers`: an object
```
{
    network_seed?: NetworkSeed;
    /**
     * Any arbitrary application properties can be included in this object to
     * override the DNA properties.
     */
    properties?: DnaProperties;
    /**
     * The time used to denote the origin of the network, used to calculate
     * time windows during gossip.
     * All Action timestamps must come after this time.
     */
    origin_time?: Timestamp;
  }
```
- `membrane_proof?` - an optional membrane proof
- `name?` - an optional name for the cloned dna


Returns a `Promise` containing the cloned cell

### Response format
```javascript
{
  cell_id: CellId,
  role_id: RoleId
}
```

## `<AppAgentWebsocket>.archiveClonedCell({ clone_cell_id })`


- `clone_cell_id?` - either a `CellId` (see `callZome` above) or a `RoleId` string, specifying the cell to be archived

Returns a void `Promise`.
