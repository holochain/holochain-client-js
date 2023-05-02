[![Project](https://img.shields.io/badge/Project-Holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Discord](https://img.shields.io/badge/Discord-DEV.HC-blue.svg?style=flat-square)](https://discord.gg/k55DS5dmPH)
[![License: CAL 1.0](https://img.shields.io/badge/License-CAL%201.0-blue.svg)](https://github.com/holochain/cryptographic-autonomy-license)
![Integration Tests](https://github.com/holochain/holochain-client-js/actions/workflows/integration-test.yml/badge.svg?branch=main)
![Bundling Tests](https://github.com/holochain/holochain-client-js/actions/workflows/bundling-test.yml/badge.svg?branch=main)
[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)

# Holochain Client - JavaScript

A JavaScript client for the Holochain Conductor API (works with browsers as well as Nodejs).

## API Reference

[Complete API reference](./docs/client.md)

## Compatibility

**JS client v0.12.x** is compatible with **Holochain v0.1.x**.  

**JS client v0.14.x** is compatible with **Holochain v0.2.x**.
*As target, ES2020 or higher is required when bundling for production*.

## Installation

To install from NPM, run
```bash
npm install --save-exact @holochain/client
```

> This code is under beta development and you may wish to lock to an exact version of the library for that reason, as shown in the above command.

## Sample usage

### Use AppAgentWebsocket with implicit zome call signing
```typescript
import { AdminWebsocket, AppAgentWebsocket, CellType } from "@holochain/client";

const adminWs = await AdminWebsocket.connect("ws://127.0.0.1:65000");
const agent_key = await adminWs.generateAgentPubKey();
const role_name = "role";
const installed_app_id = "test-app";
const appInfo = await adminWs.installApp({
  agent_key,
  path: "path/to/happ/file",
  installed_app_id,
  membrane_proofs: {},
});
await adminWs.enableApp({ installed_app_id });
if (!(CellType.Provisioned in appInfo.cell_info[role_name][0])) {
  process.exit();
}
const { cell_id } = appInfo.cell_info[role_name][0][CellType.Provisioned];
await adminWs.authorizeSigningCredentials(cell_id);
await adminWs.attachAppInterface({ port: 65001 });
const appAgentWs = await AppAgentWebsocket.connect(
  "ws://127.0.0.1:65001",
  installed_app_id
);

let signalCb;
const signalReceived = new Promise<void>((resolve) => {
  signalCb = (signal) => {
    console.log("signal received", signal);
    // act on signal
    resolve();
  };
});

appAgentWs.on("signal", signalCb);

// trigger an emit_signal
await appAgentWs.callZome({
  role_name,
  zome_name: "zome",
  fn_name: "emitter",
  payload: null,
});
await signalReceived;

await appAgentWs.appWebsocket.client.close();
await adminWs.client.close();
```

### Use AppWebsocket with implicit zome call signing
```typescript
import { AdminWebsocket, AppWebsocket, CellType } from "@holochain/client";

const adminWs = await AdminWebsocket.connect("ws://127.0.0.1:65000");
const agent_key = await adminWs.generateAgentPubKey();
const installed_app_id = "test-app";
const appInfo = await adminWs.installApp({
  agent_key,
  path: "path/to/happ/file",
  installed_app_id,
  membrane_proofs: {},
});
await adminWs.enableApp({ installed_app_id });
if (!(CellType.Provisioned in appInfo.cell_info["role"][0])) {
  process.exit();
}
const { cell_id } = appInfo.cell_info["role"][0][CellType.Provisioned];
await adminWs.authorizeSigningCredentials(cell_id);
await adminWs.attachAppInterface({ port: 65001 });
const appWs = await AppWebsocket.connect("ws://127.0.0.1:65001");

let signalCb;
const signalReceived = new Promise<void>((resolve) => {
  signalCb = (signal) => {
    console.log("signal received", signal);
    // act on signal
    resolve();
  };
});

appWs.on("signal", signalCb);

// trigger an emit_signal
await appWs.callZome({
  cell_id,
  zome_name: "zome",
  fn_name: "emitter",
  provenance: agent_key,
  payload: null,
});
await signalReceived;

await appWs.client.close();
await adminWs.client.close();
```

### Managing zome call signing credentials in a pure JavaScript browser application

Here is a pattern to manage signing keys for signing zome calls when running pure JavaScript web hApps in a web browser:
```typescript
const cellIdB64 =
    encodeHashToBase64(cell_id[0]) + encodeHashToBase64(cell_id[1]);
// in case the zome call signing credentials are stored locally in the browser
const signingCredentialsJson = localStorage.getItem(cellIdB64);
let signingCredentials: SigningCredentials | null =
  signingCredentialsJson && JSON.parse(signingCredentialsJson);

if (!signingCredentials) {
  const [keyPair, signingKey] = generateSigningKeyPair();
  const capSecret = await admin.grantSigningKey(
    cell_id,
    { [GrantedFunctionsType.All]: null },
    signingKey
  );
  signingCredentials = {
    capSecret,
    keyPair,
    signingKey,
  };
}
setSigningCredentials(cell_id, signingCredentials);
// possibly store the zome call signing credentials locally in the browser
localStorage.setItem(cellIdB64, JSON.stringify(signingCredentials));
```

# Holochain Compatibility

See [default.nix](./default.nix) for the Holochain version this package is compatible with.

If updating the Holochain version included in holonix, please use `niv update` as explained in the
[Holochain Installation Guide](https://developer.holochain.org/install-advanced/#upgrading-the-holochain-version).

## Running tests

You need a version (`stable` toolchain) of Rust available.

You need `holochain` and `hc` on your path, best to get them from nix with `nix-shell`.

To perform the pre-requisite DNA compilation steps, and run the Nodejs test, run:
```bash
nix-shell
./run-test.sh
```

## Contribute

Holochain is an open source project.  We welcome all sorts of participation and are actively working on increasing surface area to accept it.  Please see our [contribution guidelines](/CONTRIBUTING.md) for our general practices and protocols on participating in the community, as well as specific expectations around things like code formatting, testing practices, continuous integration, etc.

* Connect with us on [Discord](https://discord.gg/k55DS5dmPH)

## License

 [![License: CAL 1.0](https://img.shields.io/badge/License-CAL%201.0-blue.svg)](https://github.com/holochain/cryptographic-autonomy-license)

Copyright (C) 2020-2023, Holochain Foundation

This program is free software: you can redistribute it and/or modify it under the terms of the license
provided in the LICENSE file (CAL-1.0).  This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
PURPOSE.
