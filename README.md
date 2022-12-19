[![Project](https://img.shields.io/badge/Project-Holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Forum](https://img.shields.io/badge/Forum-forum%2eholochain%2enet-blue.svg?style=flat-square)](https://forum.holochain.org)
[![License: CAL 1.0](https://img.shields.io/badge/License-CAL%201.0-blue.svg)](https://github.com/holochain/cryptographic-autonomy-license)
![Test](https://github.com/holochain/holochain-client-js/actions/workflows/test.yml/badge.svg?branch=main)
[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)

# Holochain Client - JavaScript

A JavaScript client for the Holochain Conductor API (works with browsers as well as Nodejs).

> Holochain's Conductor API is under active development. This client package tracks that development fairly closely but sometimes gets behind.

## Installation

To install from NPM, run
```bash
npm install --save-exact @holochain/client
```

> This code is under beta development and you may wish to lock to an exact version of the library for that reason, as shown in the above command.

## Sample usage

### Use AdminWebsocket
```typescript
  const admin = await AdminWebsocket.connect(`ws://127.0.0.1:8000`, TIMEOUT)
  const agentPubKey = await admin.generateAgentPubKey()
```

### Use AppWebsocket with implicit zome call signing
```typescript
  const signalCb = (signal: AppSignal) => {
    // impl...
    resolve()
  }

  // generate and authorize new key pair for signing zome calls,
  // specifying zomes and functions to be authorized
  await authorizeNewSigningKeyPair(admin, cell_id, [
    ["test_zome", "test_emitter_fn"],
  ]);

  const TIMEOUT = 12000
  // default timeout is set to 12000
  const client = await AppWebsocket.connect(`ws://127.0.0.1:${appPort}`, TIMEOUT, signalCb)

  // default timeout set here (30000) will overwrite the defaultTimeout(12000) set above
  await client.callZome({
   cell_id,
   zome_name: "test_zome",
   fn_name: 'test_emitter_fn',
   provenance: agentPubKey,
   payload: null,
  }, 30000)
```

### Use AppAgentWebsocket
```typescript
  const signalCb = (signal: AppSignal) => {
    // impl...
    resolve()
  }

  // generate and authorize new key pair for signing zome calls,
  // specifying zomes and functions to be authorized
  await authorizeNewSigningKeyPair(admin, cell_id, [
    ["test_zome", "test_emitter_fn"],
  ]);

  const TIMEOUT = 12000
  // default timeout is set to 12000
  const appWs = await AppWebsocket.connect(`ws://127.0.0.1:${appPort}`, 12000, signalCb)

  const client = new AppAgentWebsocket(appWs, 'installed_app_id')

  // default timeout set here (30000) will overwrite the defaultTimeout(12000) set above
  await client.callZome({
   role_name: 'dnas_role_name', // role_name is unique per app, so you can unambiguously identify your dna with role_name in this client
   zome_name: "test_zome",
   fn_name: 'test_emitter_fn',
   payload: null,
  }, 30000)
```

## API Reference

See [docs/API.md](docs/API.md)


# Holochain Compatibility

See [default.nix](./default.nix) for the Holochain version this package is compatible with.

If updating the Holochain version included in holonix, please use `niv update` as explained in the
[Holochain Installation Guide](https://developer.holochain.org/install/#upgrading-the-holochain-version).

## Running tests

You need a version (`stable` toolchain) of Rust available.

You need `holochain` and `hc` on your path, best to get them from nix with `nix-shell`.

To perform the pre-requisite DNA compilation steps, and run the Nodejs test, run:
```bash
nix-shell
npm run build
./run-test.sh
```

## Contribute

Holochain is an open source project.  We welcome all sorts of participation and are actively working on increasing surface area to accept it.  Please see our [contribution guidelines](/CONTRIBUTING.md) for our general practices and protocols on participating in the community, as well as specific expectations around things like code formatting, testing practices, continuous integration, etc.

* Connect with us on our [forum](https://forum.holochain.org)

## License

 [![License: CAL 1.0](https://img.shields.io/badge/License-CAL%201.0-blue.svg)](https://github.com/holochain/cryptographic-autonomy-license)

Copyright (C) 2020-2023, Holochain Foundation

This program is free software: you can redistribute it and/or modify it under the terms of the license
provided in the LICENSE file (CAL-1.0).  This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
PURPOSE.
