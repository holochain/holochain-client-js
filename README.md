# holochain/conductor-api

[![Project](https://img.shields.io/badge/project-holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Forum](https://img.shields.io/badge/chat-forum%2eholochain%2enet-blue.svg?style=flat-square)](https://forum.holochain.org)
[![Chat](https://img.shields.io/badge/chat-chat%2eholochain%2enet-blue.svg?style=flat-square)](https://chat.holochain.org)

[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)
License: [![License: CAL 1.0](https://img.shields.io/badge/License-CAL%201.0-blue.svg)](https://github.com/holochain/cryptographic-autonomy-license)

A nodejs implementation of the Holochain conductor API.

# Conductor API documentation

Holochain's conductor API is under active development.  This node module tracks that development fairly closely but sometimes gets behind.

# Install

To install from NPM, run
```bash
npm install --save-exact @holochain/conductor-api
```

> Note, this code is still under alpha development and npm releases are pre-releases with `dev` tags meaning they will not use full semantic versioning, and you may wish to lock to an exact version of the library for that reason, as shown in the above command.

## Sample usage

### Use AdminWebsocket
```
  const admin = await AdminWebsocket.connect(`http://localhost:8000`, TIMEOUT)
  await admin.generateAgentPubKey()
```

### Use AppWebsocket
```
  const signalCb = (signal: AppSignal) => {
    // impl...
    resolve()
  }

  const TIMEOUT = 12000
  // default timeout is set to 12000
  const [installed_app_id, cell_id, _nick, client] = await AppWebsocket.connect(`http://localhost:${appPort}`, 12000, signalCb)

  // default timeout set here (30000) will overwrite the defaultTimeout(12000) set above
  await client.callZome({
   cap: null,
   cell_id,
   zome_name: "test_zome",
   fn_name: 'test_emitter_fn',
   provenance: fakeAgentPubKey('TODO'),
   payload: null,
  }, 30000)
```

# Holochain Compatibility

This version of `holochain-conductor-api` is currently working with `holochain/holochain` at commit:

[ea026def01d1573d5e0edfb7f4e3e9453f88c43e](https://github.com/holochain/holochain/commit/ea026def01d1573d5e0edfb7f4e3e9453f88c43e) (Jan 14, 2021)

If updating this code, please make changes to the git `rev/sha` in 3 places:
1. Here in the README above ^^
2. This line in `install-holochain.sh`
```bash
REV=ea026def01d1573d5e0edfb7f4e3e9453f88c43e
```
3. and this line in `test/e2e/fixtures/zomes/foo/Cargo.toml`
```
hdk3 = { git = "https://github.com/holochain/holochain", rev = "ea026def01d1573d5e0edfb7f4e3e9453f88c43e", package = "hdk3" }
```

Notice the match between the SHA in both cases. These should always match.

## Running tests

You need a version (`stable` toolchain) of Rust available.

You would need `holochain` and `dna-util` on your path, best to use the specific versions that this code requires. To use `cargo` to install them, run:
```bash
./install-holochain.sh
```

To perform the pre-requisite DNA compilation steps, and run the nodejs test, run:
```bash
./run-test.sh
```

## Contribute
Holochain is an open source project.  We welcome all sorts of participation and are actively working on increasing surface area to accept it.  Please see our [contributing guidelines](/CONTRIBUTING.md) for our general practices and protocols on participating in the community, as well as specific expectations around things like code formatting, testing practices, continuous integration, etc.

* Connect with us on our [forum](https://forum.holochain.org)

## License
 [![License: CAL 1.0](https://img.shields.io/badge/License-CAL%201.0-blue.svg)](https://github.com/holochain/cryptographic-autonomy-license)

Copyright (C) 2020, Holochain Foundation

This program is free software: you can redistribute it and/or modify it under the terms of the license
provided in the LICENSE file (CAL-1.0).  This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
PURPOSE.
