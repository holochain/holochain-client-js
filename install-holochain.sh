#!/bin/bash

REV=c1286bc8f41c3de5fc5823bf0ccf8869df92c548

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
