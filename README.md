# holochain/conductor-api

[![Project](https://img.shields.io/badge/project-holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Forum](https://img.shields.io/badge/chat-forum%2eholochain%2enet-blue.svg?style=flat-square)](https://forum.holochain.org)
[![Chat](https://img.shields.io/badge/chat-chat%2eholochain%2enet-blue.svg?style=flat-square)](https://chat.holochain.org)

[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)
License: [![License: CAL 1.0](https://img.shields.io/badge/License-CAL%201.0-blue.svg)](https://github.com/holochain/cryptographic-autonomy-license)

A nodejs implementation of the Holochain conductor API.

# Holochain Compatibility

This version of `holochain-conductor-api` is currently working with `holochain/holochain` at commit:

[45dd3f827caea18f41f77486ca2c37149a18b4ca](https://github.com/holochain/holochain/commit/45dd3f827caea18f41f77486ca2c37149a18b4ca)

If updating this code, please make changes to the git `rev/sha` in two places:
These lines in `install-holochain.sh`
```
cargo install --force holochain --git https://github.com/holochain/holochain.git --rev 45dd3f827caea18f41f77486ca2c37149a18b4ca
cargo install --force dna_util --git https://github.com/holochain/holochain.git --rev 45dd3f827caea18f41f77486ca2c37149a18b4ca
```
and this line in `test/e2e/fixtures/zomes/foo/Cargo.toml`
```
hdk3 = { git = "https://github.com/holochain/holochain", rev = "45dd3f827caea18f41f77486ca2c37149a18b4ca", package = "hdk3" }
```

Notice the match between the SHA in both cases. These should always match.

## Running tests

```bash
nix-shell --run conductor-api-test
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
