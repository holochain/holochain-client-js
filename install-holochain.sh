#!/bin/bash

REV=beaab9949fbff121ffd138f36c4e61c5693b8fd6

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
