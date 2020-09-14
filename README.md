# holochain/conductor-api

[![Project](https://img.shields.io/badge/project-holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Forum](https://img.shields.io/badge/chat-forum%2eholochain%2enet-blue.svg?style=flat-square)](https://forum.holochain.org)
[![Chat](https://img.shields.io/badge/chat-chat%2eholochain%2enet-blue.svg?style=flat-square)](https://chat.holochain.org)

[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)
License: [![License: CAL 1.0](https://img.shields.io/badge/License-CAL%201.0-blue.svg)](https://github.com/holochain/cryptographic-autonomy-license)

A nodejs implementation of the Holochain conductor API.

## Running tests

The tests are based on a DNA consisting of a simple test wasm produced by Holochain. One rather onerous way to build this DNA is:

- Clone the [Holochain repo](https://github.com/holochain/holochain)
- Get the correct holochain build environment with: `cd holochain && nix-shell`
- Build the wasms with `cargo build --features 'build_wasms' --manifest-path=crates/holochain/Cargo.toml`
- In `test/e2e/fixture/test.dna.workdir` of this repo, point a symlink to the directory containing the `test_wasm_foo.wasm` file that was built in the previous step: `ln -s $HC_TEST_WASM_DIR/wasm32-unknown-unknown/release wasms`
- Build the DNA with `dna-util -c test/e2e/fixture/test.dna.workdir`, which will produce `test/e2e/fixture/test.dna.gz`.

Now you can run the tests with:

```
npm install
npm run test
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
