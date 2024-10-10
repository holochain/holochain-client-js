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

## Installation

**JS client v0.19.x** is compatible with **Holochain v0.5.x**.

**JS client v0.18.x** is compatible with **Holochain v0.4.x**.

**JS client v0.17.x** is compatible with **Holochain v0.3.x**.

To install from NPM, run
```bash
npm install --save-exact @holochain/client
```

> This code is under beta development and you may wish to lock to an exact version of the library for that reason, as shown in the above command.

## Sample usage

### Use AppWebsocket with implicit zome call signing
```typescript
import {
  AdminWebsocket,
  AppWebsocket,
  CellType,
  type ActionHash,
  type CallZomeRequest,
} from "@holochain/client";

const adminWs = await AdminWebsocket.connect({
  url: new URL("ws://127.0.0.1:65000"),
  wsClientOptions: { origin: "my-happ" },
});
const agent_key = await adminWs.generateAgentPubKey();
const role_name = "foo";
const installed_app_id = "test-app";
const appInfo = await adminWs.installApp({
  agent_key,
  path: "./test/e2e/fixture/test.happ",
  installed_app_id,
  membrane_proofs: {},
});
await adminWs.enableApp({ installed_app_id });
if (!(CellType.Provisioned in appInfo.cell_info[role_name][0])) {
  throw new Error(`No cell found under role name ${role_name}`);
}
const { cell_id } = appInfo.cell_info[role_name][0][CellType.Provisioned];
await adminWs.authorizeSigningCredentials(cell_id);
await adminWs.attachAppInterface({ port: 65001, allowed_origins: "my-happ" });
const issuedToken = await adminWs.issueAppAuthenticationToken({
  installed_app_id,
});
const appWs = await AppWebsocket.connect({
  url: new URL("ws://127.0.0.1:65001"),
  token: issuedToken.token,
  wsClientOptions: { origin: "my-happ" },
});

const zomeCallPayload: CallZomeRequest = {
  cell_id,
  zome_name: "foo",
  fn_name: "foo",
  provenance: agent_key,
  payload: null,
};

const response: ActionHash = await appWs.callZome(zomeCallPayload, 30000);
console.log("zome call response is", response);

await appWs.client.close();
await adminWs.client.close();
```

### Subscribe to signals
```typescript
import { AdminWebsocket, AppWebsocket, CellType } from "@holochain/client";

const adminWs = await AdminWebsocket.connect({
  url: new URL("ws://127.0.0.1:65000"),
  wsClientOptions: { origin: "my-happ" },
});
const agent_key = await adminWs.generateAgentPubKey();
const role_name = "foo";
const installed_app_id = "test-app";
const appInfo = await adminWs.installApp({
  agent_key,
  path: "./test/e2e/fixture/test.happ",
  installed_app_id,
  membrane_proofs: {},
});
await adminWs.enableApp({ installed_app_id });
if (!(CellType.Provisioned in appInfo.cell_info[role_name][0])) {
  throw new Error(`No cell found under role name ${role_name}`);
}
const { cell_id } = appInfo.cell_info[role_name][0][CellType.Provisioned];
await adminWs.authorizeSigningCredentials(cell_id);
await adminWs.attachAppInterface({ port: 65001, allowed_origins: "my-happ" });
const issuedToken = await adminWs.issueAppAuthenticationToken({
  installed_app_id,
});
const appWs = await AppWebsocket.connect({
  url: new URL("ws://127.0.0.1:65001"),
  token: issuedToken.token,
  wsClientOptions: { origin: "my-happ" },
});

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
  zome_name: "foo",
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

Copyright (C) 2020-2024, Holochain Foundation

This program is free software: you can redistribute it and/or modify it under the terms of the license
provided in the LICENSE file (CAL-1.0).  This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
PURPOSE.
